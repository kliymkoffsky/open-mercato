import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { serializeOperationMetadata } from '@open-mercato/shared/lib/commands/operationMetadata'
import { BookingAvailabilityRule } from '../data/entities'
import {
  availabilityRuleCreateSchema,
  availabilityRuleUpdateSchema,
  type BookingAvailabilityRuleCreateInput,
  type BookingAvailabilityRuleUpdateInput,
} from '../data/validators'
import {
  mapAvailabilityCreateInput,
  mapAvailabilityUpdateInput,
} from '../commands/availability'
import {
  bookingScopedHelpers,
  ensureOrganizationAccess,
  resolveBookingRouteContext,
} from './context'

const { withScopedPayload } = bookingScopedHelpers

const deleteSchema = z.object({ id: z.string().uuid() })

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['booking.members.manage'] },
  POST: { requireAuth: true, requireFeatures: ['booking.members.manage'] },
  PATCH: { requireAuth: true, requireFeatures: ['booking.members.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['booking.members.manage'] },
}

export const metadata = routeMetadata

export async function GET(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const url = new URL(req.url)
    const organizationParam = url.searchParams.get('organizationId')
    const subjectType = url.searchParams.get('subjectType')
    const subjectId = url.searchParams.get('subjectId')

    const scoped = withScopedPayload(
      {
        tenantId: context.tenantId,
        organizationId: organizationParam ?? undefined,
      },
      context.ctx,
      context.translate,
    )

    ensureOrganizationAccess(scoped.organizationId ?? null, context.organizationIds)

    const filter: Record<string, unknown> = {
      tenantId: scoped.tenantId,
      deletedAt: null,
    }
    if (scoped.organizationId) {
      filter.organizationId = scoped.organizationId
    } else if (context.organizationIds && context.organizationIds.length > 0) {
      filter.organizationId = { $in: context.organizationIds }
    }
    if (subjectType) filter.subjectType = subjectType
    if (subjectId) filter.subjectId = subjectId

    const rules = await context.em.find(BookingAvailabilityRule, filter, {
      orderBy: { createdAt: 'desc' },
    })

    const payload = rules.map((rule) => ({
      id: rule.id,
      tenantId: rule.tenantId,
      organizationId: rule.organizationId,
      subjectType: rule.subjectType,
      subjectId: rule.subjectId,
      timezone: rule.timezone,
      rrule: rule.rrule,
      exdates: rule.exdates,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    }))

    return NextResponse.json({ items: payload })
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.availability.GET] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to load booking availability rules' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = bookingScopedHelpers.parseScopedCommandInput(
      availabilityRuleCreateSchema,
      raw,
      context.ctx,
      context.translate,
    ) as BookingAvailabilityRuleCreateInput

    ensureOrganizationAccess(parsed.organization_id ?? null, context.organizationIds)

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('booking.availability.create', {
      input: mapAvailabilityCreateInput(parsed),
      ctx: context.ctx,
    })

    const availabilityId = (result as { availabilityId?: string | null } | null)?.availabilityId
    if (!availabilityId) {
      throw new CrudHttpError(500, { error: 'Failed to create booking availability rule' })
    }

    const record = await context.em.findOne(BookingAvailabilityRule, { id: availabilityId })
    if (!record) {
      throw new CrudHttpError(500, { error: 'Failed to load created booking availability rule' })
    }

    const response = NextResponse.json(
      {
        id: record.id,
        tenantId: record.tenantId,
        organizationId: record.organizationId,
        subjectType: record.subjectType,
        subjectId: record.subjectId,
        timezone: record.timezone,
        rrule: record.rrule,
        exdates: record.exdates,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      { status: 201 },
    )

    if (logEntry?.undoToken && logEntry?.id && logEntry?.commandId) {
      response.headers.set(
        'x-om-operation',
        serializeOperationMetadata({
          id: logEntry.id,
          undoToken: logEntry.undoToken,
          commandId: logEntry.commandId,
          actionLabel: logEntry.actionLabel ?? null,
          resourceKind: 'booking.availability',
          resourceId: record.id,
          executedAt: logEntry.createdAt instanceof Date ? logEntry.createdAt.toISOString() : undefined,
        }),
      )
    }

    return response
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.availability.POST] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to create booking availability rule' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = bookingScopedHelpers.parseScopedCommandInput(
      availabilityRuleUpdateSchema,
      raw,
      context.ctx,
      context.translate,
      { requireOrganization: false },
    ) as BookingAvailabilityRuleUpdateInput

    ensureOrganizationAccess(parsed.organization_id ?? null, context.organizationIds)

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('booking.availability.update', {
      input: mapAvailabilityUpdateInput(parsed),
      ctx: context.ctx,
    })

    const availabilityId = (result as { availabilityId?: string | null } | null)?.availabilityId ?? parsed.id
    const record = await context.em.findOne(BookingAvailabilityRule, { id: availabilityId })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking availability rule not found after update' })
    }

    const response = NextResponse.json({
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      subjectType: record.subjectType,
      subjectId: record.subjectId,
      timezone: record.timezone,
      rrule: record.rrule,
      exdates: record.exdates,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })

    if (logEntry?.undoToken && logEntry?.id && logEntry?.commandId) {
      response.headers.set(
        'x-om-operation',
        serializeOperationMetadata({
          id: logEntry.id,
          undoToken: logEntry.undoToken,
          commandId: logEntry.commandId,
          actionLabel: logEntry.actionLabel ?? null,
          resourceKind: 'booking.availability',
          resourceId: record.id,
          executedAt: logEntry.createdAt instanceof Date ? logEntry.createdAt.toISOString() : undefined,
        }),
      )
    }

    return response
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.availability.PATCH] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to update booking availability rule' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const body = await req.json().catch(() => ({}))
    const url = new URL(req.url)
    const id = body?.id ?? url.searchParams.get('id')
    const parsed = deleteSchema.parse({ id })

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('booking.availability.delete', {
      input: { id: parsed.id },
      ctx: context.ctx,
    })

    const availabilityId = (result as { availabilityId?: string | null } | null)?.availabilityId ?? parsed.id
    const response = NextResponse.json({ id: availabilityId })

    if (logEntry?.undoToken && logEntry?.id && logEntry?.commandId) {
      response.headers.set(
        'x-om-operation',
        serializeOperationMetadata({
          id: logEntry.id,
          undoToken: logEntry.undoToken,
          commandId: logEntry.commandId,
          actionLabel: logEntry.actionLabel ?? null,
          resourceKind: 'booking.availability',
          resourceId: availabilityId,
          executedAt: logEntry.createdAt instanceof Date ? logEntry.createdAt.toISOString() : undefined,
        }),
      )
    }

    return response
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.availability.DELETE] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to delete booking availability rule' }, { status: 500 })
  }
}

