import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { BookingService } from '../data/entities'
import type { ServiceCreateInput, ServiceUpdateInput } from '../data/validators'

type ServiceCreatePayload = {
  tenantId: string
  organizationId: string
  name: string
  description?: string | null
  durationMinutes: number
  capacityModel: 'one_to_one' | 'one_to_many' | 'many_to_many'
  maxAttendees?: number | null
  requiredRoles: Array<{ roleId: string; qty: number }>
  requiredMembers: Array<{ memberId: string; qty?: number | null }>
  requiredResources: Array<{ resourceId: string; qty: number }>
  requiredResourceTypes: Array<{ resourceTypeId: string; qty: number }>
  tags: string[]
  isActive: boolean
}

type ServiceUpdatePayload = Partial<Omit<ServiceCreatePayload, 'tenantId' | 'organizationId'>> & {
  id: string
  tenantId?: string
  organizationId?: string
}

const SUPERADMIN_ROLE = 'superadmin'

function isSuperAdmin(auth: CommandRuntimeContext['auth']): boolean {
  if (!auth) return false
  if ((auth as Record<string, unknown>).isSuperAdmin === true) return true
  const roles = Array.isArray(auth.roles) ? auth.roles : []
  return roles.some((role) => typeof role === 'string' && role.trim().toLowerCase() === SUPERADMIN_ROLE)
}

function enforceScope(ctx: CommandRuntimeContext, tenantId: string, organizationId: string | null): void {
  const auth = ctx.auth
  const superAdmin = isSuperAdmin(auth)
  if (!superAdmin && auth?.tenantId && auth.tenantId !== tenantId) {
    throw new CrudHttpError(403, { error: 'Forbidden: tenant scope mismatch' })
  }

  const allowedIds = ctx.organizationScope?.allowedIds
  if (!organizationId || superAdmin || !allowedIds || allowedIds.length === 0) {
    return
  }
  if (!allowedIds.includes(organizationId)) {
    throw new CrudHttpError(403, { error: 'Forbidden: organization scope mismatch' })
  }
}

function mapServiceCreateInput(input: ServiceCreateInput): ServiceCreatePayload {
  return {
    tenantId: input.tenant_id,
    organizationId: input.organization_id,
    name: input.name,
    description: input.description ?? null,
    durationMinutes: input.duration_minutes,
    capacityModel: input.capacity_model,
    maxAttendees: input.max_attendees ?? null,
    requiredRoles: input.required_roles.map((role) => ({ roleId: role.role_id, qty: role.qty })),
    requiredMembers: input.required_members.map((member) => ({ memberId: member.member_id, qty: member.qty ?? null })),
    requiredResources: input.required_resources.map((resource) => ({ resourceId: resource.resource_id, qty: resource.qty })),
    requiredResourceTypes: input.required_resource_types.map((resourceType) => ({ resourceTypeId: resourceType.resource_type_id, qty: resourceType.qty })),
    tags: input.tags,
    isActive: input.is_active,
  }
}

function applyServiceUpdatePayload(record: BookingService, payload: ServiceUpdatePayload): void {
  if (payload.name !== undefined) record.name = payload.name
  if (payload.description !== undefined) record.description = payload.description ?? null
  if (payload.durationMinutes !== undefined) record.durationMinutes = payload.durationMinutes
  if (payload.capacityModel !== undefined) record.capacityModel = payload.capacityModel
  if (payload.maxAttendees !== undefined) record.maxAttendees = payload.maxAttendees ?? null
  if (payload.requiredRoles !== undefined) record.requiredRoles = payload.requiredRoles.map((role) => ({ role_id: role.roleId, qty: role.qty }))
  if (payload.requiredMembers !== undefined) record.requiredMembers = payload.requiredMembers.map((member) => ({ member_id: member.memberId, qty: member.qty ?? undefined }))
  if (payload.requiredResources !== undefined) record.requiredResources = payload.requiredResources.map((resource) => ({ resource_id: resource.resourceId, qty: resource.qty }))
  if (payload.requiredResourceTypes !== undefined) record.requiredResourceTypes = payload.requiredResourceTypes.map((resourceType) => ({ resource_type_id: resourceType.resourceTypeId, qty: resourceType.qty }))
  if (payload.tags !== undefined) record.tags = payload.tags
  if (payload.isActive !== undefined) record.isActive = payload.isActive
}

