import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'

const SUPERADMIN_ROLE = 'superadmin'

export function isSuperAdmin(auth: CommandRuntimeContext['auth']): boolean {
  if (!auth) return false
  if ((auth as Record<string, unknown>).isSuperAdmin === true) return true
  const roles = Array.isArray(auth?.roles) ? auth.roles : []
  return roles.some((role) => typeof role === 'string' && role.trim().toLowerCase() === SUPERADMIN_ROLE)
}

export function enforceScope(
  ctx: CommandRuntimeContext,
  tenantId: string,
  organizationId: string | null,
): void {
  const auth = ctx.auth
  const superAdmin = isSuperAdmin(auth)
  if (!superAdmin && auth?.tenantId && auth.tenantId !== tenantId) {
    throw new CrudHttpError(403, { error: 'Forbidden: tenant scope mismatch' })
  }

  const allowedIds = ctx.organizationScope?.allowedIds
  if (!organizationId || superAdmin || !allowedIds || allowedIds.length === 0) {
    return
  }
  if (!allowedIds.includes(organizationId)) {
    throw new CrudHttpError(403, { error: 'Forbidden: organization scope mismatch' })
  }
}

