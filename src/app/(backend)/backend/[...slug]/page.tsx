import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { findBackendMatch } from '@open-mercato/shared/modules/registry'
import { modules } from '@/generated/modules.generated'
import { getAuthFromCookies } from '@/lib/auth/server'
import { ApplyBreadcrumb } from '@open-mercato/ui/backend/AppShell'
import { createRequestContainer } from '@/lib/di/container'
import { resolveFeatureCheckContext } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { RbacService } from '@open-mercato/core/modules/auth/services/rbacService'

type Awaitable<T> = T | Promise<T>

export default async function BackendCatchAll(props: { params: Awaitable<{ slug?: string[] }> }) {
  const params = await props.params
  const pathname = '/backend/' + (params.slug?.join('/') ?? '')
  console.log('🔍 [AUTH] Accessing:', pathname)
  
  const match = findBackendMatch(modules, pathname)
  if (!match) {
    console.log('❌ [AUTH] No route match found for:', pathname)
    return notFound()
  }
  
  console.log('✓ [AUTH] Route found:', {
    path: pathname,
    requireAuth: match.route.requireAuth,
    requireRoles: match.route.requireRoles,
    requireFeatures: match.route.requireFeatures,
  })
  
  if (match.route.requireAuth) {
    const auth = await getAuthFromCookies()
    if (!auth) {
      console.log('❌ [AUTH] No auth token found')
      // TEMPORARILY DISABLED - SHOW ERROR INSTEAD OF REDIRECT
      return (
        <div className="p-8 max-w-4xl mx-auto">
          <div className="border-l-4 border-orange-500 bg-orange-50 p-6">
            <h1 className="text-2xl font-bold text-orange-700 mb-4">🔒 Not Authenticated</h1>
            
            <p className="mb-4">You are not logged in. Please log in to access this page.</p>
            
            <div className="mb-4">
              <h2 className="font-semibold text-orange-900 mb-2">Requested Page:</h2>
              <div className="text-sm font-mono bg-white p-3 rounded">
                {pathname}
              </div>
            </div>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mt-4">
              <h3 className="font-bold text-yellow-900 mb-2">🔧 Possible Causes:</h3>
              <ol className="list-decimal list-inside text-sm space-y-1">
                <li>Your session expired</li>
                <li>You cleared your cookies</li>
                <li>You haven&apos;t logged in yet</li>
              </ol>
            </div>
            
            <div className="mt-4">
              <Link href="/login" className="inline-block bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700">
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      )
      // redirect('/api/auth/session/refresh?redirect=' + encodeURIComponent(pathname))
    }
    
    console.log('✓ [AUTH] User authenticated:', {
      userId: auth.sub,
      email: auth.email,
      roles: auth.roles,
      tenantId: auth.tenantId,
      orgId: auth.orgId,
    })
    
    const required = match.route.requireRoles || []
    if (required.length) {
      const roles = auth.roles || []
      const ok = required.some(r => roles.includes(r))
      console.log('🔒 [AUTH] Role check:', {
        required,
        userHas: roles,
        passed: ok,
      })
      if (!ok) {
        console.log('❌ [AUTH] Role check failed')
        // TEMPORARILY DISABLED - SHOW ERROR INSTEAD OF REDIRECT
        return (
          <div className="p-8 max-w-4xl mx-auto">
            <div className="border-l-4 border-red-500 bg-red-50 p-6">
              <h1 className="text-2xl font-bold text-red-700 mb-4">🚫 Access Denied - Role Check Failed</h1>
              
              <div className="mb-4">
                <h2 className="font-semibold text-red-900 mb-2">Required Roles:</h2>
                <ul className="list-disc list-inside text-sm font-mono bg-white p-3 rounded">
                  {required.map(r => <li key={r} className="text-red-600">{r}</li>)}
                </ul>
              </div>
              
              <div className="mb-4">
                <h2 className="font-semibold text-red-900 mb-2">Your Roles:</h2>
                <div className="text-sm font-mono bg-white p-3 rounded">
                  {roles.length > 0 ? (
                    <ul className="list-disc list-inside">
                      {roles.map((r, i) => (
                        <li key={i} className={required.includes(r) ? 'text-green-600' : ''}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-red-600">No roles assigned!</p>
                  )}
                </div>
              </div>
              
              <div className="mb-4">
                <h2 className="font-semibold text-red-900 mb-2">User Info:</h2>
                <div className="text-sm font-mono bg-white p-3 rounded space-y-1">
                  <div>Email: {auth.email}</div>
                  <div>User ID: {auth.sub}</div>
                  <div>Tenant ID: {auth.tenantId}</div>
                  <div>Org ID: {auth.orgId}</div>
                </div>
              </div>
              
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mt-4">
                <h3 className="font-bold text-yellow-900 mb-2">🔧 How to Fix:</h3>
                <ol className="list-decimal list-inside text-sm space-y-1">
                  <li>Check if you have the required role(s) in &quot;Your Roles&quot; above</li>
                  <li>If missing, your user account needs to be assigned the {required.join(' or ')} role</li>
                  <li>Contact an administrator or check the database</li>
                </ol>
              </div>
              
              <div className="mt-4">
                <Link href="/login" className="inline-block bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                  Go to Login
                </Link>
                <Link href="/debug-features" className="ml-2 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  Debug Features Page
                </Link>
              </div>
            </div>
          </div>
        )
        // redirect('/login?requireRole=' + encodeURIComponent(required.join(',')))
      }
    }
    
    const features = match.route.requireFeatures
    if (features && features.length) {
      console.log('🔒 [AUTH] Checking features:', features)
      
      const container = await createRequestContainer()
      const rbac = container.resolve('rbacService') as RbacService
      let organizationIdForCheck: string | null = auth.orgId ?? null
      const cookieStore = await cookies()
      const cookieSelected = cookieStore.get('om_selected_org')?.value ?? null
      let tenantIdForCheck: string | null = auth.tenantId ?? null
      
      try {
        const { organizationId, allowedOrganizationIds, scope } = await resolveFeatureCheckContext({ container, auth, selectedId: cookieSelected })
        organizationIdForCheck = organizationId
        tenantIdForCheck = scope.tenantId ?? auth.tenantId ?? null
        console.log('✓ [AUTH] Feature check context resolved:', {
          organizationId,
          allowedOrganizationIds,
          tenantId: tenantIdForCheck,
        })
        
        if (Array.isArray(allowedOrganizationIds) && allowedOrganizationIds.length === 0) {
          console.log('❌ [AUTH] No allowed organizations, redirecting')
          redirect('/login?requireFeature=' + encodeURIComponent(features.join(',')))
        }
      } catch (err) {
        console.error('⚠️ [AUTH] Error resolving feature check context:', err)
        organizationIdForCheck = auth.orgId ?? null
        tenantIdForCheck = auth.tenantId ?? null
      }
      
      // Load the user's ACL to see what features they actually have
      const acl = await rbac.loadAcl(auth.sub, { tenantId: tenantIdForCheck, organizationId: organizationIdForCheck })
      console.log('📋 [AUTH] User ACL loaded:', {
        isSuperAdmin: acl.isSuperAdmin,
        featureCount: acl.features.length,
        bookingFeatures: acl.features.filter(f => f.includes('booking')),
        allFeatures: acl.features.slice(0, 20), // First 20 for brevity
      })
      
      const ok = await rbac.userHasAllFeatures(auth.sub, features, { tenantId: tenantIdForCheck, organizationId: organizationIdForCheck })
      console.log('🔒 [AUTH] Feature check result:', {
        required: features,
        passed: ok,
        context: { tenantId: tenantIdForCheck, organizationId: organizationIdForCheck },
      })
      
      if (!ok) {
        console.log('❌ [AUTH] Feature check FAILED - User does not have required features:', features)
        console.log('💡 [AUTH] TIP: User may need to log out and log back in to refresh token with new features')
        
        // TEMPORARILY DISABLED - SHOW ERROR INSTEAD OF REDIRECT
        return (
          <div className="p-8 max-w-4xl mx-auto">
            <div className="border-l-4 border-red-500 bg-red-50 p-6">
              <h1 className="text-2xl font-bold text-red-700 mb-4">🚫 Access Denied - Feature Check Failed</h1>
              
              <div className="mb-4">
                <h2 className="font-semibold text-red-900 mb-2">Required Features:</h2>
                <ul className="list-disc list-inside text-sm font-mono bg-white p-3 rounded">
                  {features.map(f => <li key={f} className="text-red-600">{f}</li>)}
                </ul>
              </div>
              
              <div className="mb-4">
                <h2 className="font-semibold text-red-900 mb-2">Your Features:</h2>
                <div className="text-sm font-mono bg-white p-3 rounded max-h-60 overflow-auto">
                  {acl.features.length > 0 ? (
                    <ul className="list-disc list-inside">
                      {acl.features.sort().map((f, i) => (
                        <li key={i} className={features.includes(f) ? 'text-green-600' : ''}>
                          {f}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-red-600">No features found!</p>
                  )}
                </div>
                <p className="text-xs mt-2 text-gray-600">Total: {acl.features.length} features</p>
              </div>
              
              <div className="mb-4">
                <h2 className="font-semibold text-red-900 mb-2">Booking Features You Have:</h2>
                <div className="text-sm font-mono bg-white p-3 rounded">
                  {acl.features.filter(f => f.includes('booking')).length > 0 ? (
                    <ul className="list-disc list-inside">
                      {acl.features.filter(f => f.includes('booking')).map((f, i) => (
                        <li key={i} className="text-green-600">{f}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-red-600 font-bold">❌ No booking features found!</p>
                  )}
                </div>
              </div>
              
              <div className="mb-4">
                <h2 className="font-semibold text-red-900 mb-2">User Info:</h2>
                <div className="text-sm font-mono bg-white p-3 rounded space-y-1">
                  <div>Email: {auth.email}</div>
                  <div>User ID: {auth.sub}</div>
                  <div>Roles: {auth.roles?.join(', ') || 'none'}</div>
                  <div>Super Admin: {acl.isSuperAdmin ? 'Yes' : 'No'}</div>
                  <div>Tenant ID: {tenantIdForCheck}</div>
                  <div>Org ID: {organizationIdForCheck}</div>
                </div>
              </div>
              
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mt-4">
                <h3 className="font-bold text-yellow-900 mb-2">🔧 How to Fix:</h3>
                <ol className="list-decimal list-inside text-sm space-y-1">
                  <li>Check if <code className="bg-yellow-100 px-1">booking.*</code> or specific booking features appear in &quot;Your Features&quot; above</li>
                  <li><strong>If missing:</strong> Log out and log back in to refresh your token</li>
                  <li>Or clear your cookies (auth_token, session_token) and log back in</li>
                  <li>The admin role should have <code className="bg-yellow-100 px-1">booking.*</code> wildcard</li>
                </ol>
              </div>
              
              <div className="mt-4">
                <Link href="/login" className="inline-block bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                  Go to Login
                </Link>
                <Link href="/debug-features" className="ml-2 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  Debug Features Page
                </Link>
              </div>
            </div>
          </div>
        )
        // redirect('/login?requireFeature=' + encodeURIComponent(features.join(',')))
      }
      
      console.log('✅ [AUTH] All checks passed!')
    }
  }
  
  const Component = match.route.Component
  return (
    <>
      <ApplyBreadcrumb breadcrumb={match.route.breadcrumb} title={match.route.title} titleKey={match.route.titleKey} />
      <Component params={match.params} />
    </>
  )
}

export const dynamic = 'force-dynamic'
