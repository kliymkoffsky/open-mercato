"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@/lib/i18n/context'

type ServiceFormValues = {
  name: string
  description?: string | null
  duration_minutes: number
  capacity_model: 'one_to_one' | 'one_to_many' | 'many_to_many'
  max_attendees?: number | null
  is_active: boolean
  tags: string[]
}

export default function BookingServiceCreatePage() {
  const t = useT()
  const router = useRouter()

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'name',
      label: t('booking.services.form.fields.name.label', 'Service name'),
      type: 'text',
      required: true,
      placeholder: t('booking.services.form.fields.name.placeholder', 'Consultation'),
    },
    {
      id: 'description',
      label: t('booking.services.form.fields.description.label', 'Description'),
      type: 'textarea',
      placeholder: t('booking.services.form.fields.description.placeholder', 'Optional details shown internally'),
    },
    {
      id: 'duration_minutes',
      label: t('booking.services.form.fields.duration.label', 'Duration (minutes)'),
      type: 'number',
      required: true,
      placeholder: '45',
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
      placeholder: '10',
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
      placeholder: t('booking.services.form.fields.tags.placeholder', 'wellness, onboarding'),
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('booking.services.form.groups.details', 'Details'), column: 1, fields: ['name', 'description'] },
    { id: 'timing', title: t('booking.services.form.groups.timing', 'Scheduling'), column: 1, fields: ['duration_minutes', 'capacity_model', 'max_attendees'] },
    { id: 'status', title: t('booking.services.form.groups.status', 'Status'), column: 2, fields: ['is_active', 'tags'] },
  ], [t])

  const successMessage = t('booking.services.form.flash.created', 'Service created.')
  const successRedirect = React.useMemo(
    () => `/backend/services?flash=${encodeURIComponent(successMessage)}&type=success`,
    [successMessage],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<ServiceFormValues>
          title={t('booking.services.form.create.title', 'Create booking service')}
          backHref="/backend/services"
          fields={fields}
          groups={groups}
          submitLabel={t('booking.services.form.create.submit', 'Create service')}
          cancelHref="/backend/services"
          successRedirect={successRedirect}
          onSubmit={async (values) => {
            try {
              const payload = {
                name: values.name,
                description: values.description ?? null,
                duration_minutes: Number(values.duration_minutes) || 0,
                capacity_model: values.capacity_model,
                max_attendees: values.max_attendees ?? null,
                is_active: values.is_active ?? false,
                tags: Array.isArray(values.tags) ? values.tags : [],
              }
              await createCrud('booking/services', payload)
            } catch (err: any) {
              const message = err instanceof Error ? err.message : t('booking.services.form.flash.createError', 'Failed to create service.')
              flash(message, 'error')
              throw err
            }
          }}
          onDelete={undefined}
        />
      </PageBody>
    </Page>
  )
}



