import { addMinutes, isBefore, isEqual, max as dateMax, min as dateMin } from 'date-fns'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { RecurringAvailability } from '@open-mercato/shared/lib/availability/types'
import { expandRecurrence } from '@open-mercato/shared/lib/availability/recurrence'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import {
  BookingAvailabilityRule,
  BookingEvent,
  BookingEventResource,
  BookingEventMember,
} from '../data/entities'

export type EventSpan = {
  startsAt: Date
  endsAt: Date
}

function overlaps(a: EventSpan, b: EventSpan): boolean {
  return isBefore(a.startsAt, b.endsAt) && isBefore(b.startsAt, a.endsAt)
}

export async function ensureNoEventConflicts(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  span: EventSpan,
  subjectMemberIds: string[],
  subjectResourceIds: string[],
  ignoreEventId?: string,
): Promise<void> {
  const where: any = {
    tenantId,
    organizationId,
    deletedAt: null,
    $and: [
      { startsAt: { $lt: span.endsAt } },
      { endsAt: { $gt: span.startsAt } },
    ],
  }
  if (ignoreEventId) {
    where.id = { $ne: ignoreEventId }
  }

  const conflictingEvents = await em.find(BookingEvent, where, { limit: 100 })
  if (!conflictingEvents.length) return

  const eventIds = conflictingEvents.map((event) => event.id)

  const [eventMembers, eventResources] = await Promise.all([
    subjectMemberIds.length
      ? em.find(BookingEventMember, {
          eventId: { $in: eventIds },
          memberId: { $in: subjectMemberIds },
          deletedAt: null,
        })
      : [],
    subjectResourceIds.length
      ? em.find(BookingEventResource, {
          eventId: { $in: eventIds },
          resourceId: { $in: subjectResourceIds },
          deletedAt: null,
        })
      : [],
  ])

  if (eventMembers.length > 0 || eventResources.length > 0) {
    throw new CrudHttpError(409, { error: 'Booking conflicts with existing events.' })
  }
}

export async function ensureWithinAvailability(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  span: EventSpan,
  subjectType: 'member' | 'resource',
  subjectIds: string[],
): Promise<void> {
  if (!subjectIds.length) return

  const rules = await em.find(BookingAvailabilityRule, {
    tenantId,
    organizationId,
    subjectType,
    subjectId: { $in: subjectIds },
    deletedAt: null,
  })

  if (!rules.length) return

  const spanDuration = span.endsAt.getTime() - span.startsAt.getTime()
  const startWindow = dateMin([span.startsAt, addMinutes(span.startsAt, -spanDuration)])
  const endWindow = dateMax([span.endsAt, addMinutes(span.endsAt, spanDuration)])

  const availabilityWindows: RecurringAvailability[] = rules.map((rule) => ({
    timezone: rule.timezone,
    rrule: rule.rrule,
    exdates: rule.exdates,
  }))

  const expanded = availabilityWindows.flatMap((window) =>
    expandRecurrence(window, {
      start: startWindow,
      end: endWindow,
    }),
  )

  const fits = expanded.some((window) => {
    const windowSpan: EventSpan = {
      startsAt: window.start,
      endsAt: window.end,
    }
    const startsInside = !isBefore(span.startsAt, windowSpan.startsAt)
    const endsInside = !isBefore(windowSpan.endsAt, span.endsAt)
    return startsInside && endsInside
  })

  if (!fits) {
    throw new CrudHttpError(409, { error: 'Booking is outside the subject availability window.' })
  }
}

