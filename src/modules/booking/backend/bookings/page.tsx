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

type BookingRow = {
  id: string
  title: string
  serviceName?: string | null
  startsAt?: string | null
  endsAt?: string | null
  status: string
  attendeeCount: number
  memberCount: number
}

type BookingResponse = {
  items?: Array<Record<string, unknown>>
}

function parseBooking(entry: Record<string, unknown>): BookingRow | null {
  const id = typeof entry.id === 'string' ? entry.id : null
  if (!id) return null
  const attendees = Array.isArray(entry.attendees) ? entry.attendees : []
  const members = Array.isArray(entry.members) ? entry.members : []
  return {
    id,
    title: typeof entry.title === 'string' ? entry.title : '—',
    serviceName: typeof entry.serviceName === 'string' ? entry.serviceName : typeof entry.service_name === 'string' ? entry.service_name : null,
    startsAt: typeof entry.startsAt === 'string' ? entry.startsAt : typeof entry.starts_at === 'string' ? entry.starts_at : null,
    endsAt: typeof entry.endsAt === 'string' ? entry.endsAt : typeof entry.ends_at === 'string' ? entry.ends_at : null,
    status: typeof entry.status === 'string' ? entry.status : 'draft',
    attendeeCount: attendees.length,
    memberCount: members.length,
  }
}

export default function BookingEventsPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<BookingRow[]>([])
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)

  const filteredRows = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      row.title.toLowerCase().includes(needle) ||
      (row.serviceName ?? '').toLowerCase().includes(needle) ||
      row.status.toLowerCase().includes(needle),
    )
  }, [rows, search])

  const columns = React.useMemo<ColumnDef<BookingRow>[]>(() => [
    {
      accessorKey: 'title',
      header: t('booking.events.columns.title', 'Booking'),
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
    },
    {
      accessorKey: 'serviceName',
      header: t('booking.events.columns.service', 'Service'),
      cell: ({ row }) => row.original.serviceName ?? '—',
    },
    {
      accessorKey: 'startsAt',
      header: t('booking.events.columns.startsAt', 'Start'),
      cell: ({ row }) => {
        const startsAt = row.original.startsAt
        if (!startsAt) return '—'
        const parsed = new Date(startsAt)
        return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
      },
    },
    {
      accessorKey: 'status',
      header: t('booking.events.columns.status', 'Status'),
      cell: ({ row }) => row.original.status,
    },
    {
      accessorKey: 'attendeeCount',
      header: t('booking.events.columns.attendees', 'Attendees'),
      cell: ({ row }) => row.original.attendeeCount,
    },
    {
      accessorKey: 'memberCount',
      header: t('booking.events.columns.members', 'Team'),
      cell: ({ row }) => row.original.memberCount,
    },
  ], [t])

  const loadBookings = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/booking/bookings')
      const payload = await res.json().catch(() => ({})) as BookingResponse
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : t('booking.events.flash.loadError', 'Failed to load bookings.')
        throw new Error(message)
      }
      const items = Array.isArray(payload.items) ? payload.items : []
      const mapped: BookingRow[] = []
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const parsed = parseBooking(item as Record<string, unknown>)
        if (parsed) mapped.push(parsed)
      }
      setRows(mapped)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.events.flash.loadError', 'Failed to load bookings.')
      setError(message)
      flash(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    loadBookings()
  }, [loadBookings, scopeVersion, reloadToken])

  const handleDelete = React.useCallback(async (row: BookingRow) => {
    const confirmed = window.confirm(t('booking.events.confirm.delete', 'Delete booking “{{title}}”?', { title: row.title }))
    if (!confirmed) return
    try {
      const res = await apiFetch('/api/booking/bookings', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : t('booking.events.flash.deleteError', 'Failed to delete booking.')
        throw new Error(message)
      }
      flash(t('booking.events.flash.deleted', 'Booking deleted.'), 'success')
      setReloadToken((token) => token + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.events.flash.deleteError', 'Failed to delete booking.')
      flash(message, 'error')
    }
  }, [t])

  const rowActions = React.useCallback((row: BookingRow) => (
    <RowActions
      items={[
        { label: t('common.edit', 'Edit'), href: `/backend/bookings/${row.id}/edit` },
        { label: t('common.delete', 'Delete'), destructive: true, onSelect: () => handleDelete(row) },
      ]}
    />
  ), [handleDelete, t])

  return (
    <Page>
      <PageBody>
        <DataTable<BookingRow>
          title={t('booking.events.title', 'Bookings')}
          data={filteredRows}
          columns={columns}
          isLoading={isLoading}
          error={error}
          rowActions={rowActions}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('booking.events.search.placeholder', 'Search bookings...')}
          actions={(
            <>
              <Button variant="outline" asChild>
                <Link href="/backend/bookings/calendar">
                  {t('booking.events.actions.calendar', 'Calendar view')}
                </Link>
              </Button>
              <Button asChild>
                <Link href="/backend/bookings/create">
                  {t('booking.events.actions.create', 'New booking')}
                </Link>
              </Button>
            </>
          )}
          refreshButton={{
            onRefresh: () => setReloadToken((token) => token + 1),
            label: t('booking.events.actions.refresh', 'Refresh'),
            isRefreshing: isLoading,
          }}
          emptyState={t('booking.events.empty', 'No bookings yet.')}
          onRowClick={(row) => router.push(`/backend/bookings/${row.id}/edit`)}
        />
      </PageBody>
    </Page>
  )
}

