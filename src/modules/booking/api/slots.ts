import { NextResponse } from 'next/server'
import { z } from 'zod'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { AvailabilityService } from '../services/availability'
import {
  bookingScopedHelpers,
  resolveBookingRouteContext,
} from './context'

const { withScopedPayload } = bookingScopedHelpers

const slotsQuerySchema = z.object({
  serviceId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  timezone: z.string().optional(),
  organizationId: z.string().uuid().optional(),
})

// Public endpoint
const routeMetadata = {
  GET: { requireAuth: false },
}

export const metadata = routeMetadata

export async function GET(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const url = new URL(req.url)
    const raw = {
      serviceId: url.searchParams.get('serviceId'),
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      timezone: url.searchParams.get('timezone'),
      organizationId: url.searchParams.get('organizationId'),
    }

    const parsed = slotsQuerySchema.parse(raw)

    // For public access, we don't strictly enforce organization membership via "user" context,
    // but we must ensure the service exists and is "publicly visible" (if we had such a flag).
    // For now, we allow checking availability if you know the serviceId and organizationId.
    
    // We use withScopedPayload to handle potential tenant derivation, but pass empty auth if needed.
    const scoped = withScopedPayload(
      {
        tenantId: context.tenantId,
        organizationId: parsed.organizationId,
      },
      context.ctx,
      context.translate,
      { requireOrganization: false } 
    )

    const service = new AvailabilityService(context.em)
    const slots = await service.calculateSlots(
      scoped.tenantId,
      scoped.organizationId,
      {
        serviceId: parsed.serviceId,
        from: new Date(parsed.from),
        to: new Date(parsed.to),
        timezone: parsed.timezone,
      },
    )

    return NextResponse.json({ items: slots })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.errors }, { status: 400 })
    }
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.slots.GET] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to calculate slots' }, { status: 500 })
  }
}
