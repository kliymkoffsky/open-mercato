import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { BookingTeamMember } from '../data/entities'
import type {
  BookingTeamMemberCreateInput,
  BookingTeamMemberUpdateInput,
} from '../data/validators'
import { enforceScope } from './utils'

type TeamMemberCreatePayload = {
  tenantId: string
  organizationId: string
  displayName: string
  userId?: string | null
  roleIds: string[]
  tags: string[]
  isActive: boolean
}

type TeamMemberUpdatePayload = Partial<Omit<TeamMemberCreatePayload, 'tenantId' | 'organizationId'>> & {
  id: string
  tenantId?: string
  organizationId?: string
}

function mapCreateInput(input: BookingTeamMemberCreateInput): TeamMemberCreatePayload {
  return {
    tenantId: input.tenant_id,
    organizationId: input.organization_id,
    displayName: input.display_name,
    userId: input.user_id ?? null,
    roleIds: [...input.role_ids],
    tags: [...input.tags],
    isActive: input.is_active,
  }
}

function applyUpdate(record: BookingTeamMember, payload: TeamMemberUpdatePayload): void {
  if (payload.displayName !== undefined) record.displayName = payload.displayName
  if (payload.userId !== undefined) record.userId = payload.userId ?? null
  if (payload.roleIds !== undefined) record.roleIds = [...payload.roleIds]
  if (payload.tags !== undefined) record.tags = [...payload.tags]
  if (payload.isActive !== undefined) record.isActive = payload.isActive
}

const createTeamMemberCommand: CommandHandler<TeamMemberCreatePayload, { memberId: string }> = {
  id: 'booking.team_members.create',
  async execute(input, ctx) {
    enforceScope(ctx, input.tenantId, input.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(BookingTeamMember, {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      displayName: input.displayName,
      userId: input.userId ?? null,
      roleIds: [...input.roleIds],
      tags: [...input.tags],
      isActive: input.isActive,
      createdAt: now,
      updatedAt: now,
    })
    await em.persistAndFlush(record)
    return { memberId: record.id }
  },
}

const updateTeamMemberCommand: CommandHandler<TeamMemberUpdatePayload, { memberId: string }> = {
  id: 'booking.team_members.update',
  async execute(input, ctx) {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(BookingTeamMember, { id: input.id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking team member not found' })
    }

    const tenantId = input.tenantId ?? record.tenantId
    const organizationId = input.organizationId ?? record.organizationId
    enforceScope(ctx, tenantId, organizationId)

    applyUpdate(record, input)
    record.updatedAt = new Date()
    await em.flush()
    return { memberId: record.id }
  },
}

const deleteTeamMemberCommand: CommandHandler<{ id: string }, { memberId: string }> = {
  id: 'booking.team_members.delete',
  async execute(input, ctx) {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(BookingTeamMember, { id: input.id, deletedAt: null })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking team member not found' })
    }

    enforceScope(ctx, record.tenantId, record.organizationId)
    record.deletedAt = new Date()
    record.isActive = false
    await em.flush()
    return { memberId: record.id }
  },
}

registerCommand(createTeamMemberCommand)
registerCommand(updateTeamMemberCommand)
registerCommand(deleteTeamMemberCommand)

export function mapTeamMemberCreateInput(
  input: BookingTeamMemberCreateInput,
): TeamMemberCreatePayload {
  return mapCreateInput(input)
}

export function mapTeamMemberUpdateInput(
  input: BookingTeamMemberUpdateInput,
): TeamMemberUpdatePayload {
  const payload: TeamMemberUpdatePayload = { id: input.id }
  if (input.tenant_id) payload.tenantId = input.tenant_id
  if (input.organization_id) payload.organizationId = input.organization_id
  if (input.display_name !== undefined) payload.displayName = input.display_name
  if (input.user_id !== undefined) payload.userId = input.user_id ?? null
  if (input.role_ids !== undefined) payload.roleIds = [...input.role_ids]
  if (input.tags !== undefined) payload.tags = [...input.tags]
  if (input.is_active !== undefined) payload.isActive = input.is_active
  return payload
}


