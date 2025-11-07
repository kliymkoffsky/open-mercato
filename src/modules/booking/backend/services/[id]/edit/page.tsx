"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import { useT } from '@/lib/i18n/context'

type ServiceFormValues = {
  id: string
  name: string
  description?: string | null
  duration_minutes: number
  capacity_model: 'one_to_one' | 'one_to_many' | 'many_to_many'
  max_attendees?: number | null
  is_active: boolean
  tags: string[]
}

export default function BookingServiceEditPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const serviceId = React.useMemo(() => (typeof params?.id === 'string' ? params.id : ''), [params])

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'name',
      label: t('booking.services.form.fields.name.label', 'Service name'),
      type: 'text',
      required: true,
    },
    {
      id: 'description',
      label: t('booking.services.form.fields.description.label', 'Description'),
      type: 'textarea',
    },
    {
      id: 'duration_minutes',
      label: t('booking.services.form.fields.duration.label', 'Duration (minutes)'),
      type: 'number',
      required: true,
    },
    {
      id: 'capacity_model',
      label: t('booking.services.form.fields.capacityModel.label', 'Capacity model'),
      type: 'select',
      required: true,
      options: [
        { value: 'one_to_one', label: t('booking.services.form.capacity.one_to_one', 'One to one') },
        { value: 'one_to_many', label: t('booking.services.form.capacity.one_to_many', 'One to many') },
        { value: 'many_to_many', label: t('booking.services.form.capacity.many_to_many', 'Many to many') },
      ],
    },
    {
      id: 'max_attendees',
      label: t('booking.services.form.fields.maxAttendees.label', 'Max attendees'),
      type: 'number',
    },
    {
      id: 'is_active',
      label: t('booking.services.form.fields.isActive.label', 'Active'),
      type: 'checkbox',
    },
    {
      id: 'tags',
      label: t('booking.services.form.fields.tags.label', 'Tags'),
      type: 'tags',
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('booking.services.form.groups.details', 'Details'), column: 1, fields: ['name', 'description'] },
    { id: 'timing', title: t('booking.services.form.groups.timing', 'Scheduling'), column: 1, fields: ['duration_minutes', 'capacity_model', 'max_attendees'] },
    { id: 'status', title: t('booking.services.form.groups.status', 'Status'), column: 2, fields: ['is_active', 'tags'] },
  ], [t])

  const [initialValues, setInitialValues] = React.useState<Partial<ServiceFormValues> | undefined>(undefined)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    if (!serviceId) return
    let active = true
    ;(async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/api/booking/services?id=${encodeURIComponent(serviceId)}`)
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          const message = typeof payload?.error === 'string' ? payload.error : t('booking.services.form.flash.loadError', 'Failed to load service.')
          throw new Error(message)
        }
        const item = payload?.item as Record<string, any> | undefined
        if (!item) throw new Error(t('booking.services.form.flash.loadError', 'Failed to load service.'))
        const values: ServiceFormValues = {
          id: String(item.id),
          name: String(item.name ?? ''),
          description: item.description ?? null,
          duration_minutes: Number(item.durationMinutes ?? item.duration_minutes ?? 0),
          capacity_model: (item.capacityModel ?? item.capacity_model ?? 'one_to_one') as 'one_to_one' | 'one_to_many' | 'many_to_many',
          max_attendees: item.maxAttendees ?? item.max_attendees ?? null,
          is_active: Boolean(item.isActive ?? item.is_active ?? true),
          tags: Array.isArray(item.tags) ? item.tags : [],
        }
        if (active) setInitialValues(values)
      } catch (err) {
        const message = err instanceof Error ? err.message : t('booking.services.form.flash.loadError', 'Failed to load service.')
        flash(message, 'error')
        router.push('/backend/services')
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => { active = false }
  }, [serviceId, router, t])

  const successMessage = t('booking.services.form.flash.updated', 'Service updated.')
  const deleteMessage = t('booking.services.form.flash.deleted', 'Service deleted.')

  const successRedirect = React.useMemo(
    () => `/backend/services?flash=${encodeURIComponent(successMessage)}&type=success`,
    [successMessage],
  )

  const deleteRedirect = React.useMemo(
    () => `/backend/services?flash=${encodeURIComponent(deleteMessage)}&type=success`,
    [deleteMessage],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<ServiceFormValues>
          title={t('booking.services.form.edit.title', 'Edit booking service')}
          backHref="/backend/services"
          fields={fields}
          groups={groups}
          isLoading={isLoading}
          initialValues={initialValues}
          submitLabel={t('booking.services.form.edit.submit', 'Save changes')}
          cancelHref="/backend/services"
          successRedirect={successRedirect}
          deleteRedirect={deleteRedirect}
          deleteVisible
          onSubmit={async (values) => {
            try {
              const payload = {
                id: values.id,
                name: values.name,
                description: values.description ?? null,
                duration_minutes: Number(values.duration_minutes) || 0,
                capacity_model: values.capacity_model,
                max_attendees: values.max_attendees ?? null,
                is_active: values.is_active ?? true,
                tags: Array.isArray(values.tags) ? values.tags : [],
              }
              const res = await apiFetch('/api/booking/services', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
              })
              if (!res.ok) {
                const msg = await res.text().catch(() => '')
                throw new Error(msg || t('booking.services.form.flash.updateError', 'Failed to update service.'))
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.services.form.flash.updateError', 'Failed to update service.')
              flash(message, 'error')
              throw err
            }
          }}
          onDelete={async () => {
            try {
              const res = await apiFetch('/api/booking/services', {
                method: 'DELETE',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ id: serviceId }),
              })
              if (!res.ok) {
                const msg = await res.text().catch(() => '')
                throw new Error(msg || t('booking.services.form.flash.deleteError', 'Failed to delete service.'))
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.services.form.flash.deleteError', 'Failed to delete service.')
              flash(message, 'error')
              throw err
            }
          }}
        />
      </PageBody>
    </Page>
  )
}


