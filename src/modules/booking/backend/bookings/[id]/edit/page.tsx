"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFieldOption, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@/lib/i18n/context'

type EventStatus = 'draft' | 'confirmed' | 'cancelled'

interface BookingValues {
  id: string
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

export default function BookingEditPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const bookingId = typeof params?.id === 'string' ? params.id : ''

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'service_id',
      label: t('booking.events.form.fields.service.label', 'Service'),
      type: 'select',
      required: true,
      options: [],
      loadOptions: loadServiceOptions,
    },
    {
      id: 'title',
      label: t('booking.events.form.fields.title.label', 'Title'),
      type: 'text',
      required: true,
    },
    {
      id: 'starts_at',
      label: t('booking.events.form.fields.startsAt.label', 'Start (ISO datetime)'),
      type: 'text',
      required: true,
    },
    {
      id: 'ends_at',
      label: t('booking.events.form.fields.endsAt.label', 'End (ISO datetime)'),
      type: 'text',
      required: true,
    },
    {
      id: 'timezone',
      label: t('booking.events.form.fields.timezone.label', 'Timezone'),
      type: 'text',
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
    },
    {
      id: 'rrule',
      label: t('booking.events.form.fields.rrule.label', 'Recurrence rule (optional)'),
      type: 'text',
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

  const [initialValues, setInitialValues] = React.useState<Partial<BookingValues> | undefined>(undefined)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    if (!bookingId) return
    let active = true
    ;(async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/api/booking/bookings?id=${encodeURIComponent(bookingId)}`)
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          const message = typeof payload?.error === 'string' ? payload.error : t('booking.events.form.flash.loadError', 'Failed to load booking.')
          throw new Error(message)
        }
        const item = payload?.item as Record<string, any>
        if (!item) throw new Error(t('booking.events.form.flash.loadError', 'Failed to load booking.'))
        const values: BookingValues = {
          id: String(item.id),
          service_id: String(item.serviceId ?? item.service_id ?? ''),
          title: String(item.title ?? ''),
          starts_at: String(item.startsAt ?? item.starts_at ?? ''),
          ends_at: String(item.endsAt ?? item.ends_at ?? ''),
          timezone: typeof item.timezone === 'string' ? item.timezone : null,
          status: (item.status ?? 'draft') as EventStatus,
          rrule: typeof item.rrule === 'string' ? item.rrule : null,
          exdates: Array.isArray(item.exdates) ? item.exdates : [],
          tags: Array.isArray(item.tags) ? item.tags : [],
        }
        if (active) setInitialValues(values)
      } catch (err) {
        const message = err instanceof Error ? err.message : t('booking.events.form.flash.loadError', 'Failed to load booking.')
        flash(message, 'error')
        router.push('/backend/bookings')
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => { active = false }
  }, [bookingId, router, t])

  const successMessage = t('booking.events.form.flash.updated', 'Booking updated.')
  const deleteMessage = t('booking.events.form.flash.deleted', 'Booking deleted.')

  const successRedirect = React.useMemo(
    () => `/backend/bookings?flash=${encodeURIComponent(successMessage)}&type=success`,
    [successMessage],
  )
  const deleteRedirect = React.useMemo(
    () => `/backend/bookings?flash=${encodeURIComponent(deleteMessage)}&type=success`,
    [deleteMessage],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<BookingValues>
          title={t('booking.events.form.edit.title', 'Edit booking')}
          backHref="/backend/bookings"
          fields={fields}
          groups={groups}
          isLoading={isLoading}
          initialValues={initialValues}
          submitLabel={t('booking.events.form.edit.submit', 'Save changes')}
          cancelHref="/backend/bookings"
          successRedirect={successRedirect}
          deleteRedirect={deleteRedirect}
          deleteVisible
          onSubmit={async (values) => {
            try {
              const res = await apiFetch('/api/booking/bookings', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  event: {
                    id: values.id,
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
                }),
              })
              if (!res.ok) {
                const msg = await res.text().catch(() => '')
                throw new Error(msg || t('booking.events.form.flash.updateError', 'Failed to update booking.'))
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.events.form.flash.updateError', 'Failed to update booking.')
              flash(message, 'error')
              throw err
            }
          }}
          onDelete={async () => {
            try {
              const res = await apiFetch('/api/booking/bookings', {
                method: 'DELETE',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ id: bookingId }),
              })
              if (!res.ok) {
                const msg = await res.text().catch(() => '')
                throw new Error(msg || t('booking.events.form.flash.deleteError', 'Failed to delete booking.'))
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.events.form.flash.deleteError', 'Failed to delete booking.')
              flash(message, 'error')
              throw err
            }
          }}
        />
      </PageBody>
    </Page>
  )
}


