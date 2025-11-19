"use client"

import * as React from 'react'
import Link from 'next/link'
import { format, startOfMonth, endOfMonth, isSameDay } from 'date-fns'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Calendar } from '@open-mercato/ui/primitives/calendar'
import { Button } from '@open-mercato/ui/primitives/button'
import { useT } from '@/lib/i18n/context'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import { useOrganizationScopeVersion } from '@/lib/frontend/useOrganizationScope'

type BookingCalendarEvent = {
  id: string
  title: string
  serviceName: string | null
  startsAt: string | null
  endsAt: string | null
  status: string
  members: Array<{ memberId: string; roleId: string | null }>
}

type SelectOption = { value: string; label: string }

type ServiceResponse = { items?: Array<Record<string, unknown>> }
type MemberResponse = { items?: Array<Record<string, unknown>> }
type ResourceResponse = { items?: Array<Record<string, unknown>> }
type BookingsResponse = { items?: Array<Record<string, unknown>> }

function parseServiceOption(record: Record<string, unknown>): SelectOption | null {
  const id = typeof record.id === 'string' ? record.id : null
  if (!id) return null
  const name = typeof record.name === 'string' ? record.name : '—'
  return { value: id, label: name }
}

function parseMemberOption(record: Record<string, unknown>): SelectOption | null {
  const id = typeof record.id === 'string' ? record.id : null
  if (!id) return null
  const name = typeof record.displayName === 'string'
    ? record.displayName
    : typeof record.display_name === 'string'
      ? record.display_name
      : '—'
  return { value: id, label: name }
}

function parseResourceOption(record: Record<string, unknown>): SelectOption | null {
  const id = typeof record.id === 'string' ? record.id : null
  if (!id) return null
  const name = typeof record.name === 'string' ? record.name : '—'
  return { value: id, label: name }
}

function parseBooking(record: Record<string, unknown>): BookingCalendarEvent | null {
  const id = typeof record.id === 'string' ? record.id : null
  if (!id) return null
  const members = Array.isArray(record.members)
    ? record.members
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const memberId = typeof (entry as any).memberId === 'string'
            ? (entry as any).memberId
            : typeof (entry as any).member_id === 'string'
              ? (entry as any).member_id
              : null
          if (!memberId) return null
          const roleId = typeof (entry as any).roleId === 'string'
            ? (entry as any).roleId
            : typeof (entry as any).role_id === 'string'
              ? (entry as any).role_id
              : null
          return { memberId, roleId }
        })
        .filter((value): value is { memberId: string; roleId: string | null } => Boolean(value))
    : []

  return {
    id,
    title: typeof record.title === 'string' ? record.title : '—',
    serviceName: typeof record.serviceName === 'string'
      ? record.serviceName
      : typeof record.service_name === 'string'
        ? record.service_name
        : null,
    startsAt: typeof record.startsAt === 'string'
      ? record.startsAt
      : typeof record.starts_at === 'string'
        ? record.starts_at
        : null,
    endsAt: typeof record.endsAt === 'string'
      ? record.endsAt
      : typeof record.ends_at === 'string'
        ? record.ends_at
        : null,
    status: typeof record.status === 'string' ? record.status : 'draft',
    members,
  }
}

function formatRange(event: BookingCalendarEvent, formatter: Intl.DateTimeFormat) {
  if (!event.startsAt) return '—'
  const start = new Date(event.startsAt)
  if (Number.isNaN(start.getTime())) return '—'
  if (!event.endsAt) return formatter.format(start)
  const end = new Date(event.endsAt)
  if (Number.isNaN(end.getTime())) return formatter.format(start)
  if (isSameDay(start, end)) {
    return `${formatter.format(start)} → ${format(end, 'HH:mm')}`
  }
  return `${formatter.format(start)} → ${formatter.format(end)}`
}

