import { createRequestContainer } from '@/lib/di/container'
import { getAuthFromRequest } from '@/lib/auth/server'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { AwilixContainer } from 'awilix'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { createScopedApiHelpers } from '@open-mercato/shared/lib/api/scoped'

const DEFAULT_MESSAGES = {
  tenantRequired: { key: 'booking.errors.tenant_required', fallback: 'Tenant context is required.' },
  organizationRequired: { key: 'booking.errors.organization_required', fallback: 'Organization context is required.' },
}

export const bookingScopedHelpers = createScopedApiHelpers({ messages: DEFAULT_MESSAGES })

export type BookingRouteContext = {
  container: AwilixContainer
  ctx: CommandRuntimeContext
  em: EntityManager
  tenantId: string
  organizationIds: string[] | null
  translate: (key: string, fallback?: string) => string
}

export async function resolveBookingRouteContext(req: Request): Promise<BookingRouteContext> {
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

export function ensureOrganizationAccess(
  organizationId: string | null,
  accessibleIds: string[] | null,
): void {
  if (!organizationId || !accessibleIds || accessibleIds.length === 0) return
  if (!accessibleIds.includes(organizationId)) {
    throw new CrudHttpError(403, { error: 'Forbidden: organization not accessible' })
  }
}


