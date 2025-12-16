import { NextResponse } from 'next/server'
import { z } from 'zod'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { serializeOperationMetadata } from '@open-mercato/shared/lib/commands/operationMetadata'
import {
  bookingScopedHelpers,
  resolveBookingRouteContext,
} from '../context'
import { mapEventCreateInput } from '../../commands/events'
import { eventCreateSchema, attendeeCreateSchema } from '../../data/validators'

const { withScopedPayload } = bookingScopedHelpers

// Public booking payload - stricter than admin API
const publicBookingSchema = z.object({
  serviceId: z.string().uuid(),
  organizationId: z.string().uuid().optional(),
  startsAt: z.string().datetime(),
  timezone: z.string().optional(),
  attendee: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    notes: z.string().optional(),
  }),
})

const routeMetadata = {
  POST: { requireAuth: false },
}

export const metadata = routeMetadata

export async function POST(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = publicBookingSchema.parse(raw)

    const scoped = withScopedPayload(
      {
        tenantId: context.tenantId,
        organizationId: parsed.organizationId,
      },
      context.ctx,
      context.translate,
      { requireOrganization: false }
    )

    // Construct the command input
    // We infer endsAt from service duration (load service first?) or assume fixed for now?
    // mapEventCreateInput expects fully formed input.
    // We need to fetch service to get duration.
    
    // Actually, `booking.events.create` validates everything.
    // But we need `endsAt`.
    // Let's resolve service here to get duration.
    const service = await context.em.findOne('BookingService', { id: parsed.serviceId, deletedAt: null })
    if (!service) {
        throw new CrudHttpError(404, { error: 'Service not found' })
    }
    
    const startsAt = new Date(parsed.startsAt)
    const durationMs = (service.durationMinutes || 30) * 60 * 1000
    const endsAt = new Date(startsAt.getTime() + durationMs)

    const commandBus = context.container.resolve('commandBus') as CommandBus
    
    // Prepare input for command
    const commandInput = mapEventCreateInput(
      {
        tenant_id: scoped.tenantId,
        organization_id: service.organizationId, // Use service org
        service_id: service.id,
        title: `${parsed.attendee.firstName} ${parsed.attendee.lastName}`,
        starts_at: startsAt,
        ends_at: endsAt,
        timezone: parsed.timezone,
        status: 'draft', // Public bookings start as draft? or confirmed?
        tags: ['public'],
        exdates: [],
      },
      [
        {
            first_name: parsed.attendee.firstName,
            last_name: parsed.attendee.lastName,
            email: parsed.attendee.email,
            phone: parsed.attendee.phone,
            notes: parsed.attendee.notes,
            tags: [],
        }
      ],
      service.requiredMembers.map(m => ({ member_id: m.memberId })), // Auto-assign required members?
      service.requiredResources.map(r => ({ resource_id: r.resourceId, qty: r.qty })),
    )

    const { result, logEntry } = await commandBus.execute('booking.events.create', {
      input: commandInput,
      ctx: context.ctx,
    })

    const eventId = (result as { eventId?: string | null } | null)?.eventId
    if (!eventId) {
      throw new CrudHttpError(500, { error: 'Failed to create booking' })
    }

    const response = NextResponse.json({ id: eventId, status: 'success' }, { status: 201 })

    if (logEntry?.undoToken && logEntry?.id && logEntry?.commandId) {
      response.headers.set(
        'x-om-operation',
        serializeOperationMetadata({
          id: logEntry.id,
          undoToken: logEntry.undoToken,
          commandId: logEntry.commandId,
          actionLabel: logEntry.actionLabel ?? null,
          resourceKind: 'booking.event',
          resourceId: eventId,
          executedAt: logEntry.createdAt instanceof Date ? logEntry.createdAt.toISOString() : undefined,
        }),
      )
    }

    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.public.create.POST] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }
}

