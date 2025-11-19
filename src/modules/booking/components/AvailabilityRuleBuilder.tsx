"use client"

import * as React from 'react'
import { addMonths, isSameDay, startOfMonth } from 'date-fns'
import { RRule } from 'rrule'
import clsx from 'clsx'
import {
  type CrudFormGroupComponentProps,
} from '@open-mercato/ui/backend/CrudForm'
import { Calendar } from '@open-mercato/ui/primitives/calendar'
import { Button } from '@open-mercato/ui/primitives/button'

const WEEKDAY_ORDER = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const

type Translator = (key: string, fallback: string, params?: Record<string, unknown>) => string

export type AvailabilityRuleBuilderProps = CrudFormGroupComponentProps & {
  t: Translator
}

export function AvailabilityRuleBuilder({ values, setValue, t }: AvailabilityRuleBuilderProps) {
  const [selectedDays, setSelectedDays] = React.useState<Set<string>>(() => new Set(WEEKDAY_ORDER.slice(0, 5)))
  const [startTime, setStartTime] = React.useState('09:00')
  const [interval, setInterval] = React.useState(1)
  const [previewMonth, setPreviewMonth] = React.useState(() => startOfMonth(new Date()))
  const [selectedExdates, setSelectedExdates] = React.useState<Date[]>([])
  const generatedRruleRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!values.timezone) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz) setValue('timezone', tz)
    }
  }, [values.timezone, setValue])

  React.useEffect(() => {
    const incoming = Array.isArray(values.exdates) ? values.exdates : []
    const parsed = incoming
      .map((iso) => {
        const date = new Date(iso)
        return Number.isNaN(date.getTime()) ? null : date
      })
      .filter((date): date is Date => Boolean(date))
    setSelectedExdates(parsed)
  }, [values.exdates])

  React.useEffect(() => {
    if (!values.rrule || generatedRruleRef.current === values.rrule) {
      return
    }
    const dayMatch = values.rrule.match(/BYDAY=([^;]+)/)
    if (dayMatch) {
      setSelectedDays(new Set(dayMatch[1].split(',').filter(Boolean)))
    }
    const hourMatch = values.rrule.match(/BYHOUR=([0-9]{1,2})/)
    const minuteMatch = values.rrule.match(/BYMINUTE=([0-9]{1,2})/)
    if (hourMatch) {
      const hour = hourMatch[1].padStart(2, '0')
      const minute = minuteMatch ? minuteMatch[1].padStart(2, '0') : '00'
      setStartTime(`${hour}:${minute}`)
    }
    const intervalMatch = values.rrule.match(/INTERVAL=([0-9]+)/)
    if (intervalMatch) {
      setInterval(Number(intervalMatch[1]) || 1)
    }
  }, [values.rrule])

  React.useEffect(() => {
    if (selectedDays.size === 0) return
    const parts = ['FREQ=WEEKLY']
    if (interval > 1) parts.push(`INTERVAL=${interval}`)
    const orderedDays = WEEKDAY_ORDER.filter((day) => selectedDays.has(day))
    if (orderedDays.length) parts.push(`BYDAY=${orderedDays.join(',')}`)
    if (startTime) {
      const [hour, minute] = startTime.split(':')
      if (hour) parts.push(`BYHOUR=${Number(hour)}`)
      if (minute) parts.push(`BYMINUTE=${Number(minute)}`)
    }
    const next = parts.join(';')
    generatedRruleRef.current = next
    if (values.rrule !== next) {
      setValue('rrule', next)
    }
  }, [selectedDays, startTime, interval, setValue, values.rrule])

  const previewDates = React.useMemo(() => {
    try {
      const rule = RRule.fromString(values.rrule || 'FREQ=WEEKLY')
      const previewEnd = addMonths(previewMonth, 1)
      return rule.between(previewMonth, previewEnd, true)
    } catch (error) {
      console.warn('[booking.availability.builder.preview] failed to parse RRULE', error)
      return []
    }
  }, [values.rrule, previewMonth])

  const toggleDay = (day: string) => {
    setSelectedDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) {
        next.delete(day)
      } else {
        next.add(day)
      }
      return next
    })
  }

  const handleExdateSelect = (date?: Date) => {
    if (!date) return
    setSelectedExdates((prev) => {
      const exists = prev.some((entry) => isSameDay(entry, date))
      const next = exists
        ? prev.filter((entry) => !isSameDay(entry, date))
        : [...prev, date]
      setValue('exdates', next.map((entry) => entry.toISOString()))
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          {t('booking.availability.builder.days', 'Available weekdays')}
        </p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_ORDER.map((day) => (
            <Button
              key={day}
              type="button"
              size="sm"
              variant={selectedDays.has(day) ? 'default' : 'outline'}
              onClick={() => toggleDay(day)}
            >
              {t(`booking.availability.builder.day.${day.toLowerCase()}`, day)}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground" htmlFor="availability-builder-start">
            {t('booking.availability.builder.startTime', 'Start time')}
          </label>
          <input
            id="availability-builder-start"
            type="time"
            value={startTime}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            onChange={(event) => setStartTime(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground" htmlFor="availability-builder-interval">
            {t('booking.availability.builder.interval', 'Repeat interval (weeks)')}
          </label>
          <input
            id="availability-builder-interval"
            type="number"
            min={1}
            value={interval}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            onChange={(event) => {
              const next = Number(event.target.value) || 1
              setInterval(next < 1 ? 1 : next)
            }}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3 shadow-sm">
        <Calendar
          month={previewMonth}
          onMonthChange={(month) => month && setPreviewMonth(month)}
          mode="multiple"
          selected={selectedExdates}
          onSelect={handleExdateSelect}
          modifiers={{ available: previewDates }}
          modifiersClassNames={{
            available: 'bg-primary/10 text-primary-foreground',
            selected: 'bg-destructive/10 text-destructive-foreground',
          }}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {t('booking.availability.builder.exdatesHelp', 'Click on a highlighted day to add or remove an exception.')}
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {t('booking.availability.builder.generatedRule', 'Generated RRULE')}
        </p>
        <code className={clsx('block rounded-md bg-muted px-3 py-2 text-xs', values.rrule ? 'text-foreground' : 'text-muted-foreground')}>
          {values.rrule || t('booking.availability.builder.noRule', 'Select options to generate a rule')}
        </code>
      </div>
    </div>
  )
}


