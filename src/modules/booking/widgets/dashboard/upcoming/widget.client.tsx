"use client"

import * as React from 'react'
import type { DashboardWidgetComponentProps } from '@open-mercato/shared/modules/dashboard/widgets'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import clsx from 'clsx'
import { DEFAULT_SETTINGS, hydrateUpcomingSettings, type BookingUpcomingSettings } from './config'

type UpcomingBooking = {
  id: string
  title: string
  serviceName?: string | null
  startsAt?: string | null
  status: string
}

type ApiResponse = {
  items?: Array<Record<string, unknown>>
}

function parseUpcoming(record: Record<string, unknown>): UpcomingBooking | null {
  const id = typeof record.id === 'string' ? record.id : null
  if (!id) return null
  return {
    id,
    title: typeof record.title === 'string' ? record.title : '—',
    serviceName: typeof record.serviceName === 'string' ? record.serviceName : typeof record.service_name === 'string' ? record.service_name : null,
    startsAt: typeof record.startsAt === 'string' ? record.startsAt : typeof record.starts_at === 'string' ? record.starts_at : null,
    status: typeof record.status === 'string' ? record.status : 'draft',
  }
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
}

const BookingUpcomingWidget: React.FC<DashboardWidgetComponentProps<BookingUpcomingSettings>> = ({
  mode,
  settings,
  onSettingsChange,
  refreshToken,
  onRefreshStateChange,
}) => {
  const hydrated = React.useMemo(() => hydrateUpcomingSettings(settings), [settings])
  const [bookings, setBookings] = React.useState<UpcomingBooking[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchUpcoming = React.useCallback(async (opts: BookingUpcomingSettings) => {
    setIsLoading(true)
    setError(null)
    onRefreshStateChange?.(true)
    try {
      const now = new Date().toISOString()
      const url = `/api/booking/bookings?startsFrom=${encodeURIComponent(now)}&pageSize=${opts.limit}`
      const res = await apiFetch(url)
      const payload = await res.json().catch(() => ({})) as ApiResponse
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load upcoming bookings.'
        throw new Error(message)
      }
      const items = Array.isArray(payload.items) ? payload.items : []
      const mapped: UpcomingBooking[] = []
      for (const entry of items) {
        if (!entry || typeof entry !== 'object') continue
        const parsed = parseUpcoming(entry as Record<string, unknown>)
        if (!parsed) continue
        if (!opts.includeCancelled && parsed.status === 'cancelled') continue
        mapped.push(parsed)
        if (mapped.length >= opts.limit) break
      }
      setBookings(mapped)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load upcoming bookings.'
      setError(message)
    } finally {
      setIsLoading(false)
      onRefreshStateChange?.(false)
    }
  }, [onRefreshStateChange])

  React.useEffect(() => {
    if (mode === 'view') {
      fetchUpcoming(hydrated)
    }
  }, [fetchUpcoming, hydrated, mode, refreshToken])

  const handleSettingsChange = React.useCallback((next: Partial<BookingUpcomingSettings>) => {
    const current = hydrateUpcomingSettings(settings)
    onSettingsChange({ ...current, ...next })
  }, [onSettingsChange, settings])

  if (mode === 'settings') {
    const current = hydrateUpcomingSettings(settings)
    return (
      <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
        <div className="space-y-1.5">
          <label htmlFor="booking-upcoming-limit" className="text-xs font-medium uppercase text-muted-foreground">
            {"Max bookings"}
          </label>
          <input
            id="booking-upcoming-limit"
            type="number"
            min={1}
            max={20}
            value={current.limit}
            onChange={(event) => handleSettingsChange({ limit: Math.max(1, Math.min(20, Number(event.target.value) || DEFAULT_SETTINGS.limit)) })}
            className="w-full rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={current.includeCancelled}
            onChange={(event) => handleSettingsChange({ includeCancelled: event.target.checked })}
            className="rounded border"
          />
          <span className="text-muted-foreground">Include cancelled bookings</span>
        </label>
      </form>
    )
  }

  if (isLoading && bookings.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Loading upcoming bookings…
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          className="text-sm font-medium text-primary hover:underline"
          onClick={() => fetchUpcoming(hydrated)}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!bookings.length) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        {"No upcoming bookings."}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {bookings.map((booking) => {
          const startsAt = booking.startsAt ? new Date(booking.startsAt) : null
          const formatted = startsAt && !Number.isNaN(startsAt.getTime())
            ? startsAt.toLocaleString()
            : null
          const badgeClass = STATUS_COLORS[booking.status] ?? 'bg-slate-100 text-slate-800'
          return (
            <li key={booking.id} className="rounded-md border border-border bg-card p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium leading-tight">{booking.title}</div>
                  {booking.serviceName ? (
                    <div className="text-xs text-muted-foreground">{booking.serviceName}</div>
                  ) : null}
                  {formatted ? (
                    <div className="text-xs text-muted-foreground">{formatted}</div>
                  ) : null}
                </div>
                <span className={clsx('rounded-full px-2 py-1 text-xs font-medium capitalize', badgeClass)}>
                  {booking.status}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Refreshing…</div>
      ) : null}
    </div>
  )
}

export default BookingUpcomingWidget

