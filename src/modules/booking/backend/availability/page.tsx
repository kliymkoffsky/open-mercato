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

type AvailabilityRow = {
  id: string
  subjectType: string
  subjectId: string
  timezone: string
  rrule: string
  exdates: string[]
  updatedAt?: string | null
}

type AvailabilityResponse = {
  items?: Array<Record<string, unknown>>
}

function parseAvailability(entry: Record<string, unknown>): AvailabilityRow | null {
  const id = typeof entry.id === 'string' ? entry.id : null
  if (!id) return null
  const updatedAt = typeof entry.updatedAt === 'string'
    ? entry.updatedAt
    : typeof entry.updated_at === 'string'
      ? entry.updated_at
      : null
  const exdates = Array.isArray(entry.exdates)
    ? entry.exdates.filter((value): value is string => typeof value === 'string')
    : []
  return {
    id,
    subjectType: typeof entry.subjectType === 'string'
      ? entry.subjectType
      : typeof entry.subject_type === 'string'
        ? entry.subject_type
        : 'member',
    subjectId: typeof entry.subjectId === 'string'
      ? entry.subjectId
      : typeof entry.subject_id === 'string'
        ? entry.subject_id
        : '—',
    timezone: typeof entry.timezone === 'string' ? entry.timezone : 'UTC',
    rrule: typeof entry.rrule === 'string' ? entry.rrule : '—',
    exdates,
    updatedAt,
  }
}

export default function BookingAvailabilityPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<AvailabilityRow[]>([])
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)

  const filteredRows = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      row.subjectType.toLowerCase().includes(needle) ||
      row.subjectId.toLowerCase().includes(needle) ||
      row.timezone.toLowerCase().includes(needle),
    )
  }, [rows, search])

  const columns = React.useMemo<ColumnDef<AvailabilityRow>[]>(() => [
    {
      accessorKey: 'subjectType',
      header: t('booking.availability.columns.subjectType', 'Subject type'),
      cell: ({ row }) => row.original.subjectType,
    },
    {
      accessorKey: 'subjectId',
      header: t('booking.availability.columns.subjectId', 'Subject ID'),
      cell: ({ row }) => row.original.subjectId,
    },
    {
      accessorKey: 'timezone',
      header: t('booking.availability.columns.timezone', 'Timezone'),
      cell: ({ row }) => row.original.timezone,
    },
    {
      accessorKey: 'rrule',
      header: t('booking.availability.columns.rrule', 'Rule'),
      cell: ({ row }) => row.original.rrule,
    },
    {
      accessorKey: 'exdates',
      header: t('booking.availability.columns.exdates', 'Exceptions'),
      cell: ({ row }) => (row.original.exdates.length ? row.original.exdates.join(', ') : '—'),
    },
  ], [t])

  const loadAvailability = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/booking/availability')
      const payload = await res.json().catch(() => ({})) as AvailabilityResponse
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : t('booking.availability.flash.loadError', 'Failed to load availability rules.')
        throw new Error(message)
      }
      const items = Array.isArray(payload.items) ? payload.items : []
      const mapped: AvailabilityRow[] = []
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const parsed = parseAvailability(item as Record<string, unknown>)
        if (parsed) mapped.push(parsed)
      }
      setRows(mapped)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.availability.flash.loadError', 'Failed to load availability rules.')
      setError(message)
      flash({ type: 'error', message })
    } finally {
      setIsLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    loadAvailability()
  }, [loadAvailability, scopeVersion, reloadToken])

  const handleDelete = React.useCallback(async (row: AvailabilityRow) => {
    const confirmed = window.confirm(t('booking.availability.confirm.delete', 'Delete availability rule for {{subject}}?', { subject: row.subjectId }))
    if (!confirmed) return
    try {
      const res = await apiFetch('/api/booking/availability', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : t('booking.availability.flash.deleteError', 'Failed to delete availability rule.')
        throw new Error(message)
      }
      flash({ type: 'success', message: t('booking.availability.flash.deleted', 'Availability rule deleted.') })
      setReloadToken((token) => token + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.availability.flash.deleteError', 'Failed to delete availability rule.')
      flash({ type: 'error', message })
    }
  }, [t])

  const rowActions = React.useCallback((row: AvailabilityRow) => (
    <RowActions
      items={[
        { label: t('common.edit', 'Edit'), href: `/backend/availability/${row.id}/edit` },
        { label: t('common.delete', 'Delete'), destructive: true, onSelect: () => handleDelete(row) },
      ]}
    />
  ), [handleDelete, t])

  return (
    <Page>
      <PageBody>
        <DataTable<AvailabilityRow>
          title={t('booking.availability.title', 'Availability rules')}
          data={filteredRows}
          columns={columns}
          isLoading={isLoading}
          error={error}
          rowActions={rowActions}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('booking.availability.search.placeholder', 'Search availability...')}
          actions={(
            <Button asChild>
              <Link href="/backend/availability/create">
                {t('booking.availability.actions.create', 'New rule')}
              </Link>
            </Button>
          )}
          refreshButton={{
            onRefresh: () => setReloadToken((token) => token + 1),
            label: t('booking.availability.actions.refresh', 'Refresh'),
            isRefreshing: isLoading,
          }}
          emptyState={t('booking.availability.empty', 'No availability rules yet.')}
          onRowClick={(row) => router.push(`/backend/availability/${row.id}/edit`)}
        />
      </PageBody>
    </Page>
  )
}

