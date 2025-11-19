"use client"

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@/lib/i18n/context'

interface TeamRoleValues {
  name: string
  description?: string | null
}

export default function BookingTeamRoleCreatePage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'name',
      label: t('booking.teamRoles.form.fields.name.label', 'Role name'),
      type: 'text',
      required: true,
      placeholder: t('booking.teamRoles.form.fields.name.placeholder', 'Consultant'),
    },
    {
      id: 'description',
      label: t('booking.teamRoles.form.fields.description.label', 'Description'),
      type: 'textarea',
      placeholder: t('booking.teamRoles.form.fields.description.placeholder', 'Optional description'),
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('booking.teamRoles.form.groups.details', 'Details'), column: 1, fields: ['name', 'description'] },
  ], [t])

  const successMessage = t('booking.teamRoles.form.flash.created', 'Role created.')
  const successRedirect = React.useMemo(
    () => `/backend/team-roles?flash=${encodeURIComponent(successMessage)}&type=success`,
    [successMessage],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<TeamRoleValues>
          title={t('booking.teamRoles.form.create.title', 'Create team role')}
          backHref="/backend/team-roles"
          fields={fields}
          groups={groups}
          submitLabel={t('booking.teamRoles.form.create.submit', 'Create role')}
          cancelHref="/backend/team-roles"
          successRedirect={successRedirect}
          onSubmit={async (values) => {
            try {
              await createCrud('booking/team-roles', {
                name: values.name,
                description: values.description ?? null,
              })
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.teamRoles.form.flash.createError', 'Failed to create role.')
              flash(message, 'error')
              throw err
            }
          }}
        />
      </PageBody>
    </Page>
  )
}