export default function BookingCalendarPage() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()

  const [services, setServices] = React.useState<SelectOption[]>([])
  const [members, setMembers] = React.useState<SelectOption[]>([])
  const [resources, setResources] = React.useState<SelectOption[]>([])

  const [selectedService, setSelectedService] = React.useState('')
  const [selectedMember, setSelectedMember] = React.useState('')
  const [selectedResource, setSelectedResource] = React.useState('')

  const [currentMonth, setCurrentMonth] = React.useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date())

  const [events, setEvents] = React.useState<BookingCalendarEvent[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const dateFormatter = React.useMemo(() => new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }), [])

  const selectedKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, BookingCalendarEvent[]>()
    events.forEach((event) => {
      if (!event.startsAt) return
      const key = format(new Date(event.startsAt), 'yyyy-MM-dd')
      const bucket = map.get(key)
      if (bucket) {
        bucket.push(event)
      } else {
        map.set(key, [event])
      }
    })
    return map
  }, [events])

  const bookedDates = React.useMemo(() => {
    return Array.from(eventsByDay.keys()).map((key) => {
      const date = new Date(key)
      return Number.isNaN(date.getTime()) ? null : date
    }).filter((value): value is Date => Boolean(value))
  }, [eventsByDay])

  const selectedEvents = React.useMemo(() => {
    if (!selectedKey) return []
    return eventsByDay.get(selectedKey) ?? []
  }, [eventsByDay, selectedKey])

  const loadFilters = React.useCallback(async () => {
    try {
      const [serviceRes, memberRes, resourceRes] = await Promise.all([
        apiFetch('/api/booking/services'),
        apiFetch('/api/booking/team-members'),
        apiFetch('/api/booking/resources'),
      ])

      const servicePayload = await serviceRes.json().catch(() => ({})) as ServiceResponse
      const memberPayload = await memberRes.json().catch(() => ({})) as MemberResponse
      const resourcePayload = await resourceRes.json().catch(() => ({})) as ResourceResponse

      const serviceOptions = Array.isArray(servicePayload.items)
        ? servicePayload.items.map((item) => item && typeof item === 'object' ? parseServiceOption(item as Record<string, unknown>) : null).filter((option): option is SelectOption => Boolean(option))
        : []
      const memberOptions = Array.isArray(memberPayload.items)
        ? memberPayload.items.map((item) => item && typeof item === 'object' ? parseMemberOption(item as Record<string, unknown>) : null).filter((option): option is SelectOption => Boolean(option))
        : []
      const resourceOptions = Array.isArray(resourcePayload.items)
        ? resourcePayload.items.map((item) => item && typeof item === 'object' ? parseResourceOption(item as Record<string, unknown>) : null).filter((option): option is SelectOption => Boolean(option))
        : []

      setServices(serviceOptions)
      setMembers(memberOptions)
      setResources(resourceOptions)
    } catch (error) {
      console.error('[booking.calendar.loadFilters] failed', error)
    }
  }, [])

  const loadEvents = React.useCallback(async (
    month: Date,
    serviceId: string,
    memberId: string,
    resourceId: string,
  ) => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const from = startOfMonth(month)
      const to = endOfMonth(month)
      const params = new URLSearchParams({
        startsFrom: from.toISOString(),
        startsTo: to.toISOString(),
      })
      if (serviceId) params.set('serviceId', serviceId)
      if (memberId) params.set('memberId', memberId)
      if (resourceId) params.set('resourceId', resourceId)

      const res = await apiFetch(`/api/booking/bookings?${params.toString()}`)
      const payload = await res.json().catch(() => ({})) as BookingsResponse
      if (!res.ok) {
        const message = typeof (payload as any)?.error === 'string' && (payload as any).error.trim()
          ? (payload as any).error
          : t('booking.calendar.errors.load', 'Failed to load bookings for the selected month.')
        throw new Error(message)
      }
      const items = Array.isArray(payload.items) ? payload.items : []
      const mapped = items
        .map((item) => item && typeof item === 'object' ? parseBooking(item as Record<string, unknown>) : null)
        .filter((item): item is BookingCalendarEvent => Boolean(item))
      setEvents(mapped)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('booking.calendar.errors.load', 'Failed to load bookings for the selected month.')
      setLoadError(message)
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    loadFilters()
  }, [loadFilters])

  React.useEffect(() => {
    loadEvents(currentMonth, selectedService, selectedMember, selectedResource)
  }, [currentMonth, selectedService, selectedMember, selectedResource, loadEvents, scopeVersion])

  const resetFilters = () => {
    setSelectedService('')
    setSelectedMember('')
    setSelectedResource('')
  }

  return (
    <Page>
      <PageBody>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('booking.calendar.title', 'Booking calendar')}</h1>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/backend/bookings">
                {t('booking.calendar.actions.listView', 'List view')}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/backend/bookings/create">
                {t('booking.calendar.actions.create', 'New booking')}
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-4 sm:items-end">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground" htmlFor="calendar-service-filter">
                  {t('booking.calendar.filters.service', 'Service')}
                </label>
                <select
                  id="calendar-service-filter"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  value={selectedService}
                  onChange={(event) => setSelectedService(event.target.value)}
                >
                  <option value="">
                    {t('booking.calendar.filters.serviceAll', 'All services')}
                  </option>
                  {services.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground" htmlFor="calendar-member-filter">
                  {t('booking.calendar.filters.member', 'Team member')}
                </label>
                <select
                  id="calendar-member-filter"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  value={selectedMember}
                  onChange={(event) => setSelectedMember(event.target.value)}
                >
                  <option value="">
                    {t('booking.calendar.filters.memberAll', 'All team members')}
                  </option>
                  {members.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground" htmlFor="calendar-resource-filter">
                  {t('booking.calendar.filters.resource', 'Resource')}
                </label>
                <select
                  id="calendar-resource-filter"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  value={selectedResource}
                  onChange={(event) => setSelectedResource(event.target.value)}
                >
                  <option value="">
                    {t('booking.calendar.filters.resourceAll', 'All resources')}
                  </option>
                  {resources.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="w-full" onClick={() => setCurrentMonth(startOfMonth(new Date()))}>
                  {t('booking.calendar.actions.today', 'Jump to today')}
                </Button>
                <Button type="button" variant="ghost" onClick={resetFilters}>
                  {t('booking.calendar.actions.clearFilters', 'Reset')}
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <Calendar
                month={currentMonth}
                onMonthChange={(month) => {
                  if (month) setCurrentMonth(month)
                }}
                selected={selectedDate}
                onSelect={(date) => setSelectedDate(date ?? undefined)}
                modifiers={{ booked: bookedDates }}
                modifiersClassNames={{ booked: 'bg-primary/10 text-primary-foreground' }}
              />
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {selectedDate
                      ? t('booking.calendar.list.titleWithDate', 'Bookings on {date}', {
                          date: format(selectedDate, 'PPP'),
                        })
                      : t('booking.calendar.list.title', 'Bookings')}
                  </h2>
                  {loadError ? (
                    <p className="text-sm text-destructive">{loadError}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {isLoading
                        ? t('booking.calendar.list.loading', 'Refreshing assignments…')
                        : t('booking.calendar.list.count', '{count, plural, one {# booking} other {# bookings}}', {
                            count: selectedEvents.length,
                          })}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => loadEvents(currentMonth, selectedService, selectedMember, selectedResource)}
                  disabled={isLoading}
                >
                  {isLoading
                    ? t('booking.calendar.actions.refreshing', 'Refreshing…')
                    : t('booking.calendar.actions.refresh', 'Refresh')}
                </Button>
              </div>

              <div className="space-y-3">
                {selectedEvents.length === 0 && !isLoading ? (
                  <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    {selectedDate
                      ? t('booking.calendar.list.emptyForDate', 'No bookings scheduled for this day.')
                      : t('booking.calendar.list.emptyForSelection', 'Select a day on the calendar to view assignments.')}
                  </div>
                ) : null}

                {selectedEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold leading-tight">{event.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {event.serviceName
                            ? `${event.serviceName} · ${formatRange(event, dateFormatter)}`
                            : formatRange(event, dateFormatter)}
                        </p>
                        {event.members.length > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {t('booking.calendar.list.members', 'Assigned members: {list}', {
                              list: event.members.map((member) => `#${member.memberId.slice(0, 8)}`).join(', '),
                            })}
                          </p>
                        ) : null}
                      </div>
                      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize text-secondary-foreground">
                        {event.status}
                      </span>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/backend/bookings/${event.id}/edit`}>
                          {t('booking.calendar.actions.manage', 'Open booking')}
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </PageBody>
    </Page>
  )
}


