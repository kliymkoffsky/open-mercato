import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { serializeOperationMetadata } from '@open-mercato/shared/lib/commands/operationMetadata'
import {
  BookingEvent,
  BookingEventAttendee,
  BookingEventMember,
  BookingEventResource,
  BookingService,
  BookingTeamMember,
} from '../data/entities'
import {
  eventCreateSchema,
  eventUpdateSchema,
  attendeeCreateSchema,
  type BookingEventCreateInput,
  type BookingEventUpdateInput,
  type BookingEventAttendeeCreateInput,
} from '../data/validators'
import {
  mapEventCreateInput,
  mapEventUpdateInput,
} from '../commands/events'
import {
  bookingScopedHelpers,
  ensureOrganizationAccess,
  resolveBookingRouteContext,
} from './context'

const { withScopedPayload } = bookingScopedHelpers

const memberAssignmentSchema = z.object({
  member_id: z.string().uuid(),
  role_id: z.string().uuid().optional(),
})

const resourceAssignmentSchema = z.object({
  resource_id: z.string().uuid(),
  qty: z.coerce.number().int().positive().optional(),
})

const eventCreatePayloadSchema = z.object({
  event: eventCreateSchema,
  attendees: z.array(attendeeCreateSchema).optional(),
  members: z.array(memberAssignmentSchema).optional(),
  resources: z.array(resourceAssignmentSchema).optional(),
})

const eventUpdatePayloadSchema = z.object({
  event: eventUpdateSchema,
  attendees: z.array(attendeeCreateSchema).optional(),
  members: z.array(memberAssignmentSchema).optional(),
  resources: z.array(resourceAssignmentSchema).optional(),
})

const deleteSchema = z.object({ id: z.string().uuid() })

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['booking.view'] },
  POST: { requireAuth: true, requireFeatures: ['booking.create'] },
  PATCH: { requireAuth: true, requireFeatures: ['booking.edit'] },
  DELETE: { requireAuth: true, requireFeatures: ['booking.delete'] },
}

export const metadata = routeMetadata

function mapEventToResponse(
  event: BookingEvent,
  attendees: BookingEventAttendee[],
  members: BookingEventMember[],
  resources: BookingEventResource[],
  service: BookingService | null,
) {
  return {
    id: event.id,
    tenantId: event.tenantId,
    organizationId: event.organizationId,
    serviceId: event.serviceId,
    serviceName: service?.name ?? null,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone ?? null,
    rrule: event.rrule ?? null,
    exdates: event.exdates,
    status: event.status,
    tags: event.tags,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    attendees: attendees.map((attendee) => ({
      id: attendee.id,
      firstName: attendee.firstName,
      lastName: attendee.lastName,
      email: attendee.email ?? null,
      phone: attendee.phone ?? null,
      addressLine1: attendee.addressLine1 ?? null,
      addressLine2: attendee.addressLine2 ?? null,
      city: attendee.city ?? null,
      region: attendee.region ?? null,
      postalCode: attendee.postalCode ?? null,
      country: attendee.country ?? null,
      attendeeType: attendee.attendeeType ?? null,
      externalRef: attendee.externalRef ?? null,
      tags: attendee.tags,
      notes: attendee.notes ?? null,
    })),
    members: members.map((member) => ({
      id: member.id,
      memberId: member.memberId,
      roleId: member.roleId ?? null,
    })),
    resources: resources.map((resource) => ({
      id: resource.id,
      resourceId: resource.resourceId,
      qty: resource.qty,
    })),
  }
}

async function loadEventDetails(
  em: typeof import('@mikro-orm/postgresql').EntityManager,
  eventIds: string[],
) {
  if (!eventIds.length) {
    return {
      attendees: new Map<string, BookingEventAttendee[]>(),
      members: new Map<string, BookingEventMember[]>(),
      resources: new Map<string, BookingEventResource[]>(),
    }
  }

  const [attendees, members, resources] = await Promise.all([
    em.find(BookingEventAttendee, { eventId: { $in: eventIds }, deletedAt: null }),
    em.find(BookingEventMember, { eventId: { $in: eventIds }, deletedAt: null }),
    em.find(BookingEventResource, { eventId: { $in: eventIds }, deletedAt: null }),
  ])

  const attendeeMap = new Map<string, BookingEventAttendee[]>()
  for (const attendee of attendees) {
    const list = attendeeMap.get(attendee.eventId) ?? []
    list.push(attendee)
    attendeeMap.set(attendee.eventId, list)
  }

  const memberMap = new Map<string, BookingEventMember[]>()
  for (const member of members) {
    const list = memberMap.get(member.eventId) ?? []
    list.push(member)
    memberMap.set(member.eventId, list)
  }

  const resourceMap = new Map<string, BookingEventResource[]>()
  for (const resource of resources) {
    const list = resourceMap.get(resource.eventId) ?? []
    list.push(resource)
    resourceMap.set(resource.eventId, list)
  }

  return {
    attendees: attendeeMap,
    members: memberMap,
    resources: resourceMap,
  }
}

