"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@/lib/i18n/context'

interface AvailabilityValues {
  id: string
  subject_type: 'member' | 'resource'
  subject_id: string
  timezone: string
  rrule: string
  exdates: string[]
}

export default function BookingAvailabilityEditPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const availabilityId = typeof params?.id === 'string' ? params.id : ''

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'subject_type',
      label: t('booking.availability.form.fields.subjectType.label', 'Subject type'),
      type: 'select',
      required: true,
      options: [
        { value: 'member', label: t('booking.availability.form.subject.member', 'Team member') },
        { value: 'resource', label: t('booking.availability.form.subject.resource', 'Resource') },
      ],
    },
    {
      id: 'subject_id',
      label: t('booking.availability.form.fields.subjectId.label', 'Subject ID'),
      type: 'text',
      required: true,
    },
    {
      id: 'timezone',
      label: t('booking.availability.form.fields.timezone.label', 'Timezone'),
      type: 'text',
      required: true,
    },
    {
      id: 'rrule',
      label: t('booking.availability.form.fields.rrule.label', 'Recurrence rule'),
      type: 'text',
      required: true,
    },
    {
      id: 'exdates',
      label: t('booking.availability.form.fields.exdates.label', 'Exceptions (ISO dates)'),
      type: 'tags',
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'subject', title: t('booking.availability.form.groups.subject', 'Subject'), column: 1, fields: ['subject_type', 'subject_id'] },
    { id: 'timing', title: t('booking.availability.form.groups.timing', 'Timing'), column: 1, fields: ['timezone', 'rrule', 'exdates'] },
  ], [t])

  const [initialValues, setInitialValues] = React.useState<Partial<AvailabilityValues> | undefined>(undefined)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    if (!availabilityId) return
    let active = true
    ;(async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/api/booking/availability?id=${encodeURIComponent(availabilityId)}`)
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          const message = typeof payload?.error === 'string' ? payload.error : t('booking.availability.form.flash.loadError', 'Failed to load availability rule.')
          throw new Error(message)
        }
        const item = payload?.item as Record<string, any>
        if (!item) throw new Error(t('booking.availability.form.flash.loadError', 'Failed to load availability rule.'))
        const values: AvailabilityValues = {
          id: String(item.id),
          subject_type: (item.subjectType ?? item.subject_type ?? 'member') as 'member' | 'resource',
          subject_id: String(item.subjectId ?? item.subject_id ?? ''),
          timezone: String(item.timezone ?? 'UTC'),
          rrule: String(item.rrule ?? ''),
          exdates: Array.isArray(item.exdates) ? item.exdates : [],
        }
        if (active) setInitialValues(values)
      } catch (err) {
        const message = err instanceof Error ? err.message : t('booking.availability.form.flash.loadError', 'Failed to load availability rule.')
        flash(message, 'error')
        router.push('/backend/availability')
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => { active = false }
  }, [availabilityId, router, t])

  const successMessage = t('booking.availability.form.flash.updated', 'Availability rule updated.')
  const deleteMessage = t('booking.availability.form.flash.deleted', 'Availability rule deleted.')

  const successRedirect = React.useMemo(
    () => `/backend/availability?flash=${encodeURIComponent(successMessage)}&type=success`,
    [successMessage],
  )
  const deleteRedirect = React.useMemo(
    () => `/backend/availability?flash=${encodeURIComponent(deleteMessage)}&type=success`,
    [deleteMessage],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<AvailabilityValues>
          title={t('booking.availability.form.edit.title', 'Edit availability rule')}
          backHref="/backend/availability"
          fields={fields}
          groups={groups}
          isLoading={isLoading}
          initialValues={initialValues}
          submitLabel={t('booking.availability.form.edit.submit', 'Save changes')}
          cancelHref="/backend/availability"
          successRedirect={successRedirect}
          deleteRedirect={deleteRedirect}
          deleteVisible
          onSubmit={async (values) => {
            try {
              const res = await apiFetch('/api/booking/availability', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  id: values.id,
                  subject_type: values.subject_type,
                  subject_id: values.subject_id,
                  timezone: values.timezone,
                  rrule: values.rrule,
                  exdates: Array.isArray(values.exdates) ? values.exdates : [],
                }),
              })
              if (!res.ok) {
                const msg = await res.text().catch(() => '')
                throw new Error(msg || t('booking.availability.form.flash.updateError', 'Failed to update availability rule.'))
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.availability.form.flash.updateError', 'Failed to update availability rule.')
              flash(message, 'error')
              throw err
            }
          }}
          onDelete={async () => {
            try {
              const res = await apiFetch('/api/booking/availability', {
                method: 'DELETE',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ id: availabilityId }),
              })
              if (!res.ok) {
                const msg = await res.text().catch(() => '')
                throw new Error(msg || t('booking.availability.form.flash.deleteError', 'Failed to delete availability rule.'))
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.availability.form.flash.deleteError', 'Failed to delete availability rule.')
              flash(message, 'error')
              throw err
            }
          }}
        />
      </PageBody>
    </Page>
  )
}

