"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@/lib/i18n/context'

interface TeamRoleValues {
  id: string
  name: string
  description?: string | null
}

export default function BookingTeamRoleEditPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const roleId = typeof params?.id === 'string' ? params.id : ''

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'name',
      label: t('booking.teamRoles.form.fields.name.label', 'Role name'),
      type: 'text',
      required: true,
    },
    {
      id: 'description',
      label: t('booking.teamRoles.form.fields.description.label', 'Description'),
      type: 'textarea',
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'details', title: t('booking.teamRoles.form.groups.details', 'Details'), column: 1, fields: ['name', 'description'] },
  ], [t])

  const [initialValues, setInitialValues] = React.useState<Partial<TeamRoleValues> | undefined>(undefined)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    if (!roleId) return
    let active = true
    ;(async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/api/booking/team-roles?id=${encodeURIComponent(roleId)}`)
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          const message = typeof payload?.error === 'string' ? payload.error : t('booking.teamRoles.form.flash.loadError', 'Failed to load role.')
          throw new Error(message)
        }
        const item = payload?.item as Record<string, any>
        if (!item) throw new Error(t('booking.teamRoles.form.flash.loadError', 'Failed to load role.'))
        const values: TeamRoleValues = {
          id: String(item.id),
          name: String(item.name ?? ''),
          description: item.description ?? null,
        }
        if (active) setInitialValues(values)
      } catch (err) {
        const message = err instanceof Error ? err.message : t('booking.teamRoles.form.flash.loadError', 'Failed to load role.')
        flash(message, 'error')
        router.push('/backend/team-roles')
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => { active = false }
  }, [roleId, router, t])

  const successMessage = t('booking.teamRoles.form.flash.updated', 'Role updated.')
  const deleteMessage = t('booking.teamRoles.form.flash.deleted', 'Role deleted.')

  const successRedirect = React.useMemo(
    () => `/backend/team-roles?flash=${encodeURIComponent(successMessage)}&type=success`,
    [successMessage],
  )
  const deleteRedirect = React.useMemo(
    () => `/backend/team-roles?flash=${encodeURIComponent(deleteMessage)}&type=success`,
    [deleteMessage],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<TeamRoleValues>
          title={t('booking.teamRoles.form.edit.title', 'Edit team role')}
          backHref="/backend/team-roles"
          fields={fields}
          groups={groups}
          isLoading={isLoading}
          initialValues={initialValues}
          submitLabel={t('booking.teamRoles.form.edit.submit', 'Save changes')}
          cancelHref="/backend/team-roles"
          successRedirect={successRedirect}
          deleteRedirect={deleteRedirect}
          deleteVisible
          onSubmit={async (values) => {
            try {
              const res = await apiFetch('/api/booking/team-roles', {
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
                throw new Error(msg || t('booking.teamRoles.form.flash.updateError', 'Failed to update role.'))
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.teamRoles.form.flash.updateError', 'Failed to update role.')
              flash(message, 'error')
              throw err
            }
          }}
          onDelete={async () => {
            try {
              const res = await apiFetch('/api/booking/team-roles', {
                method: 'DELETE',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ id: roleId }),
              })
              if (!res.ok) {
                const msg = await res.text().catch(() => '')
                throw new Error(msg || t('booking.teamRoles.form.flash.deleteError', 'Failed to delete role.'))
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.teamRoles.form.flash.deleteError', 'Failed to delete role.')
              flash(message, 'error')
              throw err
            }
          }}
        />
      </PageBody>
    </Page>
  )
}

