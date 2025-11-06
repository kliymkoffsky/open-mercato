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

type ServiceRow = {
  id: string
  name: string
  description?: string | null
  durationMinutes: number
  capacityModel: string
  maxAttendees?: number | null
  isActive: boolean
  updatedAt?: string | null
}

type ServicesResponse = {
  items?: Array<Record<string, unknown>>
}

function parseService(item: Record<string, unknown>): ServiceRow | null {
  const id = typeof item.id === 'string' ? item.id : null
  if (!id) return null
  const name = typeof item.name === 'string' ? item.name : '—'
  const description = typeof item.description === 'string' ? item.description : null
  const durationMinutes = typeof item.durationMinutes === 'number'
    ? item.durationMinutes
    : typeof item.duration_minutes === 'number'
      ? item.duration_minutes
      : 0
  const capacityModel = typeof item.capacityModel === 'string'
    ? item.capacityModel
    : typeof item.capacity_model === 'string'
      ? item.capacity_model
      : 'one_to_one'
  const maxAttendees = typeof item.maxAttendees === 'number'
    ? item.maxAttendees
    : typeof item.max_attendees === 'number'
      ? item.max_attendees
      : null
  const isActive = typeof item.isActive === 'boolean'
    ? item.isActive
    : typeof item.is_active === 'boolean'
      ? item.is_active
      : true
  const updatedAt = typeof item.updatedAt === 'string'
    ? item.updatedAt
    : typeof item.updated_at === 'string'
      ? item.updated_at
      : null

  return {
    id,
    name,
    description,
    durationMinutes,
    capacityModel,
    maxAttendees,
    isActive,
    updatedAt,
  }
}

export default function BookingServicesPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<ServiceRow[]>([])
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)

  const filteredRows = React.useMemo(() => {
    const trimmed = search.trim().toLowerCase()
    if (!trimmed) return rows
    return rows.filter((row) =>
      row.name.toLowerCase().includes(trimmed) ||
      (row.description ?? '').toLowerCase().includes(trimmed),
    )
  }, [rows, search])

  const columns = React.useMemo<ColumnDef<ServiceRow>[]>(() => [
    {
      accessorKey: 'name',
      header: t('booking.services.columns.name', 'Service'),
      cell: ({ row }) => (
        <div className="font-medium">{row.original.name}</div>
      ),
    },
    {
      accessorKey: 'capacityModel',
      header: t('booking.services.columns.capacityModel', 'Capacity'),
      cell: ({ row }) => row.original.capacityModel.replace(/_/g, ' '),
    },
    {
      accessorKey: 'durationMinutes',
      header: t('booking.services.columns.duration', 'Duration (min)'),
      cell: ({ row }) => row.original.durationMinutes,
    },
    {
      accessorKey: 'maxAttendees',
      header: t('booking.services.columns.maxAttendees', 'Max attendees'),
      cell: ({ row }) => row.original.maxAttendees ?? '—',
    },
    {
      accessorKey: 'updatedAt',
      header: t('booking.services.columns.updatedAt', 'Updated'),
      cell: ({ row }) => {
        if (!row.original.updatedAt) return '—'
        const date = new Date(row.original.updatedAt)
        if (Number.isNaN(date.getTime())) return '—'
        return date.toLocaleString()
      },
    },
    {
      accessorKey: 'isActive',
      header: t('booking.services.columns.active', 'Active'),
      cell: ({ row }) => (row.original.isActive ? t('common.yes', 'Yes') : t('common.no', 'No')),
    },
  ], [t])

  const loadServices = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/booking/services')
      const payload = await res.json().catch(() => ({})) as ServicesResponse
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : t('booking.services.flash.loadError', 'Failed to load services.')
        throw new Error(message)
      }
      const items = Array.isArray(payload?.items) ? payload.items : []
      const mapped: ServiceRow[] = []
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const parsed = parseService(item as Record<string, unknown>)
        if (parsed) mapped.push(parsed)
      }
      setRows(mapped)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.services.flash.loadError', 'Failed to load services.')
      setError(message)
      flash({ type: 'error', message })
    } finally {
      setIsLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    loadServices()
  }, [loadServices, scopeVersion, reloadToken])

  const handleDelete = React.useCallback(async (row: ServiceRow) => {
    const confirmed = window.confirm(t('booking.services.confirm.delete', 'Delete service “{{name}}”?', { name: row.name }))
    if (!confirmed) return
    try {
      const res = await apiFetch('/api/booking/services', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : t('booking.services.flash.deleteError', 'Failed to delete service.')
        throw new Error(message)
      }
      flash({ type: 'success', message: t('booking.services.flash.deleted', 'Service deleted.') })
      setReloadToken((token) => token + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.services.flash.deleteError', 'Failed to delete service.')
      flash({ type: 'error', message })
    }
  }, [t])

  const rowActions = React.useCallback((row: ServiceRow) => (
    <RowActions
      items={[
        { label: t('common.edit', 'Edit'), href: `/backend/services/${row.id}/edit` },
        { label: t('common.delete', 'Delete'), destructive: true, onSelect: () => handleDelete(row) },
      ]}
    />
  ), [handleDelete, t])

  return (
    <Page>
      <PageBody>
        <DataTable<ServiceRow>
          title={t('booking.services.title', 'Booking services')}
          data={filteredRows}
          columns={columns}
          isLoading={isLoading}
          error={error}
          rowActions={rowActions}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('booking.services.search.placeholder', 'Search services...')}
          actions={(
            <Button asChild>
              <Link href="/backend/services/create">
                {t('booking.services.actions.create', 'New service')}
              </Link>
            </Button>
          )}
          refreshButton={{
            onRefresh: () => setReloadToken((token) => token + 1),
            label: t('booking.services.actions.refresh', 'Refresh'),
            isRefreshing: isLoading,
          }}
          emptyState={t('booking.services.empty', 'No services yet.')}
          onRowClick={(row) => router.push(`/backend/services/${row.id}/edit`)}
        />
      </PageBody>
    </Page>
  )
}

