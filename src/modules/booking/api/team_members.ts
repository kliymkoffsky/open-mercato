import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { serializeOperationMetadata } from '@open-mercato/shared/lib/commands/operationMetadata'
import { BookingTeamMember } from '../data/entities'
import {
  teamMemberCreateSchema,
  teamMemberUpdateSchema,
  type BookingTeamMemberCreateInput,
  type BookingTeamMemberUpdateInput,
} from '../data/validators'
import {
  mapTeamMemberCreateInput,
  mapTeamMemberUpdateInput,
} from '../commands/teamMembers'
import {
  bookingScopedHelpers,
  ensureOrganizationAccess,
  resolveBookingRouteContext,
} from './context'

const { withScopedPayload } = bookingScopedHelpers

const deleteSchema = z.object({ id: z.string().uuid() })

const routeMetadata = {
  GET: { requireAuth: true },
  POST: { requireAuth: true, requireFeatures: ['booking.members.manage'] },
  PATCH: { requireAuth: true, requireFeatures: ['booking.members.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['booking.members.manage'] },
}

export const metadata = routeMetadata

export async function GET(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const organizationParam = url.searchParams.get('organizationId')
    const roleFilter = url.searchParams.get('roleId')
    const userFilterParam = url.searchParams.get('userId')
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
    const hasManageFeature = grantedFeatures.has('booking.members.manage')

    if (id) {
      const record = await context.em.findOne(BookingTeamMember, {
        id,
        tenantId: scoped.tenantId,
        deletedAt: null,
      })
      if (!record) {
        throw new CrudHttpError(404, { error: 'Booking team member not found' })
      }
      ensureOrganizationAccess(record.organizationId, context.organizationIds)

      return NextResponse.json({
        item: {
          id: record.id,
          tenantId: record.tenantId,
          organizationId: record.organizationId,
          displayName: record.displayName,
          userId: record.userId ?? null,
          roleIds: record.roleIds,
          tags: record.tags,
          isActive: record.isActive,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
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
    if (roleFilter) {
      filter.roleIds = { $contains: [roleFilter] }
    }
    let targetUserId: string | null = null
    if (userFilterParam) {
      if (userFilterParam === 'current' || userFilterParam === 'me') {
        targetUserId = auth?.userId ?? null
      } else if (z.string().uuid().safeParse(userFilterParam).success) {
        targetUserId = userFilterParam
      }
      if (!targetUserId) {
        return NextResponse.json({ items: [] })
      }
    }

    if (!hasManageFeature) {
      const authUserId = auth?.userId ?? null
      if (!authUserId) {
        throw new CrudHttpError(403, { error: 'Forbidden: booking.members.manage feature required' })
      }
      targetUserId = targetUserId ?? authUserId
      if (targetUserId !== authUserId) {
        throw new CrudHttpError(403, { error: 'Forbidden: booking.members.manage feature required' })
      }
    }

    if (targetUserId) {
      filter.userId = targetUserId
    }

    const members = await context.em.find(BookingTeamMember, filter, {
      orderBy: { displayName: 'asc' },
    })

    const payload = members.map((member) => ({
      id: member.id,
      tenantId: member.tenantId,
      organizationId: member.organizationId,
      displayName: member.displayName,
      userId: member.userId ?? null,
      roleIds: member.roleIds,
      tags: member.tags,
      isActive: member.isActive,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    }))

    return NextResponse.json({ items: payload })
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.team_members.GET] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to load booking team members' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = bookingScopedHelpers.parseScopedCommandInput(
      teamMemberCreateSchema,
      raw,
      context.ctx,
      context.translate,
    ) as BookingTeamMemberCreateInput

    ensureOrganizationAccess(parsed.organization_id ?? null, context.organizationIds)

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('booking.team_members.create', {
      input: mapTeamMemberCreateInput(parsed),
      ctx: context.ctx,
    })

    const memberId = (result as { memberId?: string | null } | null)?.memberId
    if (!memberId) {
      throw new CrudHttpError(500, { error: 'Failed to create booking team member' })
    }

    const record = await context.em.findOne(BookingTeamMember, { id: memberId })
    if (!record) {
      throw new CrudHttpError(500, { error: 'Failed to load created booking team member' })
    }

    const response = NextResponse.json(
      {
        id: record.id,
        tenantId: record.tenantId,
        organizationId: record.organizationId,
        displayName: record.displayName,
        userId: record.userId ?? null,
        roleIds: record.roleIds,
        tags: record.tags,
        isActive: record.isActive,
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
          resourceKind: 'booking.team_member',
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
    console.error('[booking.team_members.POST] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to create booking team member' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = bookingScopedHelpers.parseScopedCommandInput(
      teamMemberUpdateSchema,
      raw,
      context.ctx,
      context.translate,
      { requireOrganization: false },
    ) as BookingTeamMemberUpdateInput

    ensureOrganizationAccess(parsed.organization_id ?? null, context.organizationIds)

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('booking.team_members.update', {
      input: mapTeamMemberUpdateInput(parsed),
      ctx: context.ctx,
    })

    const memberId = (result as { memberId?: string | null } | null)?.memberId ?? parsed.id
    const record = await context.em.findOne(BookingTeamMember, { id: memberId })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking team member not found after update' })
    }

    const response = NextResponse.json({
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      displayName: record.displayName,
      userId: record.userId ?? null,
      roleIds: record.roleIds,
      tags: record.tags,
      isActive: record.isActive,
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
          resourceKind: 'booking.team_member',
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
    console.error('[booking.team_members.PATCH] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to update booking team member' }, { status: 500 })
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
    const { result, logEntry } = await commandBus.execute('booking.team_members.delete', {
      input: { id: parsed.id },
      ctx: context.ctx,
    })

    const memberId = (result as { memberId?: string | null } | null)?.memberId ?? parsed.id
    const response = NextResponse.json({ id: memberId })

    if (logEntry?.undoToken && logEntry?.id && logEntry?.commandId) {
      response.headers.set(
        'x-om-operation',
        serializeOperationMetadata({
          id: logEntry.id,
          undoToken: logEntry.undoToken,
          commandId: logEntry.commandId,
          actionLabel: logEntry.actionLabel ?? null,
          resourceKind: 'booking.team_member',
          resourceId: memberId,
          executedAt: logEntry.createdAt instanceof Date ? logEntry.createdAt.toISOString() : undefined,
        }),
      )
    }

    return response
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.team_members.DELETE] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to delete booking team member' }, { status: 500 })
  }
}

