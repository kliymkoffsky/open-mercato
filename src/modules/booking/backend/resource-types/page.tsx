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

type ResourceTypeRow = {
  id: string
  name: string
  description?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

type ResourceTypeResponse = {
  items?: Array<Record<string, unknown>>
}

function parseResourceType(entry: Record<string, unknown>): ResourceTypeRow | null {
  const id = typeof entry.id === 'string' ? entry.id : null
  if (!id) return null
  return {
    id,
    name: typeof entry.name === 'string' ? entry.name : '—',
    description: typeof entry.description === 'string' ? entry.description : null,
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : typeof entry.created_at === 'string' ? entry.created_at : null,
    updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : typeof entry.updated_at === 'string' ? entry.updated_at : null,
  }
}

export default function BookingResourceTypesPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<ResourceTypeRow[]>([])
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

  const columns = React.useMemo<ColumnDef<ResourceTypeRow>[]>(() => [
    {
      accessorKey: 'name',
      header: t('booking.resourceTypes.columns.name', 'Resource type'),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'description',
      header: t('booking.resourceTypes.columns.description', 'Description'),
      cell: ({ row }) => row.original.description ?? '—',
    },
    {
      accessorKey: 'updatedAt',
      header: t('booking.resourceTypes.columns.updatedAt', 'Updated'),
      cell: ({ row }) => {
        const value = row.original.updatedAt ?? row.original.createdAt
        if (!value) return '—'
        const parsed = new Date(value)
        return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
      },
    },
  ], [t])

  const loadResourceTypes = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/booking/resource-types')
      const payload = await res.json().catch(() => ({})) as ResourceTypeResponse
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : t('booking.resourceTypes.flash.loadError', 'Failed to load resource types.')
        throw new Error(message)
      }
      const items = Array.isArray(payload.items) ? payload.items : []
      const mapped: ResourceTypeRow[] = []
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const parsed = parseResourceType(item as Record<string, unknown>)
        if (parsed) mapped.push(parsed)
      }
      setRows(mapped)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.resourceTypes.flash.loadError', 'Failed to load resource types.')
      setError(message)
      flash({ type: 'error', message })
    } finally {
      setIsLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    loadResourceTypes()
  }, [loadResourceTypes, scopeVersion, reloadToken])

  const handleDelete = React.useCallback(async (row: ResourceTypeRow) => {
    const confirmed = window.confirm(t('booking.resourceTypes.confirm.delete', 'Delete resource type “{{name}}”?', { name: row.name }))
    if (!confirmed) return
    try {
      const res = await apiFetch('/api/booking/resource-types', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : t('booking.resourceTypes.flash.deleteError', 'Failed to delete resource type.')
        throw new Error(message)
      }
      flash({ type: 'success', message: t('booking.resourceTypes.flash.deleted', 'Resource type deleted.') })
      setReloadToken((token) => token + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.resourceTypes.flash.deleteError', 'Failed to delete resource type.')
      flash({ type: 'error', message })
    }
  }, [t])

  const rowActions = React.useCallback((row: ResourceTypeRow) => (
    <RowActions
      items={[
        { label: t('common.edit', 'Edit'), href: `/backend/resource-types/${row.id}/edit` },
        { label: t('common.delete', 'Delete'), destructive: true, onSelect: () => handleDelete(row) },
      ]}
    />
  ), [handleDelete, t])

  return (
    <Page>
      <PageBody>
        <DataTable<ResourceTypeRow>
          title={t('booking.resourceTypes.title', 'Resource types')}
          data={filteredRows}
          columns={columns}
          isLoading={isLoading}
          error={error}
          rowActions={rowActions}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('booking.resourceTypes.search.placeholder', 'Search resource types...')}
          actions={(
            <Button asChild>
              <Link href="/backend/resource-types/create">
                {t('booking.resourceTypes.actions.create', 'New resource type')}
              </Link>
            </Button>
          )}
          refreshButton={{
            onRefresh: () => setReloadToken((token) => token + 1),
            label: t('booking.resourceTypes.actions.refresh', 'Refresh'),
            isRefreshing: isLoading,
          }}
          emptyState={t('booking.resourceTypes.empty', 'No resource types yet.')}
          onRowClick={(row) => router.push(`/backend/resource-types/${row.id}/edit`)}
        />
      </PageBody>
    </Page>
  )
}
