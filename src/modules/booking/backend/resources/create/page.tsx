"use client"

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFieldOption, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@/lib/i18n/context'

interface ResourceValues {
  name: string
  resource_type_id?: string | null
  capacity?: number | null
  is_active: boolean
  tags: string[]
}

async function loadResourceTypeOptions(query?: string): Promise<CrudFieldOption[]> {
  try {
    const res = await apiFetch('/api/booking/resource-types')
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) return []
    const items = Array.isArray(payload?.items) ? payload.items : []
    const normalizedQuery = (query ?? '').trim().toLowerCase()
    return items
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        value: String((item as any).id ?? ''),
        label: String((item as any).name ?? ''),
      }))
      .filter((option) => option.value && option.label && (!normalizedQuery || option.label.toLowerCase().includes(normalizedQuery)))
  } catch {
    return []
  }
}

export default function BookingResourceCreatePage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'name',
      label: t('booking.resources.form.fields.name.label', 'Resource name'),
      type: 'text',
      required: true,
      placeholder: t('booking.resources.form.fields.name.placeholder', 'Room A'),
    },
    {
      id: 'resource_type_id',
      label: t('booking.resources.form.fields.type.label', 'Resource type'),
      type: 'select',
      options: [],
      loadOptions: loadResourceTypeOptions,
      placeholder: t('booking.resources.form.fields.type.placeholder', 'Select type'),
    },
    {
      id: 'capacity',
      label: t('booking.resources.form.fields.capacity.label', 'Capacity'),
      type: 'number',
      placeholder: '4',
    },
    {
      id: 'is_active',
      label: t('booking.resources.form.fields.isActive.label', 'Active'),
      type: 'checkbox',
    },
    {
      id: 'tags',
      label: t('booking.resources.form.fields.tags.label', 'Tags'),
      type: 'tags',
      placeholder: t('booking.resources.form.fields.tags.placeholder', 'chair, microscope'),
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('booking.resources.form.groups.details', 'Details'), column: 1, fields: ['name', 'resource_type_id'] },
    { id: 'attributes', title: t('booking.resources.form.groups.attributes', 'Attributes'), column: 1, fields: ['capacity', 'tags'] },
    { id: 'status', title: t('booking.resources.form.groups.status', 'Status'), column: 2, fields: ['is_active'] },
  ], [t])

  const successMessage = t('booking.resources.form.flash.created', 'Resource created.')
  const successRedirect = React.useMemo(
    () => `/backend/resources?flash=${encodeURIComponent(successMessage)}&type=success`,
    [successMessage],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<ResourceValues>
          title={t('booking.resources.form.create.title', 'Create resource')}
          backHref="/backend/resources"
          fields={fields}
          groups={groups}
          submitLabel={t('booking.resources.form.create.submit', 'Create resource')}
          cancelHref="/backend/resources"
          successRedirect={successRedirect}
          onSubmit={async (values) => {
            try {
              await createCrud('booking/resources', {
                name: values.name,
                resource_type_id: values.resource_type_id ?? null,
                capacity: values.capacity ?? null,
                is_active: values.is_active ?? false,
                tags: Array.isArray(values.tags) ? values.tags : [],
              })
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.resources.form.flash.createError', 'Failed to create resource.')
              flash(message, 'error')
              throw err
            }
          }}
        />
      </PageBody>
    </Page>
  )
}

