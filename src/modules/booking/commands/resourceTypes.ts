import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { BookingResourceType } from '../data/entities'
import type {
  BookingResourceTypeCreateInput,
  BookingResourceTypeUpdateInput,
} from '../data/validators'
import { enforceScope } from './utils'

type ResourceTypeCreatePayload = {
  tenantId: string
  organizationId: string
  name: string
  description?: string | null
}

type ResourceTypeUpdatePayload = Partial<Omit<ResourceTypeCreatePayload, 'tenantId' | 'organizationId'>> & {
  id: string
  tenantId?: string
  organizationId?: string
}

function mapCreateInput(input: BookingResourceTypeCreateInput): ResourceTypeCreatePayload {
  return {
    tenantId: input.tenant_id,
    organizationId: input.organization_id,
    name: input.name,
    description: input.description ?? null,
  }
}

function applyUpdate(record: BookingResourceType, payload: ResourceTypeUpdatePayload): void {
  if (payload.name !== undefined) record.name = payload.name
  if (payload.description !== undefined) record.description = payload.description ?? null
}

const createResourceTypeCommand: CommandHandler<ResourceTypeCreatePayload, { resourceTypeId: string }> = {
  id: 'booking.resource_types.create',
  async execute(input, ctx) {
    enforceScope(ctx, input.tenantId, input.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = em.create(BookingResourceType, {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      name: input.name,
      description: input.description ?? null,
    })
    await em.persistAndFlush(record)
    return { resourceTypeId: record.id }
  },
}

const updateResourceTypeCommand: CommandHandler<ResourceTypeUpdatePayload, { resourceTypeId: string }> = {
  id: 'booking.resource_types.update',
  async execute(input, ctx) {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(BookingResourceType, { id: input.id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking resource type not found' })
    }

    const tenantId = input.tenantId ?? record.tenantId
    const organizationId = input.organizationId ?? record.organizationId
    enforceScope(ctx, tenantId, organizationId)

    applyUpdate(record, input)
    record.updatedAt = new Date()
    await em.flush()

    return { resourceTypeId: record.id }
  },
}

const deleteResourceTypeCommand: CommandHandler<{ id: string }, { resourceTypeId: string }> = {
  id: 'booking.resource_types.delete',
  async execute(input, ctx) {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(BookingResourceType, { id: input.id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking resource type not found' })
    }

    enforceScope(ctx, record.tenantId, record.organizationId)

    record.deletedAt = new Date()
    await em.flush()

    return { resourceTypeId: record.id }
  },
}

registerCommand(createResourceTypeCommand)
registerCommand(updateResourceTypeCommand)
registerCommand(deleteResourceTypeCommand)

export function mapResourceTypeCreateInput(
  input: BookingResourceTypeCreateInput,
): ResourceTypeCreatePayload {
  return mapCreateInput(input)
}

export function mapResourceTypeUpdateInput(
  input: BookingResourceTypeUpdateInput,
): ResourceTypeUpdatePayload {
  const payload: ResourceTypeUpdatePayload = { id: input.id }
  if (input.tenant_id) payload.tenantId = input.tenant_id
  if (input.organization_id) payload.organizationId = input.organization_id
  if (input.name !== undefined) payload.name = input.name
  if (input.description !== undefined) payload.description = input.description ?? null
  return payload
}

