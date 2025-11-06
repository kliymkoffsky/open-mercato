import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { BookingTeamRole } from '../data/entities'
import type {
  BookingTeamRoleCreateInput,
  BookingTeamRoleUpdateInput,
} from '../data/validators'
import { enforceScope } from './utils'

type TeamRoleCreatePayload = {
  tenantId: string
  organizationId: string
  name: string
  description?: string | null
}

type TeamRoleUpdatePayload = Partial<Omit<TeamRoleCreatePayload, 'tenantId' | 'organizationId'>> & {
  id: string
  tenantId?: string
  organizationId?: string
}

function mapCreateInput(input: BookingTeamRoleCreateInput): TeamRoleCreatePayload {
  return {
    tenantId: input.tenant_id,
    organizationId: input.organization_id,
    name: input.name,
    description: input.description ?? null,
  }
}

function applyUpdate(record: BookingTeamRole, payload: TeamRoleUpdatePayload): void {
  if (payload.name !== undefined) record.name = payload.name
  if (payload.description !== undefined) record.description = payload.description ?? null
}

const createTeamRoleCommand: CommandHandler<TeamRoleCreatePayload, { roleId: string }> = {
  id: 'booking.team_roles.create',
  async execute(input, ctx) {
    enforceScope(ctx, input.tenantId, input.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = em.create(BookingTeamRole, {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      name: input.name,
      description: input.description ?? null,
    })
    await em.persistAndFlush(record)
    return { roleId: record.id }
  },
}

const updateTeamRoleCommand: CommandHandler<TeamRoleUpdatePayload, { roleId: string }> = {
  id: 'booking.team_roles.update',
  async execute(input, ctx) {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(BookingTeamRole, { id: input.id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking team role not found' })
    }

    const tenantId = input.tenantId ?? record.tenantId
    const organizationId = input.organizationId ?? record.organizationId
    enforceScope(ctx, tenantId, organizationId)

    applyUpdate(record, input)
    record.updatedAt = new Date()
    await em.flush()
    return { roleId: record.id }
  },
}

const deleteTeamRoleCommand: CommandHandler<{ id: string }, { roleId: string }> = {
  id: 'booking.team_roles.delete',
  async execute(input, ctx) {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(BookingTeamRole, { id: input.id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking team role not found' })
    }

    enforceScope(ctx, record.tenantId, record.organizationId)
    record.deletedAt = new Date()
    await em.flush()
    return { roleId: record.id }
  },
}

registerCommand(createTeamRoleCommand)
registerCommand(updateTeamRoleCommand)
registerCommand(deleteTeamRoleCommand)

export function mapTeamRoleCreateInput(
  input: BookingTeamRoleCreateInput,
): TeamRoleCreatePayload {
  return mapCreateInput(input)
}

export function mapTeamRoleUpdateInput(
  input: BookingTeamRoleUpdateInput,
): TeamRoleUpdatePayload {
  const payload: TeamRoleUpdatePayload = { id: input.id }
  if (input.tenant_id) payload.tenantId = input.tenant_id
  if (input.organization_id) payload.organizationId = input.organization_id
  if (input.name !== undefined) payload.name = input.name
  if (input.description !== undefined) payload.description = input.description ?? null
  return payload
}

