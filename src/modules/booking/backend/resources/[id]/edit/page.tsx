"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFieldOption, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@/lib/i18n/context'

interface ResourceValues {
  id: string
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
      .map((item) => ({ value: String((item as any).id ?? ''), label: String((item as any).name ?? '') }))
      .filter((option) => option.value && option.label && (!normalizedQuery || option.label.toLowerCase().includes(normalizedQuery)))
  } catch {
    return []
  }
}

export default function BookingResourceEditPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const resourceId = typeof params?.id === 'string' ? params.id : ''

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'name',
      label: t('booking.resources.form.fields.name.label', 'Resource name'),
      type: 'text',
      required: true,
    },
    {
      id: 'resource_type_id',
      label: t('booking.resources.form.fields.type.label', 'Resource type'),
      type: 'select',
      options: [],
      loadOptions: loadResourceTypeOptions,
    },
    {
      id: 'capacity',
      label: t('booking.resources.form.fields.capacity.label', 'Capacity'),
      type: 'number',
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
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('booking.resources.form.groups.details', 'Details'), column: 1, fields: ['name', 'resource_type_id'] },
    { id: 'attributes', title: t('booking.resources.form.groups.attributes', 'Attributes'), column: 1, fields: ['capacity', 'tags'] },
    { id: 'status', title: t('booking.resources.form.groups.status', 'Status'), column: 2, fields: ['is_active'] },
  ], [t])

  const [initialValues, setInitialValues] = React.useState<Partial<ResourceValues> | undefined>(undefined)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    if (!resourceId) return
    let active = true
    ;(async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/api/booking/resources?id=${encodeURIComponent(resourceId)}`)
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          const message = typeof payload?.error === 'string' ? payload.error : t('booking.resources.form.flash.loadError', 'Failed to load resource.')
          throw new Error(message)
        }
        const item = payload?.item as Record<string, any>
        if (!item) throw new Error(t('booking.resources.form.flash.loadError', 'Failed to load resource.'))
        const values: ResourceValues = {
          id: String(item.id),
          name: String(item.name ?? ''),
          resource_type_id: typeof item.resourceTypeId === 'string' ? item.resourceTypeId : typeof item.resource_type_id === 'string' ? item.resource_type_id : null,
          capacity: typeof item.capacity === 'number' ? item.capacity : null,
          is_active: Boolean(item.isActive ?? item.is_active ?? true),
          tags: Array.isArray(item.tags) ? item.tags : [],
        }
        if (active) setInitialValues(values)
      } catch (err) {
        const message = err instanceof Error ? err.message : t('booking.resources.form.flash.loadError', 'Failed to load resource.')
        flash(message, 'error')
        router.push('/backend/resources')
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => { active = false }
  }, [resourceId, router, t])

  const successMessage = t('booking.resources.form.flash.updated', 'Resource updated.')
  const deleteMessage = t('booking.resources.form.flash.deleted', 'Resource deleted.')

  const successRedirect = React.useMemo(
    () => `/backend/resources?flash=${encodeURIComponent(successMessage)}&type=success`,
    [successMessage],
  )
  const deleteRedirect = React.useMemo(
    () => `/backend/resources?flash=${encodeURIComponent(deleteMessage)}&type=success`,
    [deleteMessage],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<ResourceValues>
          title={t('booking.resources.form.edit.title', 'Edit resource')}
          backHref="/backend/resources"
          fields={fields}
          groups={groups}
          isLoading={isLoading}
          initialValues={initialValues}
          submitLabel={t('booking.resources.form.edit.submit', 'Save changes')}
          cancelHref="/backend/resources"
          successRedirect={successRedirect}
          deleteRedirect={deleteRedirect}
          deleteVisible
          onSubmit={async (values) => {
            try {
              const res = await apiFetch('/api/booking/resources', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  id: values.id,
                  name: values.name,
                  resource_type_id: values.resource_type_id ?? null,
                  capacity: values.capacity ?? null,
                  is_active: values.is_active ?? true,
                  tags: Array.isArray(values.tags) ? values.tags : [],
                }),
              })
              if (!res.ok) {
                const msg = await res.text().catch(() => '')
                throw new Error(msg || t('booking.resources.form.flash.updateError', 'Failed to update resource.'))
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.resources.form.flash.updateError', 'Failed to update resource.')
              flash(message, 'error')
              throw err
            }
          }}
          onDelete={async () => {
            try {
              const res = await apiFetch('/api/booking/resources', {
                method: 'DELETE',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ id: resourceId }),
              })
              if (!res.ok) {
                const msg = await res.text().catch(() => '')
                throw new Error(msg || t('booking.resources.form.flash.deleteError', 'Failed to delete resource.'))
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.resources.form.flash.deleteError', 'Failed to delete resource.')
              flash(message, 'error')
              throw err
            }
          }}
        />
      </PageBody>
    </Page>
  )
}

