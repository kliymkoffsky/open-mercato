import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { serializeOperationMetadata } from '@open-mercato/shared/lib/commands/operationMetadata'
import { BookingResource } from '../data/entities'
import {
  resourceCreateSchema,
  resourceUpdateSchema,
  type BookingResourceCreateInput,
  type BookingResourceUpdateInput,
} from '../data/validators'
import {
  mapResourceCreateInput,
  mapResourceUpdateInput,
} from '../commands/resources'
import {
  bookingScopedHelpers,
  ensureOrganizationAccess,
  resolveBookingRouteContext,
} from './context'

const { withScopedPayload } = bookingScopedHelpers

const deleteSchema = z.object({ id: z.string().uuid() })

const routeMetadata = {
  GET: { requireAuth: true },
  POST: { requireAuth: true, requireFeatures: ['booking.resources.manage'] },
  PATCH: { requireAuth: true, requireFeatures: ['booking.resources.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['booking.resources.manage'] },
}

export const metadata = routeMetadata

export async function GET(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const organizationParam = url.searchParams.get('organizationId')
    const resourceTypeParam = url.searchParams.get('resourceTypeId')
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
      const record = await context.em.findOne(BookingResource, {
        id,
        tenantId: scoped.tenantId,
        deletedAt: null,
      })
      if (!record) {
        throw new CrudHttpError(404, { error: 'Booking resource not found' })
      }
      ensureOrganizationAccess(record.organizationId, context.organizationIds)

      return NextResponse.json({
        item: {
          id: record.id,
          tenantId: record.tenantId,
          organizationId: record.organizationId,
          name: record.name,
          resourceTypeId: record.resourceTypeId ?? null,
          capacity: record.capacity ?? null,
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
    if (resourceTypeParam) {
      filter.resourceTypeId = resourceTypeParam
    }

    const resources = await context.em.find(BookingResource, filter, { orderBy: { name: 'asc' } })
    const payload = resources.map((resource) => ({
      id: resource.id,
      tenantId: resource.tenantId,
      organizationId: resource.organizationId,
      name: resource.name,
      resourceTypeId: resource.resourceTypeId ?? null,
      capacity: resource.capacity ?? null,
      tags: resource.tags,
      isActive: resource.isActive,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    }))

    return NextResponse.json({ items: payload })
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.resources.GET] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to load booking resources' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = bookingScopedHelpers.parseScopedCommandInput(
      resourceCreateSchema,
      raw,
      context.ctx,
      context.translate,
    ) as BookingResourceCreateInput

    ensureOrganizationAccess(parsed.organization_id ?? null, context.organizationIds)

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('booking.resources.create', {
      input: mapResourceCreateInput(parsed),
      ctx: context.ctx,
    })

    const resourceId = (result as { resourceId?: string | null } | null)?.resourceId
    if (!resourceId) {
      throw new CrudHttpError(500, { error: 'Failed to create booking resource' })
    }

    const record = await context.em.findOne(BookingResource, { id: resourceId })
    if (!record) {
      throw new CrudHttpError(500, { error: 'Failed to load created booking resource' })
    }

    const response = NextResponse.json(
      {
        id: record.id,
        tenantId: record.tenantId,
        organizationId: record.organizationId,
        name: record.name,
        resourceTypeId: record.resourceTypeId ?? null,
        capacity: record.capacity ?? null,
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
          resourceKind: 'booking.resource',
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
    console.error('[booking.resources.POST] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to create booking resource' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = bookingScopedHelpers.parseScopedCommandInput(
      resourceUpdateSchema,
      raw,
      context.ctx,
      context.translate,
      { requireOrganization: false },
    ) as BookingResourceUpdateInput

    ensureOrganizationAccess(parsed.organization_id ?? null, context.organizationIds)

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result, logEntry } = await commandBus.execute('booking.resources.update', {
      input: mapResourceUpdateInput(parsed),
      ctx: context.ctx,
    })

    const resourceId = (result as { resourceId?: string | null } | null)?.resourceId ?? parsed.id
    const record = await context.em.findOne(BookingResource, { id: resourceId })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking resource not found after update' })
    }

    const response = NextResponse.json({
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      name: record.name,
      resourceTypeId: record.resourceTypeId ?? null,
      capacity: record.capacity ?? null,
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
          resourceKind: 'booking.resource',
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
    console.error('[booking.resources.PATCH] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to update booking resource' }, { status: 500 })
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
    const { result, logEntry } = await commandBus.execute('booking.resources.delete', {
      input: { id: parsed.id },
      ctx: context.ctx,
    })

    const resourceId = (result as { resourceId?: string | null } | null)?.resourceId ?? parsed.id
    const response = NextResponse.json({ id: resourceId })

    if (logEntry?.undoToken && logEntry?.id && logEntry?.commandId) {
      response.headers.set(
        'x-om-operation',
        serializeOperationMetadata({
          id: logEntry.id,
          undoToken: logEntry.undoToken,
          commandId: logEntry.commandId,
          actionLabel: logEntry.actionLabel ?? null,
          resourceKind: 'booking.resource',
          resourceId: resourceId,
          executedAt: logEntry.createdAt instanceof Date ? logEntry.createdAt.toISOString() : undefined,
        }),
      )
    }

    return response
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.resources.DELETE] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to delete booking resource' }, { status: 500 })
  }
}

