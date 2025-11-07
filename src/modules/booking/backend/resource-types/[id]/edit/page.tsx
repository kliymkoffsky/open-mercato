"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@/lib/i18n/context'

interface ResourceTypeValues {
  id: string
  name: string
  description?: string | null
}

export default function BookingResourceTypeEditPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const resourceTypeId = typeof params?.id === 'string' ? params.id : ''

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'name',
      label: t('booking.resourceTypes.form.fields.name.label', 'Resource type name'),
      type: 'text',
      required: true,
    },
    {
      id: 'description',
      label: t('booking.resourceTypes.form.fields.description.label', 'Description'),
      type: 'textarea',
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('booking.resourceTypes.form.groups.details', 'Details'), column: 1, fields: ['name', 'description'] },
  ], [t])

  const [initialValues, setInitialValues] = React.useState<Partial<ResourceTypeValues> | undefined>(undefined)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    if (!resourceTypeId) return
    let active = true
    ;(async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/api/booking/resource-types?id=${encodeURIComponent(resourceTypeId)}`)
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          const message = typeof payload?.error === 'string' ? payload.error : t('booking.resourceTypes.form.flash.loadError', 'Failed to load resource type.')
          throw new Error(message)
        }
        const item = payload?.item as Record<string, any>
        if (!item) throw new Error(t('booking.resourceTypes.form.flash.loadError', 'Failed to load resource type.'))
        const values: ResourceTypeValues = {
          id: String(item.id),
          name: String(item.name ?? ''),
          description: item.description ?? null,
        }
        if (active) setInitialValues(values)
      } catch (err) {
        const message = err instanceof Error ? err.message : t('booking.resourceTypes.form.flash.loadError', 'Failed to load resource type.')
        flash(message, 'error')
        router.push('/backend/resource-types')
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => { active = false }
  }, [resourceTypeId, router, t])

  const successMessage = t('booking.resourceTypes.form.flash.updated', 'Resource type updated.')
  const deleteMessage = t('booking.resourceTypes.form.flash.deleted', 'Resource type deleted.')

  const successRedirect = React.useMemo(
    () => `/backend/resource-types?flash=${encodeURIComponent(successMessage)}&type=success`,
    [successMessage],
  )
  const deleteRedirect = React.useMemo(
    () => `/backend/resource-types?flash=${encodeURIComponent(deleteMessage)}&type=success`,
    [deleteMessage],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<ResourceTypeValues>
          title={t('booking.resourceTypes.form.edit.title', 'Edit resource type')}
          backHref="/backend/resource-types"
          fields={fields}
          groups={groups}
          isLoading={isLoading}
          initialValues={initialValues}
          submitLabel={t('booking.resourceTypes.form.edit.submit', 'Save changes')}
          cancelHref="/backend/resource-types"
          successRedirect={successRedirect}
          deleteRedirect={deleteRedirect}
          deleteVisible
          onSubmit={async (values) => {
            try {
              const res = await apiFetch('/api/booking/resource-types', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  id: values.id,
                  name: values.name,
                  description: values.description ?? null,
                }),
              })
              if (!res.ok) {
                const msg = await res.text().catch(() => '')
                throw new Error(msg || t('booking.resourceTypes.form.flash.updateError', 'Failed to update resource type.'))
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.resourceTypes.form.flash.updateError', 'Failed to update resource type.')
              flash(message, 'error')
              throw err
            }
          }}
          onDelete={async () => {
            try {
              const res = await apiFetch('/api/booking/resource-types', {
                method: 'DELETE',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ id: resourceTypeId }),
              })
              if (!res.ok) {
                const msg = await res.text().catch(() => '')
                throw new Error(msg || t('booking.resourceTypes.form.flash.deleteError', 'Failed to delete resource type.'))
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.resourceTypes.form.flash.deleteError', 'Failed to delete resource type.')
              flash(message, 'error')
              throw err
            }
          }}
        />
      </PageBody>
    </Page>
  )
}
