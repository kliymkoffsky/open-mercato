import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { EventBus } from '@open-mercato/events/types'
import {
  BookingEvent,
  BookingEventAttendee,
  BookingEventMember,
  BookingEventResource,
  BookingService,
  BookingTeamMember,
  BookingResource as BookingResourceEntity,
} from '../data/entities'
import type {
  BookingEventCreateInput,
  BookingEventUpdateInput,
  BookingEventAttendeeCreateInput,
} from '../data/validators'
import { enforceScope } from './utils'
import { AvailabilityService } from '../services/availability'

type EventAttendeePayload = {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  country?: string | null
  attendeeType?: string | null
  externalRef?: string | null
  tags: string[]
  notes?: string | null
}

type EventMemberPayload = {
  memberId: string
  roleId?: string | null
}

type EventResourcePayload = {
  resourceId: string
  qty: number
}

type EventCreatePayload = {
  tenantId: string
  organizationId: string
  serviceId: string
  title: string
  startsAt: Date
  endsAt: Date
  timezone?: string | null
  rrule?: string | null
  exdates: string[]
  status: 'draft' | 'confirmed' | 'cancelled'
  tags: string[]
  attendees: EventAttendeePayload[]
  members: EventMemberPayload[]
  resources: EventResourcePayload[]
}

type EventUpdatePayload = Partial<Omit<EventCreatePayload, 'tenantId' | 'organizationId'>> & {
  id: string
  tenantId?: string
  organizationId?: string
}

type LoadedTeamMember = BookingTeamMember & { roleIds: string[] }
type LoadedResource = BookingResourceEntity

function mapAttendee(input: BookingEventAttendeeCreateInput): EventAttendeePayload {
  return {
    firstName: input.first_name,
    lastName: input.last_name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    addressLine1: input.address_line1 ?? null,
    addressLine2: input.address_line2 ?? null,
    city: input.city ?? null,
    region: input.region ?? null,
    postalCode: input.postal_code ?? null,
    country: input.country ?? null,
    attendeeType: input.attendee_type ?? null,
    externalRef: input.external_ref ?? null,
    tags: [...input.tags],
    notes: input.notes ?? null,
  }
}

function mapCreateInput(
  event: BookingEventCreateInput,
  attendees: BookingEventAttendeeCreateInput[] | undefined,
  members: Array<{ member_id: string; role_id?: string | null }> | undefined,
  resources: Array<{ resource_id: string; qty?: number }> | undefined,
): EventCreatePayload {
  return {
    tenantId: event.tenant_id,
    organizationId: event.organization_id,
    serviceId: event.service_id,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    timezone: event.timezone ?? null,
    rrule: event.rrule ?? null,
    exdates: [...event.exdates],
    status: event.status,
    tags: [...event.tags],
    attendees: (attendees ?? []).map(mapAttendee),
    members: (members ?? []).map((member) => ({
      memberId: member.member_id,
      roleId: member.role_id ?? null,
    })),
    resources: (resources ?? []).map((resource) => ({
      resourceId: resource.resource_id,
      qty: resource.qty ?? 1,
    })),
  }
}

function mapUpdateInput(
  event: BookingEventUpdateInput,
  attendees: BookingEventAttendeeCreateInput[] | undefined,
  members: Array<{ member_id: string; role_id?: string | null }> | undefined,
  resources: Array<{ resource_id: string; qty?: number }> | undefined,
): EventUpdatePayload {
  const payload: EventUpdatePayload = { id: event.id }
  if (event.tenant_id) payload.tenantId = event.tenant_id
  if (event.organization_id) payload.organizationId = event.organization_id
  if (event.service_id !== undefined) payload.serviceId = event.service_id
  if (event.title !== undefined) payload.title = event.title
  if (event.starts_at !== undefined) payload.startsAt = event.starts_at
  if (event.ends_at !== undefined) payload.endsAt = event.ends_at
  if (event.timezone !== undefined) payload.timezone = event.timezone ?? null
  if (event.rrule !== undefined) payload.rrule = event.rrule ?? null
  if (event.exdates !== undefined) payload.exdates = [...event.exdates]
  if (event.status !== undefined) payload.status = event.status
  if (event.tags !== undefined) payload.tags = [...event.tags]
  if (attendees !== undefined) payload.attendees = attendees.map(mapAttendee)
  if (members !== undefined) {
    payload.members = members.map((member) => ({
      memberId: member.member_id,
      roleId: member.role_id ?? null,
    }))
  }
  if (resources !== undefined) {
    payload.resources = resources.map((resource) => ({
      resourceId: resource.resource_id,
      qty: resource.qty ?? 1,
    }))
  }
  return payload
}