export async function GET(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const organizationParam = url.searchParams.get('organizationId')
    const serviceId = url.searchParams.get('serviceId')
    const status = url.searchParams.get('status')
    const startsFrom = url.searchParams.get('startsFrom')
    const startsTo = url.searchParams.get('startsTo')
    const memberId = url.searchParams.get('memberId')

    const scoped = withScopedPayload(
      {
        tenantId: context.tenantId,
        organizationId: organizationParam ?? undefined,
      },
      context.ctx,
      context.translate,
    )

    ensureOrganizationAccess(scoped.organizationId ?? null, context.organizationIds)

    const auth = context.ctx.auth
    const grantedFeatures = new Set(auth?.features ?? [])
    const hasBookingView = grantedFeatures.has('booking.view')
    let allowedMemberIds: string[] | null = null

    if (id) {
      const event = await context.em.findOne(BookingEvent, {
        id,
        tenantId: scoped.tenantId,
        deletedAt: null,
      })
      if (!event) {
        throw new CrudHttpError(404, { error: 'Booking event not found' })
      }
      ensureOrganizationAccess(event.organizationId, context.organizationIds)

      const [eventAttendees, eventMembers, eventResources, service] = await Promise.all([
        context.em.find(BookingEventAttendee, { eventId: event.id, deletedAt: null }),
        context.em.find(BookingEventMember, { eventId: event.id, deletedAt: null }),
        context.em.find(BookingEventResource, { eventId: event.id, deletedAt: null }),
        context.em.findOne(BookingService, { id: event.serviceId }),
      ])

      return NextResponse.json({
        item: mapEventToResponse(
          event,
          eventAttendees,
          eventMembers,
          eventResources,
          service ?? null,
        ),
      })
    }

    const filter: Record<string, unknown> = {
      tenantId: scoped.tenantId,
      deletedAt: null,
    }
    if (scoped.organizationId) {
      filter.organizationId = scoped.organizationId
    } else if (context.organizationIds && context.organizationIds.length > 0) {
      filter.organizationId = { $in: context.organizationIds }
    }
    if (serviceId) {
      filter.serviceId = serviceId
    }
    if (status) {
      filter.status = status
    }
    if (startsFrom) {
      filter.startsAt = { ...(filter.startsAt as Record<string, unknown> ?? {}), $gte: new Date(startsFrom) }
    }
    if (startsTo) {
      filter.startsAt = { ...(filter.startsAt as Record<string, unknown> ?? {}), $lte: new Date(startsTo) }
    }

    if (!hasBookingView) {
      const authUserId = auth?.userId ?? null
      if (!authUserId) {
        throw new CrudHttpError(403, { error: 'Forbidden: booking.view feature required' })
      }

      const memberQuery: Record<string, unknown> = {
        tenantId: scoped.tenantId,
        userId: authUserId,
        deletedAt: null,
      }
      if (scoped.organizationId) {
        memberQuery.organizationId = scoped.organizationId
      } else if (context.organizationIds && context.organizationIds.length > 0) {
        memberQuery.organizationId = { $in: context.organizationIds }
      }

      const personalMembers = await context.em.find(BookingTeamMember, memberQuery, { fields: ['id'] })
      allowedMemberIds = personalMembers.map((member) => member.id)

      if (!allowedMemberIds.length) {
        return NextResponse.json({ items: [] })
      }

      if (memberId && !allowedMemberIds.includes(memberId)) {
        throw new CrudHttpError(403, { error: 'Forbidden: booking.view feature required' })
      }
    }

    if (memberId) {
      const memberFilter: Record<string, unknown> = {
        tenantId: scoped.tenantId,
        memberId,
        deletedAt: null,
      }
      if (scoped.organizationId) {
        memberFilter.organizationId = scoped.organizationId
      } else if (context.organizationIds && context.organizationIds.length > 0) {
        memberFilter.organizationId = { $in: context.organizationIds }
      }

      const memberships = await context.em.find(BookingEventMember, memberFilter, { fields: ['eventId'] })
      if (!memberships.length) {
        return NextResponse.json({ items: [] })
      }
      const eventIdSet = new Set(memberships.map((row) => row.eventId))
      filter.id = { $in: Array.from(eventIdSet) }
    } else if (allowedMemberIds && allowedMemberIds.length) {
      const memberships = await context.em.find(BookingEventMember, {
        tenantId: scoped.tenantId,
        memberId: { $in: allowedMemberIds },
        deletedAt: null,
      }, { fields: ['eventId'] })
      if (!memberships.length) {
        return NextResponse.json({ items: [] })
      }
      const eventIdSet = new Set(memberships.map((row) => row.eventId))
      filter.id = { $in: Array.from(eventIdSet) }
    }

    const events = await context.em.find(BookingEvent, filter, {
      orderBy: { startsAt: 'asc' },
      limit: 200,
    })
    const eventIds = events.map((event) => event.id)

    const { attendees, members, resources } = await loadEventDetails(context.em, eventIds)
    const serviceIds = Array.from(new Set(events.map((event) => event.serviceId)))
    const services = serviceIds.length
      ? await context.em.find(BookingService, { id: { $in: serviceIds } })
      : []
    const serviceMap = new Map(services.map((service) => [service.id, service]))

    const responseItems = events.map((event) =>
      mapEventToResponse(
        event,
        attendees.get(event.id) ?? [],
        members.get(event.id) ?? [],
        resources.get(event.id) ?? [],
        serviceMap.get(event.serviceId) ?? null,
      ),
    )

    return NextResponse.json({ items: responseItems })
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.events.GET] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to load booking events' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = bookingScopedHelpers.parseScopedCommandInput(
      eventCreatePayloadSchema,
      raw,
      context.ctx,
      context.translate,
    ) as z.infer<typeof eventCreatePayloadSchema>

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const commandInput = mapEventCreateInput(
      parsed.event as BookingEventCreateInput,
      parsed.attendees as BookingEventAttendeeCreateInput[] | undefined,
      parsed.members,
      parsed.resources,
    )

    ensureOrganizationAccess(commandInput.organizationId ?? null, context.organizationIds)

    const { result, logEntry } = await commandBus.execute('booking.events.create', {
      input: commandInput,
      ctx: context.ctx,
    })

    const eventId = (result as { eventId?: string | null } | null)?.eventId
    if (!eventId) {
      throw new CrudHttpError(500, { error: 'Failed to create booking event' })
    }

    const event = await context.em.findOne(BookingEvent, { id: eventId })
    if (!event) {
      throw new CrudHttpError(500, { error: 'Failed to load created booking event' })
    }

    const [eventAttendees, eventMembers, eventResources, service] = await Promise.all([
      context.em.find(BookingEventAttendee, { eventId: event.id, deletedAt: null }),
      context.em.find(BookingEventMember, { eventId: event.id, deletedAt: null }),
      context.em.find(BookingEventResource, { eventId: event.id, deletedAt: null }),
      context.em.findOne(BookingService, { id: event.serviceId }),
    ])

    const response = NextResponse.json(
      mapEventToResponse(event, eventAttendees, eventMembers, eventResources, service ?? null),
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
          resourceKind: 'booking.event',
          resourceId: event.id,
          executedAt: logEntry.createdAt instanceof Date ? logEntry.createdAt.toISOString() : undefined,
        }),
      )
    }

    return response
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.events.POST] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to create booking event' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = bookingScopedHelpers.parseScopedCommandInput(
      eventUpdatePayloadSchema,
      raw,
      context.ctx,
      context.translate,
      { requireOrganization: false },
    ) as z.infer<typeof eventUpdatePayloadSchema>

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const commandInput = mapEventUpdateInput(
      parsed.event as BookingEventUpdateInput,
      parsed.attendees as BookingEventAttendeeCreateInput[] | undefined,
      parsed.members,
      parsed.resources,
    )

    ensureOrganizationAccess(commandInput.organizationId ?? null, context.organizationIds)

    const { result, logEntry } = await commandBus.execute('booking.events.update', {
      input: commandInput,
      ctx: context.ctx,
    })

    const eventId = (result as { eventId?: string | null } | null)?.eventId ?? parsed.event.id

    const event = await context.em.findOne(BookingEvent, { id: eventId })
    if (!event) {
      throw new CrudHttpError(404, { error: 'Booking event not found after update' })
    }

    const [eventAttendees, eventMembers, eventResources, service] = await Promise.all([
      context.em.find(BookingEventAttendee, { eventId: event.id, deletedAt: null }),
      context.em.find(BookingEventMember, { eventId: event.id, deletedAt: null }),
      context.em.find(BookingEventResource, { eventId: event.id, deletedAt: null }),
      context.em.findOne(BookingService, { id: event.serviceId }),
    ])

    const response = NextResponse.json(
      mapEventToResponse(event, eventAttendees, eventMembers, eventResources, service ?? null),
    )

    if (logEntry?.undoToken && logEntry?.id && logEntry?.commandId) {
      response.headers.set(
        'x-om-operation',
        serializeOperationMetadata({
          id: logEntry.id,
          undoToken: logEntry.undoToken,
          commandId: logEntry.commandId,
          actionLabel: logEntry.actionLabel ?? null,
          resourceKind: 'booking.event',
          resourceId: event.id,
          executedAt: logEntry.createdAt instanceof Date ? logEntry.createdAt.toISOString() : undefined,
        }),
      )
    }

    return response
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.events.PATCH] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to update booking event' }, { status: 500 })
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
    const { result, logEntry } = await commandBus.execute('booking.events.delete', {
      input: { id: parsed.id },
      ctx: context.ctx,
    })

    const eventId = (result as { eventId?: string | null } | null)?.eventId ?? parsed.id
    const response = NextResponse.json({ id: eventId })

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
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.events.DELETE] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to delete booking event' }, { status: 500 })
  }
}

