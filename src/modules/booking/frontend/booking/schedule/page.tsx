"use client"

import * as React from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/context'
import { useOrganizationScopeVersion } from '@/lib/frontend/useOrganizationScope'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type TeamMemberRecord = {
  id: string
  displayName: string
  userId: string | null
  roleIds: string[]
  tags: string[]
}

type BookingMember = {
  memberId: string
  roleId: string | null
}

type BookingAssignment = {
  id: string
  title: string
  serviceName: string | null
  status: string
  startsAt: string | null
  endsAt: string | null
  members: BookingMember[]
}

type TeamMemberResponse = {
  items?: Array<Record<string, unknown>>
}

type BookingResponse = {
  items?: Array<Record<string, unknown>>
}

function parseTeamMember(entry: Record<string, unknown>): TeamMemberRecord | null {
  const id = typeof entry.id === 'string' ? entry.id : null
  if (!id) return null
  return {
    id,
    displayName: typeof entry.displayName === 'string'
      ? entry.displayName
      : typeof entry.display_name === 'string'
        ? entry.display_name
        : '—',
    userId: typeof entry.userId === 'string'
      ? entry.userId
      : typeof entry.user_id === 'string'
        ? entry.user_id
        : null,
    roleIds: Array.isArray(entry.roleIds)
      ? entry.roleIds.filter((id): id is string => typeof id === 'string')
      : Array.isArray(entry.role_ids)
        ? entry.role_ids.filter((id): id is string => typeof id === 'string')
        : [],
    tags: Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === 'string') : [],
  }
}

function parseBooking(entry: Record<string, unknown>): BookingAssignment | null {
  const id = typeof entry.id === 'string' ? entry.id : null
  if (!id) return null
  const members = Array.isArray(entry.members)
    ? entry.members
        .filter((member) => member && typeof member === 'object')
        .map((member: any) => ({
          memberId: typeof member.memberId === 'string' ? member.memberId : typeof member.member_id === 'string' ? member.member_id : '',
          roleId: typeof member.roleId === 'string' ? member.roleId : typeof member.role_id === 'string' ? member.role_id : null,
        }))
        .filter((member) => member.memberId !== '')
    : []

  return {
    id,
    title: typeof entry.title === 'string' ? entry.title : '—',
    serviceName: typeof entry.serviceName === 'string'
      ? entry.serviceName
      : typeof entry.service_name === 'string'
        ? entry.service_name
        : null,
    status: typeof entry.status === 'string' ? entry.status : 'draft',
    startsAt: typeof entry.startsAt === 'string'
      ? entry.startsAt
      : typeof entry.starts_at === 'string'
        ? entry.starts_at
        : null,
    endsAt: typeof entry.endsAt === 'string'
      ? entry.endsAt
      : typeof entry.ends_at === 'string'
        ? entry.ends_at
        : null,
    members,
  }
}

function formatDateRange(start: string | null, end: string | null, formatter: Intl.DateTimeFormat): string {
  if (!start) return '—'
  const startDate = new Date(start)
  if (Number.isNaN(startDate.getTime())) return '—'
  const formattedStart = formatter.format(startDate)
  if (!end) return formattedStart
  const endDate = new Date(end)
  if (Number.isNaN(endDate.getTime())) return formattedStart
  return `${formattedStart} → ${formatter.format(endDate)}`
}

function statusTone(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-100 text-emerald-800'
    case 'cancelled':
      return 'bg-rose-100 text-rose-800'
    case 'draft':
    default:
      return 'bg-slate-100 text-slate-800'
  }
}

