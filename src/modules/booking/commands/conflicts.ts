import { DateTime, Interval } from 'luxon'
import { RRule } from 'rrule'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { BookingEvent, BookingAvailabilityRule, BookingEventResource, BookingEventMember } from '../data/entities'
import type { BookingAvailabilitySubjectType } from '../data/entities'

export type EventSpan = {
  id?: string
  startsAt: Date
  endsAt: Date
}

export type ConflictCheckInput = {
  tenantId: string
  organizationId: string
  spans: EventSpan[]
  subjectMembers: string[]
  subjectResources: Array<{ resourceId: string; qty: number }>
  ignoreEventId?: string
}

type LoadedAvailability = {
  subjectId: string
  subjectType: BookingAvailabilitySubjectType
  intervals: Interval[]
}

export class ConflictChecker {
  constructor(private readonly em: EntityManager) {}

  async assertNoConflicts(input: ConflictCheckInput): Promise<void> {
    if (!input.spans.length) return

    this.ensureValidSpans(input.spans)

    const memberConflicts = await this.checkSubjectConflicts(
      input,
      input.subjectMembers,
      'member',
    )
    if (memberConflicts.length) {
      throw new CrudHttpError(400, {
        error: 'Team member is unavailable for the requested time.',
        conflicts: memberConflicts,
      })
    }

    const resourceConflicts = await this.checkResourceConflicts(input)
    if (resourceConflicts.length) {
      throw new CrudHttpError(400, {
        error: 'Resource is unavailable for the requested time.',
        conflicts: resourceConflicts,
      })
    }
  }

  private ensureValidSpans(spans: EventSpan[]): void {
    for (const span of spans) {
      if (span.endsAt <= span.startsAt) {
        throw new CrudHttpError(400, { error: 'Event end time must be after start time.' })
      }
    }
  }

  private async loadAvailability(
    tenantId: string,
    organizationId: string,
    subjectIds: string[],
    subjectType: BookingAvailabilitySubjectType,
  ): Promise<Map<string, LoadedAvailability>> {
    if (!subjectIds.length) return new Map()
    const rules = await this.em.find(BookingAvailabilityRule, {
      tenantId,
      organizationId,
      subjectType,
      subjectId: { $in: subjectIds },
      deletedAt: null,
    })

    const availability = new Map<string, LoadedAvailability>()
    for (const subjectId of subjectIds) {
      availability.set(subjectId, { subjectId, subjectType, intervals: [] })
    }

    for (const rule of rules) {
      const entry = availability.get(rule.subjectId)
      if (!entry) continue
      const intervals = this.expandRule(rule)
      entry.intervals.push(...intervals)
    }

    return availability
  }

  private expandRule(rule: BookingAvailabilityRule): Interval[] {
    const base = DateTime.fromJSDate(rule.createdAt).startOf('day')
    try {
      const options = RRule.parseString(rule.rrule)
      options.dtstart = base.toJSDate()
      const recurrence = new RRule(options)
      const dates = recurrence.between(DateTime.utc().minus({ months: 6 }).toJSDate(), DateTime.utc().plus({ months: 12 }).toJSDate(), true)
      const intervals: Interval[] = dates.map((date: Date) => {
        const start = DateTime.fromJSDate(date)
        const end = start.plus({ minutes: 60 })
        return Interval.fromDateTimes(start, end)
      })

      const filtered = intervals.filter((interval) => {
        return !rule.exdates.some((exception) => {
          const ex = DateTime.fromISO(exception)
          return interval.contains(ex)
        })
      })
      return filtered
    } catch (err) {
      console.error('[booking.conflicts.expandRule] Failed to parse RRULE', err)
      return []
    }
  }

  private async checkSubjectConflicts(
    input: ConflictCheckInput,
    subjectIds: string[],
    subjectType: BookingAvailabilitySubjectType,
  ): Promise<Array<{ subjectId: string; reason: string }>> {
    if (!subjectIds.length) return []
    const availability = await this.loadAvailability(
      input.tenantId,
      input.organizationId,
      subjectIds,
      subjectType,
    )

    const existing = await this.fetchExistingEvents(
      input.tenantId,
      subjectType,
      subjectIds,
      input.ignoreEventId,
    )

    const conflicts: Array<{ subjectId: string; reason: string }> = []

    for (const subjectId of subjectIds) {
      const availabilityEntry = availability.get(subjectId)
      const subjectEvents = existing.get(subjectId) ?? []

      for (const span of input.spans) {
        const spanInterval = Interval.fromDateTimes(
          DateTime.fromJSDate(span.startsAt),
          DateTime.fromJSDate(span.endsAt),
        )

        if (availabilityEntry && availabilityEntry.intervals.length) {
          const overlaps = availabilityEntry.intervals.some((interval) => interval.overlaps(spanInterval))
          if (!overlaps) {
            conflicts.push({ subjectId, reason: 'outside_availability' })
            continue
          }
        }

        const hasOverlap = subjectEvents.some((event) => {
          const eventInterval = Interval.fromDateTimes(
            DateTime.fromJSDate(event.startsAt),
            DateTime.fromJSDate(event.endsAt),
          )
          return eventInterval.overlaps(spanInterval)
        })

        if (hasOverlap) {
          conflicts.push({ subjectId, reason: 'existing_event_overlap' })
        }
      }
    }

    return conflicts
  }

  private async fetchExistingEvents(
    tenantId: string,
    subjectType: BookingAvailabilitySubjectType,
    subjectIds: string[],
    ignoreEventId?: string,
  ): Promise<Map<string, BookingEvent[]>> {
    if (!subjectIds.length) return new Map()

    const memberJoin = subjectType === 'member'

    const qb = this.em.createQueryBuilder(BookingEvent, 'event')
      .select('event.*')
      .where({ tenantId, deletedAt: null })

    if (ignoreEventId) {
      qb.andWhere({ id: { $ne: ignoreEventId } })
    }

    if (subjectType === 'member') {
      qb.join('booking_event_members', 'member', {
        on: {
          event_id: 'event.id',
        },
      })
      qb.andWhere({ 'member.member_id': { $in: subjectIds } })
    } else {
      qb.join('booking_event_resources', 'resource', {
        on: {
          event_id: 'event.id',
        },
      })
      qb.andWhere({ 'resource.resource_id': { $in: subjectIds } })
    }

    const rows = await qb.getResultList<BookingEvent>()

    const grouped = new Map<string, BookingEvent[]>()

    for (const row of rows) {
      const assignments = memberJoin
        ? await this.em.find(BookingEventMember, { eventId: row.id, memberId: { $in: subjectIds } })
        : await this.em.find(BookingEventResource, { eventId: row.id, resourceId: { $in: subjectIds } })

      for (const assignment of assignments) {
        const subjectId = memberJoin ? (assignment as BookingEventMember).memberId : (assignment as BookingEventResource).resourceId
        const list = grouped.get(subjectId) ?? []
        list.push(row)
        grouped.set(subjectId, list)
      }
    }

    return grouped
  }

  private async checkResourceConflicts(input: ConflictCheckInput) {
    const resourceIds = input.subjectResources.map((resource) => resource.resourceId)
    const conflicts = await this.checkSubjectConflicts(input, resourceIds, 'resource')
    return conflicts
  }
}

