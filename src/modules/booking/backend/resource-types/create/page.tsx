"use client"

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@/lib/i18n/context'

interface ResourceTypeValues {
  name: string
  description?: string | null
}

export default function BookingResourceTypeCreatePage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'name',
      label: t('booking.resourceTypes.form.fields.name.label', 'Resource type name'),
      type: 'text',
      required: true,
      placeholder: t('booking.resourceTypes.form.fields.name.placeholder', 'Therapy room'),
    },
    {
      id: 'description',
      label: t('booking.resourceTypes.form.fields.description.label', 'Description'),
      type: 'textarea',
      placeholder: t('booking.resourceTypes.form.fields.description.placeholder', 'Optional description'),
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('booking.resourceTypes.form.groups.details', 'Details'), column: 1, fields: ['name', 'description'] },
  ], [t])

  const successMessage = t('booking.resourceTypes.form.flash.created', 'Resource type created.')
  const successRedirect = React.useMemo(
    () => `/backend/resource-types?flash=${encodeURIComponent(successMessage)}&type=success`,
    [successMessage],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<ResourceTypeValues>
          title={t('booking.resourceTypes.form.create.title', 'Create resource type')}
          backHref="/backend/resource-types"
          fields={fields}
          groups={groups}
          submitLabel={t('booking.resourceTypes.form.create.submit', 'Create resource type')}
          cancelHref="/backend/resource-types"
          successRedirect={successRedirect}
          onSubmit={async (values) => {
            try {
              await createCrud('booking/resource-types', {
                name: values.name,
                description: values.description ?? null,
              })
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.resourceTypes.form.flash.createError', 'Failed to create resource type.')
              flash(message, 'error')
              throw err
            }
          }}
        />
      </PageBody>
    </Page>
  )
}
