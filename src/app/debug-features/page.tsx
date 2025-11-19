import { getAuthFromCookies } from '@/lib/auth/server'
import { createRequestContainer } from '@/lib/di/container'
import type { RbacService } from '@open-mercato/core/modules/auth/services/rbacService'

export default async function DebugFeaturesPage() {
  const auth = await getAuthFromCookies()
  
  if (!auth) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Debug: Features Check</h1>
        <p className="text-red-500">No authentication found</p>
      </div>
    )
  }

  const container = await createRequestContainer()
  const rbac = container.resolve('rbacService') as RbacService
  
  const acl = await rbac.loadAcl(auth.sub, {
    tenantId: auth.tenantId ?? null,
    organizationId: auth.orgId ?? null,
  })

  const bookingFeatures = [
    'booking.view',
    'booking.create',
    'booking.edit',
    'booking.delete',
    'booking.services.manage',
    'booking.resources.manage',
    'booking.members.manage',
  ]

  const checks = await Promise.all(
    bookingFeatures.map(async (feature) => {
      const has = await rbac.userHasAllFeatures(auth.sub, [feature], {
        tenantId: auth.tenantId ?? null,
        organizationId: auth.orgId ?? null,
      })
      return { feature, has }
    })
  )

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Debug: Features Check</h1>
      
      <div className="mb-6 p-4 border rounded bg-gray-50">
        <h2 className="font-semibold mb-2">Auth Info</h2>
        <div className="text-sm space-y-1 font-mono">
          <div>User ID: {auth.sub}</div>
          <div>Email: {auth.email}</div>
          <div>Tenant ID: {auth.tenantId ?? 'null'}</div>
          <div>Org ID: {auth.orgId ?? 'null'}</div>
          <div>Roles: {auth.roles?.join(', ') || 'none'}</div>
        </div>
      </div>

      <div className="mb-6 p-4 border rounded bg-gray-50">
        <h2 className="font-semibold mb-2">ACL Info</h2>
        <div className="text-sm space-y-1 font-mono">
          <div>Super Admin: {acl.isSuperAdmin ? 'Yes' : 'No'}</div>
          <div>Total Features: {acl.features.length}</div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-semibold mb-2">All Features ({acl.features.length})</h2>
        <div className="p-4 border rounded bg-white text-xs font-mono max-h-60 overflow-auto">
          {acl.features.sort().map((f, i) => (
            <div key={i} className={f.includes('booking') ? 'text-green-600 font-bold' : ''}>
              {f}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Booking Feature Checks</h2>
        <table className="w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left border">Feature</th>
              <th className="p-2 text-left border">Has Access</th>
            </tr>
          </thead>
          <tbody>
            {checks.map(({ feature, has }) => (
              <tr key={feature}>
                <td className="p-2 border font-mono text-sm">{feature}</td>
                <td className={`p-2 border font-bold ${has ? 'text-green-600' : 'text-red-600'}`}>
                  {has ? '✓ YES' : '✗ NO'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 border-l-4 border-blue-500 bg-blue-50">
        <p className="text-sm">
          <strong>Tip:</strong> If you don't see booking.* in your features list, you need to:
        </p>
        <ol className="text-sm mt-2 ml-4 list-decimal space-y-1">
          <li>Log out (clear your session)</li>
          <li>Log back in (to get a fresh token with updated features)</li>
          <li>Or restart your browser to clear cookies</li>
        </ol>
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'


