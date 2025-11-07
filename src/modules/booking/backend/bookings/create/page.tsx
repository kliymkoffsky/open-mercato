"use client"

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFieldOption, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@/lib/i18n/context'

type EventStatus = 'draft' | 'confirmed' | 'cancelled'

interface BookingValues {
  service_id: string
  title: string
  starts_at: string
  ends_at: string
  timezone?: string | null
  status: EventStatus
  rrule?: string | null
  exdates: string[]
  tags: string[]
}

async function loadServiceOptions(query?: string): Promise<CrudFieldOption[]> {
  try {
    const res = await apiFetch('/api/booking/services')
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) return []
    const items = Array.isArray(payload?.items) ? payload.items : []
    const normalized = (query ?? '').trim().toLowerCase()
    return items
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({ value: String((item as any).id ?? ''), label: String((item as any).name ?? '') }))
      .filter((option) => option.value && option.label && (!normalized || option.label.toLowerCase().includes(normalized)))
  } catch {
    return []
  }
}

export default function BookingCreatePage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'service_id',
      label: t('booking.events.form.fields.service.label', 'Service'),
      type: 'select',
      required: true,
      options: [],
      loadOptions: loadServiceOptions,
      placeholder: t('booking.events.form.fields.service.placeholder', 'Select service'),
    },
    {
      id: 'title',
      label: t('booking.events.form.fields.title.label', 'Title'),
      type: 'text',
      required: true,
      placeholder: t('booking.events.form.fields.title.placeholder', 'Intro call with client'),
    },
    {
      id: 'starts_at',
      label: t('booking.events.form.fields.startsAt.label', 'Start (ISO datetime)'),
      type: 'text',
      required: true,
      placeholder: '2025-11-10T09:00:00Z',
    },
    {
      id: 'ends_at',
      label: t('booking.events.form.fields.endsAt.label', 'End (ISO datetime)'),
      type: 'text',
      required: true,
      placeholder: '2025-11-10T10:00:00Z',
    },
    {
      id: 'timezone',
      label: t('booking.events.form.fields.timezone.label', 'Timezone'),
      type: 'text',
      placeholder: 'Europe/Paris',
    },
    {
      id: 'status',
      label: t('booking.events.form.fields.status.label', 'Status'),
      type: 'select',
      required: true,
      options: [
        { value: 'draft', label: t('booking.events.form.status.draft', 'Draft') },
        { value: 'confirmed', label: t('booking.events.form.status.confirmed', 'Confirmed') },
        { value: 'cancelled', label: t('booking.events.form.status.cancelled', 'Cancelled') },
      ],
      placeholder: t('booking.events.form.fields.status.placeholder', 'Select status'),
    },
    {
      id: 'rrule',
      label: t('booking.events.form.fields.rrule.label', 'Recurrence rule (optional)'),
      type: 'text',
      placeholder: 'FREQ=WEEKLY;BYDAY=TU',
    },
    {
      id: 'exdates',
      label: t('booking.events.form.fields.exdates.label', 'Exceptions (ISO dates)'),
      type: 'tags',
    },
    {
      id: 'tags',
      label: t('booking.events.form.fields.tags.label', 'Tags'),
      type: 'tags',
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basics', title: t('booking.events.form.groups.basics', 'Basics'), column: 1, fields: ['service_id', 'title', 'status'] },
    { id: 'timing', title: t('booking.events.form.groups.timing', 'Timing'), column: 1, fields: ['starts_at', 'ends_at', 'timezone'] },
    { id: 'recurrence', title: t('booking.events.form.groups.recurrence', 'Recurrence'), column: 2, fields: ['rrule', 'exdates', 'tags'] },
  ], [t])

  const successMessage = t('booking.events.form.flash.created', 'Booking created.')
  const successRedirect = React.useMemo(
    () => `/backend/bookings?flash=${encodeURIComponent(successMessage)}&type=success`,
    [successMessage],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<BookingValues>
          title={t('booking.events.form.create.title', 'Create booking')}
          backHref="/backend/bookings"
          fields={fields}
          groups={groups}
          submitLabel={t('booking.events.form.create.submit', 'Create booking')}
          cancelHref="/backend/bookings"
          successRedirect={successRedirect}
          onSubmit={async (values) => {
            try {
              await createCrud('booking/bookings', {
                event: {
                  service_id: values.service_id,
                  title: values.title,
                  starts_at: values.starts_at,
                  ends_at: values.ends_at,
                  timezone: values.timezone ?? null,
                  status: values.status,
                  rrule: values.rrule ?? null,
                  exdates: Array.isArray(values.exdates) ? values.exdates : [],
                  tags: Array.isArray(values.tags) ? values.tags : [],
                },
              })
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.events.form.flash.createError', 'Failed to create booking.')
              flash(message, 'error')
              throw err
            }
          }}
        />
      </PageBody>
    </Page>
  )
}

