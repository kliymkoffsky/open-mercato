import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { BookingResource } from '../data/entities'
import type {
  BookingResourceCreateInput,
  BookingResourceUpdateInput,
} from '../data/validators'
import { enforceScope } from './utils'

type ResourceCreatePayload = {
  tenantId: string
  organizationId: string
  name: string
  resourceTypeId?: string | null
  capacity?: number | null
  tags: string[]
  isActive: boolean
}

type ResourceUpdatePayload = Partial<Omit<ResourceCreatePayload, 'tenantId' | 'organizationId'>> & {
  id: string
  tenantId?: string
  organizationId?: string
}

function mapCreateInput(input: BookingResourceCreateInput): ResourceCreatePayload {
  return {
    tenantId: input.tenant_id,
    organizationId: input.organization_id,
    name: input.name,
    resourceTypeId: input.resource_type_id ?? null,
    capacity: input.capacity ?? null,
    tags: [...input.tags],
    isActive: input.is_active,
  }
}

function applyUpdate(record: BookingResource, payload: ResourceUpdatePayload): void {
  if (payload.name !== undefined) record.name = payload.name
  if (payload.resourceTypeId !== undefined) record.resourceTypeId = payload.resourceTypeId ?? null
  if (payload.capacity !== undefined) record.capacity = payload.capacity ?? null
  if (payload.tags !== undefined) record.tags = [...payload.tags]
  if (payload.isActive !== undefined) record.isActive = payload.isActive
}

const createResourceCommand: CommandHandler<ResourceCreatePayload, { resourceId: string }> = {
  id: 'booking.resources.create',
  async execute(input, ctx) {
    enforceScope(ctx, input.tenantId, input.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(BookingResource, {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      name: input.name,
      resourceTypeId: input.resourceTypeId ?? null,
      capacity: input.capacity ?? null,
      tags: [...input.tags],
      isActive: input.isActive,
      createdAt: now,
      updatedAt: now,
    })
    await em.persistAndFlush(record)
    return { resourceId: record.id }
  },
}

const updateResourceCommand: CommandHandler<ResourceUpdatePayload, { resourceId: string }> = {
  id: 'booking.resources.update',
  async execute(input, ctx) {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(BookingResource, { id: input.id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking resource not found' })
    }

    const tenantId = input.tenantId ?? record.tenantId
    const organizationId = input.organizationId ?? record.organizationId
    enforceScope(ctx, tenantId, organizationId)

    applyUpdate(record, input)
    record.updatedAt = new Date()
    await em.flush()
    return { resourceId: record.id }
  },
}

const deleteResourceCommand: CommandHandler<{ id: string }, { resourceId: string }> = {
  id: 'booking.resources.delete',
  async execute(input, ctx) {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(BookingResource, { id: input.id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking resource not found' })
    }

    enforceScope(ctx, record.tenantId, record.organizationId)
    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()

    return { resourceId: record.id }
  },
}

registerCommand(createResourceCommand)
registerCommand(updateResourceCommand)
registerCommand(deleteResourceCommand)

export function mapResourceCreateInput(
  input: BookingResourceCreateInput,
): ResourceCreatePayload {
  return mapCreateInput(input)
}

export function mapResourceUpdateInput(
  input: BookingResourceUpdateInput,
): ResourceUpdatePayload {
  const payload: ResourceUpdatePayload = { id: input.id }
  if (input.tenant_id) payload.tenantId = input.tenant_id
  if (input.organization_id) payload.organizationId = input.organization_id
  if (input.name !== undefined) payload.name = input.name
  if (input.resource_type_id !== undefined) payload.resourceTypeId = input.resource_type_id ?? null
  if (input.capacity !== undefined) payload.capacity = input.capacity ?? null
  if (input.tags !== undefined) payload.tags = [...input.tags]
  if (input.is_active !== undefined) payload.isActive = input.is_active
  return payload
}


