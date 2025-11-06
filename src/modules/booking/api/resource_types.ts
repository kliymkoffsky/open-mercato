import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { serializeOperationMetadata } from '@open-mercato/shared/lib/commands/operationMetadata'
import { BookingResourceType } from '../data/entities'
import {
  resourceTypeCreateSchema,
  resourceTypeUpdateSchema,
  type BookingResourceTypeCreateInput,
  type BookingResourceTypeUpdateInput,
} from '../data/validators'
import {
  mapResourceTypeCreateInput,
  mapResourceTypeUpdateInput,
} from '../commands/resourceTypes'
import {
  bookingScopedHelpers,
  ensureOrganizationAccess,
  resolveBookingRouteContext,
} from './context'

const { withScopedPayload } = bookingScopedHelpers

const deleteSchema = z.object({ id: z.string().uuid() })

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['booking.resources.manage'] },
  POST: { requireAuth: true, requireFeatures: ['booking.resources.manage'] },
  PATCH: { requireAuth: true, requireFeatures: ['booking.resources.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['booking.resources.manage'] },
}

export const metadata = routeMetadata

export async function GET(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const url = new URL(req.url)
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

    const filter: Record<string, unknown> = {
      tenantId: scoped.tenantId,
      deletedAt: null,
    }
    if (scoped.organizationId) {
      filter.organizationId = scoped.organizationId
    } else if (context.organizationIds && context.organizationIds.length > 0) {
      filter.organizationId = { $in: context.organizationIds }
    }

    const resourceTypes = await context.em.find(BookingResourceType, filter, {
      orderBy: { name: 'asc' },
    })

    const payload = resourceTypes.map((type) => ({
      id: type.id,
      tenantId: type.tenantId,
      organizationId: type.organizationId,
      name: type.name,
      description: type.description ?? null,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt,
    }))

    return NextResponse.json({ items: payload })
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.resource_types.GET] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to load booking resource types' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = bookingScopedHelpers.parseScopedCommandInput(
      resourceTypeCreateSchema,
      raw,
      context.ctx,
      context.translate,
    ) as BookingResourceTypeCreateInput

    ensureOrganizationAccess(parsed.organization_id ?? null, context.organizationIds)

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('booking.resource_types.create', {
      input: mapResourceTypeCreateInput(parsed),
      ctx: context.ctx,
    })

    const resourceTypeId = (result as { resourceTypeId?: string | null } | null)?.resourceTypeId
    if (!resourceTypeId) {
      throw new CrudHttpError(500, { error: 'Failed to create booking resource type' })
    }

    const record = await context.em.findOne(BookingResourceType, { id: resourceTypeId })
    if (!record) {
      throw new CrudHttpError(500, { error: 'Failed to load created booking resource type' })
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
          resourceKind: 'booking.resource_type',
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
    console.error('[booking.resource_types.POST] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to create booking resource type' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = bookingScopedHelpers.parseScopedCommandInput(
      resourceTypeUpdateSchema,
      raw,
      context.ctx,
      context.translate,
      { requireOrganization: false },
    ) as BookingResourceTypeUpdateInput

    ensureOrganizationAccess(parsed.organization_id ?? null, context.organizationIds)

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('booking.resource_types.update', {
      input: mapResourceTypeUpdateInput(parsed),
      ctx: context.ctx,
    })

    const resourceTypeId = (result as { resourceTypeId?: string | null } | null)?.resourceTypeId ?? parsed.id
    const record = await context.em.findOne(BookingResourceType, { id: resourceTypeId })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking resource type not found after update' })
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
          resourceKind: 'booking.resource_type',
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
    console.error('[booking.resource_types.PATCH] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to update booking resource type' }, { status: 500 })
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
    const { result, logEntry } = await commandBus.execute('booking.resource_types.delete', {
      input: { id: parsed.id },
      ctx: context.ctx,
    })

    const resourceTypeId = (result as { resourceTypeId?: string | null } | null)?.resourceTypeId ?? parsed.id
    const response = NextResponse.json({ id: resourceTypeId })

    if (logEntry?.undoToken && logEntry?.id && logEntry?.commandId) {
      response.headers.set(
        'x-om-operation',
        serializeOperationMetadata({
          id: logEntry.id,
          undoToken: logEntry.undoToken,
          commandId: logEntry.commandId,
          actionLabel: logEntry.actionLabel ?? null,
          resourceKind: 'booking.resource_type',
          resourceId: resourceTypeId,
          executedAt: logEntry.createdAt instanceof Date ? logEntry.createdAt.toISOString() : undefined,
        }),
      )
    }

    return response
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.resource_types.DELETE] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to delete booking resource type' }, { status: 500 })
  }
}

