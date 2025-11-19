import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { serializeOperationMetadata } from '@open-mercato/shared/lib/commands/operationMetadata'
import { BookingTeamRole } from '../data/entities'
import {
  teamRoleCreateSchema,
  teamRoleUpdateSchema,
  type BookingTeamRoleCreateInput,
  type BookingTeamRoleUpdateInput,
} from '../data/validators'
import {
  mapTeamRoleCreateInput,
  mapTeamRoleUpdateInput,
} from '../commands/teamRoles'
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
    const scoped = withScopedPayload(
      {
        tenantId: context.tenantId,
        organizationId: organizationParam ?? undefined,
      },
      context.ctx,
      context.translate,
    )

    ensureOrganizationAccess(scoped.organizationId ?? null, context.organizationIds)

    if (id) {
      const record = await context.em.findOne(BookingTeamRole, {
        id,
        tenantId: scoped.tenantId,
        deletedAt: null,
      })
      if (!record) {
        throw new CrudHttpError(404, { error: 'Booking team role not found' })
      }
      ensureOrganizationAccess(record.organizationId, context.organizationIds)

      return NextResponse.json({
        item: {
          id: record.id,
          tenantId: record.tenantId,
          organizationId: record.organizationId,
          name: record.name,
          description: record.description ?? null,
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

    const roles = await context.em.find(BookingTeamRole, filter, { orderBy: { name: 'asc' } })
    const payload = roles.map((role) => ({
      id: role.id,
      tenantId: role.tenantId,
      organizationId: role.organizationId,
      name: role.name,
      description: role.description ?? null,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }))

    return NextResponse.json({ items: payload })
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.team_roles.GET] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to load booking team roles' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = bookingScopedHelpers.parseScopedCommandInput(
      teamRoleCreateSchema,
      raw,
      context.ctx,
      context.translate,
    ) as BookingTeamRoleCreateInput

    ensureOrganizationAccess(parsed.organization_id ?? null, context.organizationIds)

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('booking.team_roles.create', {
      input: mapTeamRoleCreateInput(parsed),
      ctx: context.ctx,
    })

    const roleId = (result as { roleId?: string | null } | null)?.roleId
    if (!roleId) {
      throw new CrudHttpError(500, { error: 'Failed to create booking team role' })
    }

    const record = await context.em.findOne(BookingTeamRole, { id: roleId })
    if (!record) {
      throw new CrudHttpError(500, { error: 'Failed to load created booking team role' })
    }

    const response = NextResponse.json(
      {
        id: record.id,
        tenantId: record.tenantId,
        organizationId: record.organizationId,
        name: record.name,
        description: record.description ?? null,
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
          resourceKind: 'booking.team_role',
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
    console.error('[booking.team_roles.POST] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to create booking team role' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = bookingScopedHelpers.parseScopedCommandInput(
      teamRoleUpdateSchema,
      raw,
      context.ctx,
      context.translate,
      { requireOrganization: false },
    ) as BookingTeamRoleUpdateInput

    ensureOrganizationAccess(parsed.organization_id ?? null, context.organizationIds)

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('booking.team_roles.update', {
      input: mapTeamRoleUpdateInput(parsed),
      ctx: context.ctx,
    })

    const roleId = (result as { roleId?: string | null } | null)?.roleId ?? parsed.id
    const record = await context.em.findOne(BookingTeamRole, { id: roleId })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking team role not found after update' })
    }

    const response = NextResponse.json({
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      name: record.name,
      description: record.description ?? null,
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
          resourceKind: 'booking.team_role',
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
    console.error('[booking.team_roles.PATCH] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to update booking team role' }, { status: 500 })
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
    const { result, logEntry } = await commandBus.execute('booking.team_roles.delete', {
      input: { id: parsed.id },
      ctx: context.ctx,
    })

    const roleId = (result as { roleId?: string | null } | null)?.roleId ?? parsed.id
    const response = NextResponse.json({ id: roleId })

    if (logEntry?.undoToken && logEntry?.id && logEntry?.commandId) {
      response.headers.set(
        'x-om-operation',
        serializeOperationMetadata({
          id: logEntry.id,
          undoToken: logEntry.undoToken,
          commandId: logEntry.commandId,
          actionLabel: logEntry.actionLabel ?? null,
          resourceKind: 'booking.team_role',
          resourceId: roleId,
          executedAt: logEntry.createdAt instanceof Date ? logEntry.createdAt.toISOString() : undefined,
        }),
      )
    }

    return response
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.team_roles.DELETE] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to delete booking team role' }, { status: 500 })
  }
}