const createServiceCommand: CommandHandler<ServiceCreatePayload, { serviceId: string }> = {
  id: 'booking.services.create',
  async execute(input, ctx) {
    enforceScope(ctx, input.tenantId, input.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(BookingService, {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      name: input.name,
      description: input.description ?? null,
      durationMinutes: input.durationMinutes,
      capacityModel: input.capacityModel,
      maxAttendees: input.maxAttendees ?? null,
      requiredRoles: input.requiredRoles.map((role) => ({ role_id: role.roleId, qty: role.qty })),
      requiredMembers: input.requiredMembers.map((member) => ({ member_id: member.memberId, qty: member.qty ?? undefined })),
      requiredResources: input.requiredResources.map((resource) => ({ resource_id: resource.resourceId, qty: resource.qty })),
      requiredResourceTypes: input.requiredResourceTypes.map((resourceType) => ({ resource_type_id: resourceType.resourceTypeId, qty: resourceType.qty })),
      tags: [...input.tags],
      isActive: input.isActive,
      createdAt: now,
      updatedAt: now,
    })
    await em.persistAndFlush(record)

    return { serviceId: record.id }
  },
}

const updateServiceCommand: CommandHandler<ServiceUpdatePayload, { serviceId: string }> = {
  id: 'booking.services.update',
  async execute(input, ctx) {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(BookingService, { id: input.id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking service not found' })
    }

    const tenantId = input.tenantId ?? record.tenantId
    const organizationId = input.organizationId ?? record.organizationId
    enforceScope(ctx, tenantId, organizationId)

    applyServiceUpdatePayload(record, input)
    record.updatedAt = new Date()

    await em.flush()
    return { serviceId: record.id }
  },
}

const deleteServiceCommand: CommandHandler<{ id: string }, { serviceId: string }> = {
  id: 'booking.services.delete',
  async execute(input, ctx) {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(BookingService, { id: input.id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking service not found' })
    }

    enforceScope(ctx, record.tenantId, record.organizationId)

    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()

    return { serviceId: record.id }
  },
}

registerCommand(createServiceCommand)
registerCommand(updateServiceCommand)
registerCommand(deleteServiceCommand)

export function mapServiceUpdateInput(input: ServiceUpdateInput): ServiceUpdatePayload {
  const payload: ServiceUpdatePayload = { id: input.id }

  if (input.tenant_id) payload.tenantId = input.tenant_id
  if (input.organization_id) payload.organizationId = input.organization_id
  if (input.name !== undefined) payload.name = input.name
  if (input.description !== undefined) payload.description = input.description ?? null
  if (input.duration_minutes !== undefined) payload.durationMinutes = input.duration_minutes
  if (input.capacity_model !== undefined) payload.capacityModel = input.capacity_model
  if (input.max_attendees !== undefined) payload.maxAttendees = input.max_attendees ?? null
  if (input.required_roles !== undefined) {
    payload.requiredRoles = input.required_roles.map((role) => ({ roleId: role.role_id, qty: role.qty }))
  }
  if (input.required_members !== undefined) {
    payload.requiredMembers = input.required_members.map((member) => ({ memberId: member.member_id, qty: member.qty ?? null }))
  }
  if (input.required_resources !== undefined) {
    payload.requiredResources = input.required_resources.map((resource) => ({ resourceId: resource.resource_id, qty: resource.qty }))
  }
  if (input.required_resource_types !== undefined) {
    payload.requiredResourceTypes = input.required_resource_types.map((resourceType) => ({ resourceTypeId: resourceType.resource_type_id, qty: resourceType.qty }))
  }
  if (input.tags !== undefined) payload.tags = [...input.tags]
  if (input.is_active !== undefined) payload.isActive = input.is_active

  return payload
}

export function mapServiceCreateInputForCommand(input: ServiceCreateInput): ServiceCreatePayload {
  return mapServiceCreateInput(input)
}

