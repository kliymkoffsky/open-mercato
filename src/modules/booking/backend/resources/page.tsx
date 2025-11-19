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

type ResourceRow = {
  id: string
  name: string
  resourceTypeId?: string | null
  resourceTypeName?: string | null
  capacity?: number | null
  isActive: boolean
  tags: string[]
  updatedAt?: string | null
}

type ResourceResponse = {
  items?: Array<Record<string, unknown>>
}

function parseResource(entry: Record<string, unknown>, typeMap: Map<string, string>): ResourceRow | null {
  const id = typeof entry.id === 'string' ? entry.id : null
  if (!id) return null
  const resourceTypeId = typeof entry.resourceTypeId === 'string'
    ? entry.resourceTypeId
    : typeof entry.resource_type_id === 'string'
      ? entry.resource_type_id
      : null
  const tags = Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === 'string') : []
  const updatedAt = typeof entry.updatedAt === 'string'
    ? entry.updatedAt
    : typeof entry.updated_at === 'string'
      ? entry.updated_at
      : null
  return {
    id,
    name: typeof entry.name === 'string' ? entry.name : '—',
    resourceTypeId,
    resourceTypeName: resourceTypeId ? typeMap.get(resourceTypeId) ?? null : null,
    capacity: typeof entry.capacity === 'number' ? entry.capacity : null,
    isActive: typeof entry.isActive === 'boolean' ? entry.isActive : Boolean(entry.is_active ?? true),
    tags,
    updatedAt,
  }
}

async function fetchResourceTypeMap(): Promise<Map<string, string>> {
  try {
    const res = await apiFetch('/api/booking/resource-types')
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) return new Map()
    const items = Array.isArray(payload?.items) ? payload.items : []
    const map = new Map<string, string>()
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

export default function BookingResourcesPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<ResourceRow[]>([])
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)

  const filteredRows = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      row.name.toLowerCase().includes(needle) ||
      (row.resourceTypeName ?? '').toLowerCase().includes(needle),
    )
  }, [rows, search])

  const columns = React.useMemo<ColumnDef<ResourceRow>[]>(() => [
    {
      accessorKey: 'name',
      header: t('booking.resources.columns.name', 'Resource'),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'resourceTypeName',
      header: t('booking.resources.columns.type', 'Type'),
      cell: ({ row }) => row.original.resourceTypeName ?? '—',
    },
    {
      accessorKey: 'capacity',
      header: t('booking.resources.columns.capacity', 'Capacity'),
      cell: ({ row }) => row.original.capacity ?? '—',
    },
    {
      accessorKey: 'tags',
      header: t('booking.resources.columns.tags', 'Tags'),
      cell: ({ row }) => (row.original.tags.length ? row.original.tags.join(', ') : '—'),
    },
    {
      accessorKey: 'isActive',
      header: t('booking.resources.columns.active', 'Active'),
      cell: ({ row }) => (row.original.isActive ? t('common.yes', 'Yes') : t('common.no', 'No')),
    },
  ], [t])

  const loadResources = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [typeMap, res] = await Promise.all([
        fetchResourceTypeMap(),
        apiFetch('/api/booking/resources'),
      ])
      const payload = await res.json().catch(() => ({})) as ResourceResponse
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : t('booking.resources.flash.loadError', 'Failed to load resources.')
        throw new Error(message)
      }
      const items = Array.isArray(payload.items) ? payload.items : []
      const mapped: ResourceRow[] = []
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const parsed = parseResource(item as Record<string, unknown>, typeMap)
        if (parsed) mapped.push(parsed)
      }
      setRows(mapped)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.resources.flash.loadError', 'Failed to load resources.')
      setError(message)
      flash({ type: 'error', message })
    } finally {
      setIsLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    loadResources()
  }, [loadResources, scopeVersion, reloadToken])

  const handleDelete = React.useCallback(async (row: ResourceRow) => {
    const confirmed = window.confirm(t('booking.resources.confirm.delete', 'Delete resource “{{name}}”?', { name: row.name }))
    if (!confirmed) return
    try {
      const res = await apiFetch('/api/booking/resources', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : t('booking.resources.flash.deleteError', 'Failed to delete resource.')
        throw new Error(message)
      }
      flash({ type: 'success', message: t('booking.resources.flash.deleted', 'Resource deleted.') })
      setReloadToken((token) => token + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.resources.flash.deleteError', 'Failed to delete resource.')
      flash({ type: 'error', message })
    }
  }, [t])

  const rowActions = React.useCallback((row: ResourceRow) => (
    <RowActions
      items={[
        { label: t('common.edit', 'Edit'), href: `/backend/resources/${row.id}/edit` },
        { label: t('common.delete', 'Delete'), destructive: true, onSelect: () => handleDelete(row) },
      ]}
    />
  ), [handleDelete, t])

  return (
    <Page>
      <PageBody>
        <DataTable<ResourceRow>
          title={t('booking.resources.title', 'Resources')}
          data={filteredRows}
          columns={columns}
          isLoading={isLoading}
          error={error}
          rowActions={rowActions}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('booking.resources.search.placeholder', 'Search resources...')}
          actions={(
            <Button asChild>
              <Link href="/backend/resources/create">
                {t('booking.resources.actions.create', 'New resource')}
              </Link>
            </Button>
          )}
          refreshButton={{
            onRefresh: () => setReloadToken((token) => token + 1),
            label: t('booking.resources.actions.refresh', 'Refresh'),
            isRefreshing: isLoading,
          }}
          emptyState={t('booking.resources.empty', 'No resources yet.')}
          onRowClick={(row) => router.push(`/backend/resources/${row.id}/edit`)}
        />
      </PageBody>
    </Page>
  )
}