function validateCapacity(service: BookingService, attendees: EventAttendeePayload[], members: EventMemberPayload[]): void {
  if (service.capacityModel === 'one_to_one') {
    if (attendees.length !== 1) {
      throw new CrudHttpError(400, { error: 'One-to-one services require exactly one attendee.' })
    }
    if (members.length > 1) {
      throw new CrudHttpError(400, { error: 'One-to-one services support at most one team member assignment.' })
    }
  }

  if (service.maxAttendees != null && service.maxAttendees > 0) {
    if (attendees.length > service.maxAttendees) {
      throw new CrudHttpError(400, { error: `Attendee count exceeds service capacity (${service.maxAttendees}).` })
    }
  }
}

function ensureRequiredMembers(
  service: BookingService,
  members: EventMemberPayload[],
): void {
  for (const requirement of service.requiredMembers) {
    const requiredQty = requirement.qty ?? 1
    const actual = members.filter((member) => member.memberId === requirement.member_id).length
    if (actual < requiredQty) {
      throw new CrudHttpError(400, { error: `Member ${requirement.member_id} is required (${requiredQty}).` })
    }
  }
}

function ensureRequiredRoles(
  service: BookingService,
  members: EventMemberPayload[],
): void {
  if (!service.requiredRoles.length) return
  const counts = new Map<string, number>()
  for (const member of members) {
    if (!member.roleId) continue
    counts.set(member.roleId, (counts.get(member.roleId) ?? 0) + 1)
  }
  for (const requirement of service.requiredRoles) {
    const actual = counts.get(requirement.role_id) ?? 0
    if (actual < requirement.qty) {
      throw new CrudHttpError(400, { error: `Role ${requirement.role_id} requires ${requirement.qty} assignment(s).` })
    }
  }
}

function ensureRequiredResources(
  service: BookingService,
  resources: EventResourcePayload[],
): void {
  if (!service.requiredResources.length) return
  const counts = new Map<string, number>()
  for (const resource of resources) {
    counts.set(resource.resourceId, (counts.get(resource.resourceId) ?? 0) + resource.qty)
  }
  for (const requirement of service.requiredResources) {
    const actual = counts.get(requirement.resource_id) ?? 0
    if (actual < requirement.qty) {
      throw new CrudHttpError(400, { error: `Resource ${requirement.resource_id} requires quantity ${requirement.qty}.` })
    }
  }
}

function ensureRequiredResourceTypes(
  service: BookingService,
  resources: EventResourcePayload[],
  resourceMap: Map<string, LoadedResource>,
): void {
  if (!service.requiredResourceTypes.length) return
  const totals = new Map<string, number>()
  for (const resource of resources) {
    const entity = resourceMap.get(resource.resourceId)
    if (!entity || !entity.resourceTypeId) continue
    totals.set(entity.resourceTypeId, (totals.get(entity.resourceTypeId) ?? 0) + resource.qty)
  }
  for (const requirement of service.requiredResourceTypes) {
    const actual = totals.get(requirement.resource_type_id) ?? 0
    if (actual < requirement.qty) {
      throw new CrudHttpError(400, { error: `Resource type ${requirement.resource_type_id} requires quantity ${requirement.qty}.` })
    }
  }
}

function validateTeamMemberAssignments(
  members: EventMemberPayload[],
  teamMemberMap: Map<string, LoadedTeamMember>,
): void {
  for (const member of members) {
    const entity = teamMemberMap.get(member.memberId)
    if (!entity) {
      throw new CrudHttpError(400, { error: `Team member ${member.memberId} is not available in this organization.` })
    }
    if (member.roleId && !entity.roleIds.includes(member.roleId)) {
      throw new CrudHttpError(400, { error: `Team member ${member.memberId} cannot fulfill role ${member.roleId}.` })
    }
  }
}

