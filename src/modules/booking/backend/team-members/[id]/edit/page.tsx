"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFieldOption, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@/lib/i18n/context'

interface TeamMemberValues {
  id: string
  display_name: string
  user_id?: string | null
  role_ids: string[]
  is_active: boolean
  tags: string[]
}

async function loadRoleOptions(query?: string): Promise<CrudFieldOption[]> {
  try {
    const res = await apiFetch('/api/booking/team-roles')
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

export default function BookingTeamMemberEditPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const memberId = typeof params?.id === 'string' ? params.id : ''

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'display_name',
      label: t('booking.teamMembers.form.fields.displayName.label', 'Display name'),
      type: 'text',
      required: true,
    },
    {
      id: 'user_id',
      label: t('booking.teamMembers.form.fields.userId.label', 'Linked user ID'),
      type: 'text',
    },
    {
      id: 'role_ids',
      label: t('booking.teamMembers.form.fields.roles.label', 'Roles'),
      type: 'select',
      multiple: true,
      options: [],
      loadOptions: loadRoleOptions,
    },
    {
      id: 'tags',
      label: t('booking.teamMembers.form.fields.tags.label', 'Tags'),
      type: 'tags',
    },
    {
      id: 'is_active',
      label: t('booking.teamMembers.form.fields.isActive.label', 'Active'),
      type: 'checkbox',
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'profile', title: t('booking.teamMembers.form.groups.profile', 'Profile'), column: 1, fields: ['display_name', 'user_id'] },
    { id: 'roles', title: t('booking.teamMembers.form.groups.roles', 'Assignments'), column: 1, fields: ['role_ids', 'tags'] },
    { id: 'status', title: t('booking.teamMembers.form.groups.status', 'Status'), column: 2, fields: ['is_active'] },
  ], [t])

  const [initialValues, setInitialValues] = React.useState<Partial<TeamMemberValues> | undefined>(undefined)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    if (!memberId) return
    let active = true
    ;(async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/api/booking/team-members?id=${encodeURIComponent(memberId)}`)
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          const message = typeof payload?.error === 'string' ? payload.error : t('booking.teamMembers.form.flash.loadError', 'Failed to load team member.')
          throw new Error(message)
        }
        const item = payload?.item as Record<string, any>
        if (!item) throw new Error(t('booking.teamMembers.form.flash.loadError', 'Failed to load team member.'))
        const values: TeamMemberValues = {
          id: String(item.id),
          display_name: String(item.displayName ?? item.display_name ?? ''),
          user_id: typeof item.userId === 'string' ? item.userId : typeof item.user_id === 'string' ? item.user_id : null,
          role_ids: Array.isArray(item.roleIds)
            ? item.roleIds.filter((id): id is string => typeof id === 'string')
            : Array.isArray(item.role_ids)
              ? item.role_ids.filter((id: unknown): id is string => typeof id === 'string')
              : [],
          is_active: Boolean(item.isActive ?? item.is_active ?? true),
          tags: Array.isArray(item.tags) ? item.tags : [],
        }
        if (active) setInitialValues(values)
      } catch (err) {
        const message = err instanceof Error ? err.message : t('booking.teamMembers.form.flash.loadError', 'Failed to load team member.')
        flash(message, 'error')
        router.push('/backend/team-members')
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => { active = false }
  }, [memberId, router, t])

  const successMessage = t('booking.teamMembers.form.flash.updated', 'Team member updated.')
  const deleteMessage = t('booking.teamMembers.form.flash.deleted', 'Team member deleted.')

  const successRedirect = React.useMemo(
    () => `/backend/team-members?flash=${encodeURIComponent(successMessage)}&type=success`,
    [successMessage],
  )
  const deleteRedirect = React.useMemo(
    () => `/backend/team-members?flash=${encodeURIComponent(deleteMessage)}&type=success`,
    [deleteMessage],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<TeamMemberValues>
          title={t('booking.teamMembers.form.edit.title', 'Edit team member')}
          backHref="/backend/team-members"
          fields={fields}
          groups={groups}
          isLoading={isLoading}
          initialValues={initialValues}
          submitLabel={t('booking.teamMembers.form.edit.submit', 'Save changes')}
          cancelHref="/backend/team-members"
          successRedirect={successRedirect}
          deleteRedirect={deleteRedirect}
          deleteVisible
          onSubmit={async (values) => {
            try {
              const res = await apiFetch('/api/booking/team-members', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  id: values.id,
                  display_name: values.display_name,
                  user_id: values.user_id ?? null,
                  role_ids: Array.isArray(values.role_ids) ? values.role_ids : [],
                  tags: Array.isArray(values.tags) ? values.tags : [],
                  is_active: values.is_active ?? true,
                }),
              })
              if (!res.ok) {
                const msg = await res.text().catch(() => '')
                throw new Error(msg || t('booking.teamMembers.form.flash.updateError', 'Failed to update team member.'))
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.teamMembers.form.flash.updateError', 'Failed to update team member.')
              flash(message, 'error')
              throw err
            }
          }}
          onDelete={async () => {
            try {
              const res = await apiFetch('/api/booking/team-members', {
                method: 'DELETE',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ id: memberId }),
              })
              if (!res.ok) {
                const msg = await res.text().catch(() => '')
                throw new Error(msg || t('booking.teamMembers.form.flash.deleteError', 'Failed to delete team member.'))
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.teamMembers.form.flash.deleteError', 'Failed to delete team member.')
              flash(message, 'error')
              throw err
            }
          }}
        />
      </PageBody>
    </Page>
  )
}
