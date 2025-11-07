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

type TeamRoleRow = {
  id: string
  name: string
  description?: string | null
  updatedAt?: string | null
}

type TeamRoleResponse = {
  items?: Array<Record<string, unknown>>
}

function parseTeamRole(entry: Record<string, unknown>): TeamRoleRow | null {
  const id = typeof entry.id === 'string' ? entry.id : null
  if (!id) return null
  const updatedAt = typeof entry.updatedAt === 'string'
    ? entry.updatedAt
    : typeof entry.updated_at === 'string'
      ? entry.updated_at
      : null
  return {
    id,
    name: typeof entry.name === 'string' ? entry.name : '—',
    description: typeof entry.description === 'string' ? entry.description : null,
    updatedAt,
  }
}

export default function BookingTeamRolesPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<TeamRoleRow[]>([])
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)

  const filteredRows = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      row.name.toLowerCase().includes(needle) ||
      (row.description ?? '').toLowerCase().includes(needle),
    )
  }, [rows, search])

  const columns = React.useMemo<ColumnDef<TeamRoleRow>[]>(() => [
    {
      accessorKey: 'name',
      header: t('booking.teamRoles.columns.name', 'Role'),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'description',
      header: t('booking.teamRoles.columns.description', 'Description'),
      cell: ({ row }) => row.original.description ?? '—',
    },
    {
      accessorKey: 'updatedAt',
      header: t('booking.teamRoles.columns.updatedAt', 'Updated'),
      cell: ({ row }) => {
        if (!row.original.updatedAt) return '—'
        const parsed = new Date(row.original.updatedAt)
        return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
      },
    },
  ], [t])

  const loadTeamRoles = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/booking/team-roles')
      const payload = await res.json().catch(() => ({})) as TeamRoleResponse
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : t('booking.teamRoles.flash.loadError', 'Failed to load team roles.')
        throw new Error(message)
      }
      const items = Array.isArray(payload.items) ? payload.items : []
      const mapped: TeamRoleRow[] = []
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const parsed = parseTeamRole(item as Record<string, unknown>)
        if (parsed) mapped.push(parsed)
      }
      setRows(mapped)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.teamRoles.flash.loadError', 'Failed to load team roles.')
      setError(message)
      flash({ type: 'error', message })
    } finally {
      setIsLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    loadTeamRoles()
  }, [loadTeamRoles, scopeVersion, reloadToken])

  const handleDelete = React.useCallback(async (row: TeamRoleRow) => {
    const confirmed = window.confirm(t('booking.teamRoles.confirm.delete', 'Delete role “{{name}}”?', { name: row.name }))
    if (!confirmed) return
    try {
      const res = await apiFetch('/api/booking/team-roles', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : t('booking.teamRoles.flash.deleteError', 'Failed to delete team role.')
        throw new Error(message)
      }
      flash({ type: 'success', message: t('booking.teamRoles.flash.deleted', 'Role deleted.') })
      setReloadToken((token) => token + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.teamRoles.flash.deleteError', 'Failed to delete team role.')
      flash({ type: 'error', message })
    }
  }, [t])

  const rowActions = React.useCallback((row: TeamRoleRow) => (
    <RowActions
      items={[
        { label: t('common.edit', 'Edit'), href: `/backend/team-roles/${row.id}/edit` },
        { label: t('common.delete', 'Delete'), destructive: true, onSelect: () => handleDelete(row) },
      ]}
    />
  ), [handleDelete, t])

  return (
    <Page>
      <PageBody>
        <DataTable<TeamRoleRow>
          title={t('booking.teamRoles.title', 'Team roles')}
          data={filteredRows}
          columns={columns}
          isLoading={isLoading}
          error={error}
          rowActions={rowActions}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('booking.teamRoles.search.placeholder', 'Search roles...')}
          actions={(
            <Button asChild>
              <Link href="/backend/team-roles/create">
                {t('booking.teamRoles.actions.create', 'New role')}
              </Link>
            </Button>
          )}
          refreshButton={{
            onRefresh: () => setReloadToken((token) => token + 1),
            label: t('booking.teamRoles.actions.refresh', 'Refresh'),
            isRefreshing: isLoading,
          }}
          emptyState={t('booking.teamRoles.empty', 'No roles yet.')}
          onRowClick={(row) => router.push(`/backend/team-roles/${row.id}/edit`)}
        />
      </PageBody>
    </Page>
  )
}