export default function BookingSchedulePage() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [member, setMember] = React.useState<TeamMemberRecord | null>(null)
  const [memberError, setMemberError] = React.useState<string | null>(null)
  const [isLoadingMember, setIsLoadingMember] = React.useState(true)

  const [assignments, setAssignments] = React.useState<BookingAssignment[]>([])
  const [assignmentsError, setAssignmentsError] = React.useState<string | null>(null)
  const [isLoadingAssignments, setIsLoadingAssignments] = React.useState(false)
  const [refreshToken, setRefreshToken] = React.useState(0)

  const dateFormatter = React.useMemo(() => new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }), [])

  const loadMember = React.useCallback(async () => {
    setIsLoadingMember(true)
    setMemberError(null)
    try {
      const res = await apiFetch('/api/booking/team-members?userId=current')
      const payload = await res.json().catch(() => ({})) as TeamMemberResponse
      if (!res.ok) {
        const message = typeof (payload as any)?.error === 'string' && (payload as any).error.trim()
          ? (payload as any).error
          : t('booking.schedule.errors.memberLoad', 'Unable to load your booking profile.')
        throw new Error(message)
      }
      const items = Array.isArray(payload.items) ? payload.items : []
      const first = items
        .map((item) => (item && typeof item === 'object' ? parseTeamMember(item as Record<string, unknown>) : null))
        .find((value): value is TeamMemberRecord => Boolean(value))
      if (!first) {
        setMember(null)
        setMemberError(t('booking.schedule.errors.memberMissing', 'You are not linked to a booking team member yet.'))
        return
      }
      setMember(first)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.schedule.errors.memberLoad', 'Unable to load your booking profile.')
      setMemberError(message)
      setMember(null)
    } finally {
      setIsLoadingMember(false)
    }
  }, [t])

  const loadAssignments = React.useCallback(async (memberId: string) => {
    setIsLoadingAssignments(true)
    setAssignmentsError(null)
    try {
      const now = new Date()
      const future = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30)
      const params = new URLSearchParams({
        memberId,
        startsFrom: now.toISOString(),
        startsTo: future.toISOString(),
      })
      const res = await apiFetch(`/api/booking/bookings?${params.toString()}`)
      const payload = await res.json().catch(() => ({})) as BookingResponse
      if (!res.ok) {
        const message = typeof (payload as any)?.error === 'string' && (payload as any).error.trim()
          ? (payload as any).error
          : t('booking.schedule.errors.assignmentsLoad', 'Unable to load your upcoming bookings.')
        throw new Error(message)
      }
      const items = Array.isArray(payload.items) ? payload.items : []
      const mapped = items
        .map((item) => (item && typeof item === 'object' ? parseBooking(item as Record<string, unknown>) : null))
        .filter((value): value is BookingAssignment => Boolean(value))
        .sort((a, b) => {
          const aTime = a.startsAt ? new Date(a.startsAt).getTime() : Number.MAX_SAFE_INTEGER
          const bTime = b.startsAt ? new Date(b.startsAt).getTime() : Number.MAX_SAFE_INTEGER
          return aTime - bTime
        })
      setAssignments(mapped)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.schedule.errors.assignmentsLoad', 'Unable to load your upcoming bookings.')
      setAssignmentsError(message)
      setAssignments([])
    } finally {
      setIsLoadingAssignments(false)
    }
  }, [t])

  React.useEffect(() => {
    loadMember()
  }, [loadMember, scopeVersion])

  React.useEffect(() => {
    if (!member?.id) {
      setAssignments([])
      return
    }
    loadAssignments(member.id)
  }, [member?.id, loadAssignments, refreshToken, scopeVersion])

  const assignedCount = assignments.length

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          {t('booking.schedule.title', 'My upcoming bookings')}
        </h1>
        <p className="text-muted-foreground">
          {t('booking.schedule.subtitle', 'Stay on top of your next assignments and prepare for each session.')}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t('booking.schedule.summary.title', 'Assignments')}</CardTitle>
            <CardDescription>
              {member
                ? t('booking.schedule.summary.body', '{count, plural, one {You have # upcoming booking.} other {You have # upcoming bookings.}}', {
                    count: assignedCount,
                  })
                : t('booking.schedule.summary.noMember', 'Link your user to a booking team member to see assignments.')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRefreshToken((token) => token + 1)
                if (member?.id) {
                  loadAssignments(member.id)
                }
              }}
              disabled={isLoadingAssignments}
            >
              {isLoadingAssignments
                ? t('booking.schedule.actions.refreshing', 'Refreshing…')
                : t('booking.schedule.actions.refresh', 'Refresh')}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href="/backend/team-members">
                {t('booking.schedule.actions.manageProfile', 'Manage team profile')}
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {isLoadingMember ? (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          {t('booking.schedule.loadingProfile', 'Loading your booking profile…')}
        </div>
      ) : memberError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {memberError}
        </div>
      ) : null}

      {!isLoadingMember && !member && !memberError ? (
        <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t('booking.schedule.noMember', 'Your user account is not linked to a booking team member yet.')}<br />
          {t('booking.schedule.askAdmin', 'Ask an administrator to create a team member entry for you.')}
        </div>
      ) : null}

      {member ? (
        <section className="space-y-4">
          {assignmentsError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {assignmentsError}
            </div>
          ) : null}

          {isLoadingAssignments && assignments.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              {t('booking.schedule.loadingAssignments', 'Loading upcoming bookings…')}
            </div>
          ) : null}

          {!isLoadingAssignments && assignments.length === 0 && !assignmentsError ? (
            <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              {t('booking.schedule.empty', 'You have no upcoming bookings in the next 30 days.')}
            </div>
          ) : null}

          <div className="grid gap-4">
            {assignments.map((booking) => {
              const roleEntry = booking.members.find((memberEntry) => memberEntry.memberId === member.id)
              const roleLabel = roleEntry?.roleId ? `#${roleEntry.roleId.slice(0, 8)}` : null
              const schedule = formatDateRange(booking.startsAt, booking.endsAt, dateFormatter)
              return (
                <Card key={booking.id} className="border-border/80">
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-semibold leading-tight">
                        {booking.title}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {booking.serviceName
                          ? t('booking.schedule.assignment.service', '{service} · {time}', {
                              service: booking.serviceName,
                              time: schedule,
                            })
                          : schedule}
                      </CardDescription>
                      {roleLabel ? (
                        <p className="text-xs text-muted-foreground">
                          {t('booking.schedule.assignment.role', 'Assigned role: {role}', { role: roleLabel })}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusTone(booking.status)}`}>
                        {booking.status}
                      </span>
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link href={`/backend/bookings/${booking.id}/edit`}>
                          {t('booking.schedule.actions.view', 'View details')}
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}


