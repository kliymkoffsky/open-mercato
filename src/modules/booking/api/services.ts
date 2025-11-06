import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@/lib/di/container'
import { getAuthFromRequest } from '@/lib/auth/server'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { serializeOperationMetadata } from '@open-mercato/shared/lib/commands/operationMetadata'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { AwilixContainer } from 'awilix'
import { createScopedApiHelpers } from '@open-mercato/shared/lib/api/scoped'
import { BookingService } from '../data/entities'
import {
  serviceCreateSchema,
  serviceUpdateSchema,
  type ServiceCreateInput,
  type ServiceUpdateInput,
} from '../data/validators'
import {
  mapServiceCreateInputForCommand,
  mapServiceUpdateInput,
} from '../commands/services'

const { withScopedPayload } = createScopedApiHelpers({
  messages: {
    tenantRequired: { key: 'booking.errors.tenant_required', fallback: 'Tenant context is required.' },
    organizationRequired: { key: 'booking.errors.organization_required', fallback: 'Organization context is required.' },
  },
})

type BookingRouteContext = {
  container: AwilixContainer
  ctx: CommandRuntimeContext
  em: EntityManager
  tenantId: string
  organizationIds: string[] | null
  translate: (key: string, fallback?: string) => string
}

async function resolveBookingRouteContext(req: Request): Promise<BookingRouteContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  const { translate } = await resolveTranslations()

  if (!auth || !auth.tenantId) {
    throw new CrudHttpError(401, { error: translate('booking.errors.unauthorized', 'Unauthorized') })
  }

  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const tenantId = scope?.tenantId ?? auth.tenantId
  const organizationIds = scope?.filterIds && scope.filterIds.length > 0
    ? scope.filterIds
    : auth.orgId
      ? [auth.orgId]
      : null

  const ctx: CommandRuntimeContext = {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
    organizationIds,
    request: req,
  }

  const em = container.resolve('em') as EntityManager

  return {
    container,
    ctx,
    em,
    tenantId,
    organizationIds,
    translate,
  }
}

function ensureOrganizationAccess(
  organizationId: string | null,
  accessibleIds: string[] | null,
) {
  if (!organizationId || !accessibleIds || accessibleIds.length === 0) return
  if (!accessibleIds.includes(organizationId)) {
    throw new CrudHttpError(403, { error: 'Forbidden: organization not accessible' })
  }
}

const deleteSchema = z.object({ id: z.string().uuid() })

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['booking.services.manage'] },
  POST: { requireAuth: true, requireFeatures: ['booking.services.manage'] },
  PATCH: { requireAuth: true, requireFeatures: ['booking.services.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['booking.services.manage'] },
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

    const services = await context.em.find(BookingService, filter, { orderBy: { name: 'asc' } })
    const payload = services.map((service) => ({
      id: service.id,
      tenantId: service.tenantId,
      organizationId: service.organizationId,
      name: service.name,
      description: service.description ?? null,
      durationMinutes: service.durationMinutes,
      capacityModel: service.capacityModel,
      maxAttendees: service.maxAttendees ?? null,
      requiredRoles: service.requiredRoles,
      requiredMembers: service.requiredMembers,
      requiredResources: service.requiredResources,
      requiredResourceTypes: service.requiredResourceTypes,
      tags: service.tags,
      isActive: service.isActive,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    }))

    return NextResponse.json({ items: payload })
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.services.GET] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to load booking services' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = serviceCreateSchema.parse(raw) as ServiceCreateInput
    const scoped = withScopedPayload(
      {
        tenantId: parsed.tenant_id,
        organizationId: parsed.organization_id,
      },
      context.ctx,
      context.translate,
    )

    ensureOrganizationAccess(scoped.organizationId ?? null, context.organizationIds)

    parsed.tenant_id = scoped.tenantId
    if (scoped.organizationId) {
      parsed.organization_id = scoped.organizationId
    }

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const commandInput = mapServiceCreateInputForCommand(parsed)
    const { result, logEntry } = await commandBus.execute('booking.services.create', {
      input: commandInput,
      ctx: context.ctx,
    })

    const serviceId = (result as { serviceId?: string | null } | null)?.serviceId
    if (!serviceId) {
      throw new CrudHttpError(500, { error: 'Failed to create booking service' })
    }

    const record = await context.em.findOne(BookingService, { id: serviceId })
    if (!record) {
      throw new CrudHttpError(500, { error: 'Failed to load created booking service' })
    }

    const response = NextResponse.json(
      {
        id: record.id,
        tenantId: record.tenantId,
        organizationId: record.organizationId,
        name: record.name,
        description: record.description ?? null,
        durationMinutes: record.durationMinutes,
        capacityModel: record.capacityModel,
        maxAttendees: record.maxAttendees ?? null,
        requiredRoles: record.requiredRoles,
        requiredMembers: record.requiredMembers,
        requiredResources: record.requiredResources,
        requiredResourceTypes: record.requiredResourceTypes,
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
          resourceKind: 'booking.service',
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
    console.error('[booking.services.POST] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to create booking service' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const context = await resolveBookingRouteContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = serviceUpdateSchema.parse(raw) as ServiceUpdateInput

    const tenantId = parsed.tenant_id ?? context.tenantId
    const organizationId = parsed.organization_id ?? null
    const scoped = withScopedPayload(
      {
        tenantId,
        organizationId: organizationId ?? undefined,
      },
      context.ctx,
      context.translate,
    )

    ensureOrganizationAccess(scoped.organizationId ?? null, context.organizationIds)

    parsed.tenant_id = scoped.tenantId
    if (scoped.organizationId) {
      parsed.organization_id = scoped.organizationId
    }

    const commandBus = context.container.resolve('commandBus') as CommandBus
    const commandInput = mapServiceUpdateInput(parsed)
    const { result, logEntry } = await commandBus.execute('booking.services.update', {
      input: commandInput,
      ctx: context.ctx,
    })

    const serviceId = (result as { serviceId?: string | null } | null)?.serviceId ?? parsed.id
    const record = await context.em.findOne(BookingService, { id: serviceId })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Booking service not found after update' })
    }

    const response = NextResponse.json({
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      name: record.name,
      description: record.description ?? null,
      durationMinutes: record.durationMinutes,
      capacityModel: record.capacityModel,
      maxAttendees: record.maxAttendees ?? null,
      requiredRoles: record.requiredRoles,
      requiredMembers: record.requiredMembers,
      requiredResources: record.requiredResources,
      requiredResourceTypes: record.requiredResourceTypes,
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
          resourceKind: 'booking.service',
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
    console.error('[booking.services.PATCH] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to update booking service' }, { status: 500 })
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
    const { result, logEntry } = await commandBus.execute('booking.services.delete', {
      input: { id: parsed.id },
      ctx: context.ctx,
    })

    const serviceId = (result as { serviceId?: string | null } | null)?.serviceId ?? parsed.id
    const response = NextResponse.json({ id: serviceId })

    if (logEntry?.undoToken && logEntry?.id && logEntry?.commandId) {
      response.headers.set(
        'x-om-operation',
        serializeOperationMetadata({
          id: logEntry.id,
          undoToken: logEntry.undoToken,
          commandId: logEntry.commandId,
          actionLabel: logEntry.actionLabel ?? null,
          resourceKind: 'booking.service',
          resourceId: serviceId,
          executedAt: logEntry.createdAt instanceof Date ? logEntry.createdAt.toISOString() : undefined,
        }),
      )
    }

    return response
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    console.error('[booking.services.DELETE] Unexpected error', error)
    return NextResponse.json({ error: 'Failed to delete booking service' }, { status: 500 })
  }
}