function validateResourceAssignments(
  resources: EventResourcePayload[],
  resourceMap: Map<string, LoadedResource>,
): void {
  for (const resource of resources) {
    const entity = resourceMap.get(resource.resourceId)
    if (!entity) {
      throw new CrudHttpError(400, { error: `Resource ${resource.resourceId} is not available in this organization.` })
    }
    if (resource.qty <= 0) {
      throw new CrudHttpError(400, { error: `Resource quantity for ${resource.resourceId} must be positive.` })
    }
    if (entity.capacity != null && resource.qty > entity.capacity) {
      throw new CrudHttpError(400, { error: `Requested quantity exceeds capacity for resource ${resource.resourceId}.` })
    }
  }
}

async function loadTeamMembers(
  em: EntityManager,
  memberIds: string[],
  tenantId: string,
  organizationId: string,
): Promise<Map<string, LoadedTeamMember>> {
  if (!memberIds.length) return new Map()
  const members = await em.find(BookingTeamMember, {
    id: { $in: memberIds },
    tenantId,
    organizationId,
    deletedAt: null,
  })
  if (members.length !== memberIds.length) {
    const found = new Set(members.map((member) => member.id))
    const missing = memberIds.filter((id) => !found.has(id))
    throw new CrudHttpError(400, { error: `Unknown team member(s): ${missing.join(', ')}` })
  }
  return new Map(members.map((member) => [member.id, member]))
}

async function loadResources(
  em: EntityManager,
  resourceIds: string[],
  tenantId: string,
  organizationId: string,
): Promise<Map<string, LoadedResource>> {
  if (!resourceIds.length) return new Map()
  const resources = await em.find(BookingResourceEntity, {
    id: { $in: resourceIds },
    tenantId,
    organizationId,
    deletedAt: null,
  })
  if (resources.length !== resourceIds.length) {
    const found = new Set(resources.map((resource) => resource.id))
    const missing = resourceIds.filter((id) => !found.has(id))
    throw new CrudHttpError(400, { error: `Unknown resource(s): ${missing.join(', ')}` })
  }
  return new Map(resources.map((resource) => [resource.id, resource]))
}

async function resolveService(
  em: EntityManager,
  serviceId: string,
): Promise<BookingService> {
  const service = await em.findOne(BookingService, { id: serviceId, deletedAt: null })
  if (!service) {
    throw new CrudHttpError(404, { error: 'Booking service not found' })
  }
  return service
}

async function validateEventPayload(
  em: EntityManager,
  service: BookingService,
  attendees: EventAttendeePayload[],
  members: EventMemberPayload[],
  resources: EventResourcePayload[],
  startsAt: Date,
  endsAt: Date,
  ignoreEventId?: string,
): Promise<{
  teamMembers: Map<string, LoadedTeamMember>
  bookingResources: Map<string, LoadedResource>
}> {
  validateCapacity(service, attendees, members)

  const teamMemberIds = Array.from(new Set(members.map((member) => member.memberId)))
  const resourceIds = Array.from(new Set(resources.map((resource) => resource.resourceId)))

  const [teamMembers, bookingResources] = await Promise.all([
    loadTeamMembers(em, teamMemberIds, service.tenantId, service.organizationId),
    loadResources(em, resourceIds, service.tenantId, service.organizationId),
  ])

  // Use AvailabilityService for validation
  const availabilityService = new AvailabilityService(em)
  await availabilityService.validateAvailability(
    service.tenantId,
    service.organizationId,
    service.id,
    startsAt,
    endsAt,
    ignoreEventId,
  )

  validateTeamMemberAssignments(members, teamMembers)
  validateResourceAssignments(resources, bookingResources)
  ensureRequiredMembers(service, members)
  ensureRequiredRoles(service, members)
  ensureRequiredResources(service, resources)
  ensureRequiredResourceTypes(service, resources, bookingResources)

  return { teamMembers, bookingResources }
}

