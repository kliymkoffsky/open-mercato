import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { BookingAvailabilityRule } from '../data/entities'
import type {
  BookingAvailabilityRuleCreateInput,
  BookingAvailabilityRuleUpdateInput,
} from '../data/validators'
import { enforceScope } from './utils'

type AvailabilityCreatePayload = {
  tenantId: string
  organizationId: string
  subjectType: 'member' | 'resource'
  subjectId: string
  timezone: string
  rrule: string
  exdates: string[]
}

type AvailabilityUpdatePayload = Partial<Omit<AvailabilityCreatePayload, 'tenantId' | 'organizationId'>> & {
  id: string
  tenantId?: string
  organizationId?: string
}

function mapCreateInput(input: BookingAvailabilityRuleCreateInput): AvailabilityCreatePayload {
  return {
    tenantId: input.tenant_id,
    organizationId: input.organization_id,
    subjectType: input.subject_type,
    subjectId: input.subject_id,
    timezone: input.timezone,
    rrule: input.rrule,
    exdates: [...input.exdates],
  }
}

function applyUpdate(record: BookingAvailabilityRule, payload: AvailabilityUpdatePayload): void {
  if (payload.subjectType !== undefined) record.subjectType = payload.subjectType
  if (payload.subjectId !== undefined) record.subjectId = payload.subjectId
  if (payload.timezone !== undefined) record.timezone = payload.timezone
  if (payload.rrule !== undefined) record.rrule = payload.rrule
  if (payload.exdates !== undefined) record.exdates = [...payload.exdates]
}

const createAvailabilityCommand: CommandHandler<AvailabilityCreatePayload, { availabilityId: string }> = {
  id: 'booking.availability.create',
  async execute(input, ctx) {
    enforceScope(ctx, input.tenantId, input.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(BookingAvailabilityRule, {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      timezone: input.timezone,
      rrule: input.rrule,
      exdates: [...input.exdates],
      createdAt: now,
      updatedAt: now,
    })
    await em.persistAndFlush(record)
    return { availabilityId: record.id }
  },
}

const updateAvailabilityCommand: CommandHandler<AvailabilityUpdatePayload, { availabilityId: string }> = {
  id: 'booking.availability.update',
  async execute(input, ctx) {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(BookingAvailabilityRule, { id: input.id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking availability rule not found' })
    }

    const tenantId = input.tenantId ?? record.tenantId
    const organizationId = input.organizationId ?? record.organizationId
    enforceScope(ctx, tenantId, organizationId)

    applyUpdate(record, input)
    record.updatedAt = new Date()
    await em.flush()
    return { availabilityId: record.id }
  },
}

const deleteAvailabilityCommand: CommandHandler<{ id: string }, { availabilityId: string }> = {
  id: 'booking.availability.delete',
  async execute(input, ctx) {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(BookingAvailabilityRule, { id: input.id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking availability rule not found' })
    }

    enforceScope(ctx, record.tenantId, record.organizationId)
    record.deletedAt = new Date()
    await em.flush()
    return { availabilityId: record.id }
  },
}

registerCommand(createAvailabilityCommand)
registerCommand(updateAvailabilityCommand)
registerCommand(deleteAvailabilityCommand)

export function mapAvailabilityCreateInput(
  input: BookingAvailabilityRuleCreateInput,
): AvailabilityCreatePayload {
  return mapCreateInput(input)
}

export function mapAvailabilityUpdateInput(
  input: BookingAvailabilityRuleUpdateInput,
): AvailabilityUpdatePayload {
  const payload: AvailabilityUpdatePayload = { id: input.id }
  if (input.tenant_id) payload.tenantId = input.tenant_id
  if (input.organization_id) payload.organizationId = input.organization_id
  if (input.subject_type !== undefined) payload.subjectType = input.subject_type
  if (input.subject_id !== undefined) payload.subjectId = input.subject_id
  if (input.timezone !== undefined) payload.timezone = input.timezone
  if (input.rrule !== undefined) payload.rrule = input.rrule
  if (input.exdates !== undefined) payload.exdates = [...input.exdates]
  return payload
}

