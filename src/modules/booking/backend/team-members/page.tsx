"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@/lib/frontend/useOrganizationScope'
import { useT } from '@/lib/i18n/context'

type TeamMemberRow = {
  id: string
  displayName: string
  roleIds: string[]
  roleNames: string[]
  isActive: boolean
  tags: string[]
  updatedAt?: string | null
}

type TeamMemberResponse = {
  items?: Array<Record<string, unknown>>
}

type TeamRoleMap = Map<string, string>

async function fetchRoleMap(): Promise<TeamRoleMap> {
  try {
    const res = await apiFetch('/api/booking/team-roles')
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) return new Map()
    const map = new Map<string, string>()
    const items = Array.isArray(payload?.items) ? payload.items : []
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      const id = typeof (item as any).id === 'string' ? (item as any).id : null
      const name = typeof (item as any).name === 'string' ? (item as any).name : null
      if (id && name) map.set(id, name)
    }
    return map
  } catch {
    return new Map()
  }
}

function parseTeamMember(entry: Record<string, unknown>, roleMap: TeamRoleMap): TeamMemberRow | null {
  const id = typeof entry.id === 'string' ? entry.id : null
  if (!id) return null
  const roleIds = Array.isArray(entry.roleIds)
    ? entry.roleIds.filter((r): r is string => typeof r === 'string')
    : Array.isArray((entry as any).role_ids)
      ? (entry as any).role_ids.filter((r: unknown): r is string => typeof r === 'string')
      : []
  const updatedAt = typeof entry.updatedAt === 'string'
    ? entry.updatedAt
    : typeof entry.updated_at === 'string'
      ? entry.updated_at
      : null
  return {
    id,
    displayName: typeof entry.displayName === 'string'
      ? entry.displayName
      : typeof entry.display_name === 'string'
        ? entry.display_name
        : '—',
    roleIds,
    roleNames: roleIds.map((roleId) => roleMap.get(roleId) ?? roleId),
    isActive: typeof entry.isActive === 'boolean' ? entry.isActive : Boolean(entry.is_active ?? true),
    tags: Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    updatedAt,
  }
}

export default function BookingTeamMembersPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<TeamMemberRow[]>([])
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)

  const filteredRows = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      row.displayName.toLowerCase().includes(needle) ||
      row.roleNames.some((name) => name.toLowerCase().includes(needle)),
    )
  }, [rows, search])

  const columns = React.useMemo<ColumnDef<TeamMemberRow>[]>(() => [
    {
      accessorKey: 'displayName',
      header: t('booking.teamMembers.columns.name', 'Member'),
      cell: ({ row }) => <span className="font-medium">{row.original.displayName}</span>,
    },
    {
      accessorKey: 'roleNames',
      header: t('booking.teamMembers.columns.roles', 'Roles'),
      cell: ({ row }) => (row.original.roleNames.length ? row.original.roleNames.join(', ') : '—'),
    },
    {
      accessorKey: 'tags',
      header: t('booking.teamMembers.columns.tags', 'Tags'),
      cell: ({ row }) => (row.original.tags.length ? row.original.tags.join(', ') : '—'),
    },
    {
      accessorKey: 'isActive',
      header: t('booking.teamMembers.columns.active', 'Active'),
      cell: ({ row }) => (row.original.isActive ? t('common.yes', 'Yes') : t('common.no', 'No')),
    },
  ], [t])

  const loadTeamMembers = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [roleMap, res] = await Promise.all([
        fetchRoleMap(),
        apiFetch('/api/booking/team-members'),
      ])
      const payload = await res.json().catch(() => ({})) as TeamMemberResponse
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : t('booking.teamMembers.flash.loadError', 'Failed to load team members.')
        throw new Error(message)
      }
      const items = Array.isArray(payload.items) ? payload.items : []
      const mapped: TeamMemberRow[] = []
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const parsed = parseTeamMember(item as Record<string, unknown>, roleMap)
        if (parsed) mapped.push(parsed)
      }
      setRows(mapped)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.teamMembers.flash.loadError', 'Failed to load team members.')
      setError(message)
      flash({ type: 'error', message })
    } finally {
      setIsLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    loadTeamMembers()
  }, [loadTeamMembers, scopeVersion, reloadToken])

  const handleDelete = React.useCallback(async (row: TeamMemberRow) => {
    const confirmed = window.confirm(t('booking.teamMembers.confirm.delete', 'Delete member “{{name}}”?', { name: row.displayName }))
    if (!confirmed) return
    try {
      const res = await apiFetch('/api/booking/team-members', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : t('booking.teamMembers.flash.deleteError', 'Failed to delete team member.')
        throw new Error(message)
      }
      flash({ type: 'success', message: t('booking.teamMembers.flash.deleted', 'Member deleted.') })
      setReloadToken((token) => token + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.teamMembers.flash.deleteError', 'Failed to delete team member.')
      flash({ type: 'error', message })
    }
  }, [t])

  const rowActions = React.useCallback((row: TeamMemberRow) => (
    <RowActions
      items={[
        { label: t('common.edit', 'Edit'), href: `/backend/team-members/${row.id}/edit` },
        { label: t('common.delete', 'Delete'), destructive: true, onSelect: () => handleDelete(row) },
      ]}
    />
  ), [handleDelete, t])

  return (
    <Page>
      <PageBody>
        <DataTable<TeamMemberRow>
          title={t('booking.teamMembers.title', 'Team members')}
          data={filteredRows}
          columns={columns}
          isLoading={isLoading}
          error={error}
          rowActions={rowActions}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('booking.teamMembers.search.placeholder', 'Search members...')}
          actions={(
            <Button asChild>
              <Link href="/backend/team-members/create">
                {t('booking.teamMembers.actions.create', 'Add member')}
              </Link>
            </Button>
          )}
          refreshButton={{
            onRefresh: () => setReloadToken((token) => token + 1),
            label: t('booking.teamMembers.actions.refresh', 'Refresh'),
            isRefreshing: isLoading,
          }}
          emptyState={t('booking.teamMembers.empty', 'No team members yet.')}
          onRowClick={(row) => router.push(`/backend/team-members/${row.id}/edit`)}
        />
      </PageBody>
    </Page>
  )
}