function buildEventEntity(event: BookingEvent, payload: EventCreatePayload | EventUpdatePayload, service: BookingService): void {
  event.tenantId = service.tenantId
  event.organizationId = service.organizationId
  event.serviceId = payload.serviceId ?? event.serviceId
  if ('title' in payload && payload.title !== undefined) event.title = payload.title
  if ('startsAt' in payload && payload.startsAt !== undefined) event.startsAt = payload.startsAt
  if ('endsAt' in payload && payload.endsAt !== undefined) event.endsAt = payload.endsAt
  if ('timezone' in payload && payload.timezone !== undefined) event.timezone = payload.timezone ?? null
  if ('rrule' in payload && payload.rrule !== undefined) event.rrule = payload.rrule ?? null
  if ('exdates' in payload && payload.exdates !== undefined) event.exdates = [...payload.exdates]
  if ('status' in payload && payload.status !== undefined) event.status = payload.status
  if ('tags' in payload && payload.tags !== undefined) event.tags = [...payload.tags]
  event.updatedAt = new Date()
}

function persistAttendees(em: EntityManager, event: BookingEvent, attendees: EventAttendeePayload[]): void {
  for (const attendee of attendees) {
    const entity = em.create(BookingEventAttendee, {
      eventId: event.id,
      tenantId: event.tenantId,
      organizationId: event.organizationId,
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
      tags: [...attendee.tags],
      notes: attendee.notes ?? null,
    })
    em.persist(entity)
  }
}

function persistMembers(em: EntityManager, event: BookingEvent, members: EventMemberPayload[]): void {
  for (const member of members) {
    const entity = em.create(BookingEventMember, {
      eventId: event.id,
      tenantId: event.tenantId,
      organizationId: event.organizationId,
      memberId: member.memberId,
      roleId: member.roleId ?? null,
    })
    em.persist(entity)
  }
}

function persistResources(em: EntityManager, event: BookingEvent, resources: EventResourcePayload[]): void {
  for (const resource of resources) {
    const entity = em.create(BookingEventResource, {
      eventId: event.id,
      tenantId: event.tenantId,
      organizationId: event.organizationId,
      resourceId: resource.resourceId,
      qty: resource.qty,
    })
    em.persist(entity)
  }
}

async function emitEvent(
  ctx: { container: { resolve: <T>(name: string) => T } },
  eventName: string,
  payload: any,
): Promise<void> {
  try {
    const eventBus = ctx.container.resolve<EventBus>('eventBus')
    await eventBus.emitEvent(eventName, payload, { persistent: true })
  } catch (err) {
    console.warn(`[booking] Failed to emit event ${eventName}`, err)
  }
}

const createEventCommand: CommandHandler<EventCreatePayload, { eventId: string }> = {
  id: 'booking.events.create',
  async execute(input, ctx) {
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const { event, attendees } = await em.transactional(async (tx) => {
      const service = await resolveService(tx, input.serviceId)
      enforceScope(ctx, service.tenantId, service.organizationId)

      const { teamMembers, bookingResources } = await validateEventPayload(
        tx,
        service,
        input.attendees,
        input.members,
        input.resources,
        input.startsAt,
        input.endsAt,
      )
      void teamMembers
      void bookingResources

      const event = tx.create(BookingEvent, {
        tenantId: service.tenantId,
        organizationId: service.organizationId,
        serviceId: service.id,
        title: input.title,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        timezone: input.timezone ?? null,
        rrule: input.rrule ?? null,
        exdates: [...input.exdates],
        status: input.status,
        tags: [...input.tags],
      })
      tx.persist(event)
      await tx.flush()

      persistAttendees(tx, event, input.attendees)
      persistMembers(tx, event, input.members)
      persistResources(tx, event, input.resources)

      await tx.flush()

      return { event, attendees: input.attendees }
    })
    
    // Emit events
    await emitEvent(ctx, 'booking.event.created', {
      id: event.id,
      tenantId: event.tenantId,
      organizationId: event.organizationId,
      serviceId: event.serviceId,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status: event.status,
      attendees: attendees.map(a => ({ email: a.email, firstName: a.firstName, lastName: a.lastName }))
    })

    return { eventId: event.id }
  },
}

const updateEventCommand: CommandHandler<EventUpdatePayload, { eventId: string }> = {
  id: 'booking.events.update',
  async execute(input, ctx) {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const { event, previousStatus } = await em.transactional(async (tx) => {
      const event = await tx.findOne(BookingEvent, { id: input.id, deletedAt: null })
      if (!event) {
        throw new CrudHttpError(404, { error: 'Booking event not found' })
      }
      const previousStatus = event.status

      const serviceId = input.serviceId ?? event.serviceId
      const service = await resolveService(tx, serviceId)
      enforceScope(ctx, service.tenantId, service.organizationId)

      const currentAttendeesEntities = await tx.find(BookingEventAttendee, { eventId: event.id, deletedAt: null })
      const currentMembersEntities = await tx.find(BookingEventMember, { eventId: event.id, deletedAt: null })
      const currentResourcesEntities = await tx.find(BookingEventResource, { eventId: event.id, deletedAt: null })

      const attendees = input.attendees ?? currentAttendeesEntities.map((entity) => ({
        firstName: entity.firstName,
        lastName: entity.lastName,
        email: entity.email ?? null,
        phone: entity.phone ?? null,
        addressLine1: entity.addressLine1 ?? null,
        addressLine2: entity.addressLine2 ?? null,
        city: entity.city ?? null,
        region: entity.region ?? null,
        postalCode: entity.postalCode ?? null,
        country: entity.country ?? null,
        attendeeType: entity.attendeeType ?? null,
        externalRef: entity.externalRef ?? null,
        tags: [...entity.tags],
        notes: entity.notes ?? null,
      }))

      const members = input.members ?? currentMembersEntities.map((entity) => ({
        memberId: entity.memberId,
        roleId: entity.roleId ?? null,
      }))

      const resources = input.resources ?? currentResourcesEntities.map((entity) => ({
        resourceId: entity.resourceId,
        qty: entity.qty,
      }))

      // Use startsAt/endsAt from input or existing event
      const startsAt = input.startsAt ?? event.startsAt
      const endsAt = input.endsAt ?? event.endsAt

      const { teamMembers, bookingResources } = await validateEventPayload(
        tx,
        service,
        attendees,
        members,
        resources,
        startsAt,
        endsAt,
        event.id,
      )
      void teamMembers
      void bookingResources

      buildEventEntity(event, { ...input, serviceId: service.id }, service)

      if (input.attendees !== undefined) {
        await tx.nativeDelete(BookingEventAttendee, { eventId: event.id })
        persistAttendees(tx, event, attendees)
      }

      if (input.members !== undefined) {
        await tx.nativeDelete(BookingEventMember, { eventId: event.id })
        persistMembers(tx, event, members)
      }

      if (input.resources !== undefined) {
        await tx.nativeDelete(BookingEventResource, { eventId: event.id })
        persistResources(tx, event, resources)
      }

      await tx.flush()

      return { event, previousStatus }
    })
    
    await emitEvent(ctx, 'booking.event.updated', {
      id: event.id,
      tenantId: event.tenantId,
      organizationId: event.organizationId,
      serviceId: event.serviceId,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status: event.status,
      previousStatus
    })

    return { eventId: event.id }
  },
}

const deleteEventCommand: CommandHandler<{ id: string }, { eventId: string }> = {
  id: 'booking.events.delete',
  async execute(input, ctx) {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const event = await em.findOne(BookingEvent, { id: input.id, deletedAt: null })
    if (!event) {
      throw new CrudHttpError(404, { error: 'Booking event not found' })
    }

    enforceScope(ctx, event.tenantId, event.organizationId)

    event.deletedAt = new Date()
    await em.flush()
    
    await emitEvent(ctx, 'booking.event.deleted', {
      id: event.id,
      tenantId: event.tenantId,
      organizationId: event.organizationId
    })

    return { eventId: event.id }
  },
}

registerCommand(createEventCommand)
registerCommand(updateEventCommand)
registerCommand(deleteEventCommand)

export function mapEventCreateInput(
  event: BookingEventCreateInput,
  attendees?: BookingEventAttendeeCreateInput[],
  members?: Array<{ member_id: string; role_id?: string | null }>,
  resources?: Array<{ resource_id: string; qty?: number }>,
): EventCreatePayload {
  return mapCreateInput(event, attendees, members, resources)
}

export function mapEventUpdateInput(
  event: BookingEventUpdateInput,
  attendees?: BookingEventAttendeeCreateInput[],
  members?: Array<{ member_id: string; role_id?: string | null }>,
  resources?: Array<{ resource_id: string; qty?: number }>,
): EventUpdatePayload {
  return mapUpdateInput(event, attendees, members, resources)
}
