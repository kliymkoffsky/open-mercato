"use client"

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFieldOption, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@/lib/i18n/context'

interface TeamMemberValues {
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
      .map((item) => ({
        value: String((item as any).id ?? ''),
        label: String((item as any).name ?? ''),
      }))
      .filter((option) => option.value && option.label && (!normalized || option.label.toLowerCase().includes(normalized)))
  } catch {
    return []
  }
}

export default function BookingTeamMemberCreatePage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'display_name',
      label: t('booking.teamMembers.form.fields.displayName.label', 'Display name'),
      type: 'text',
      required: true,
      placeholder: t('booking.teamMembers.form.fields.displayName.placeholder', 'Alex Smith'),
    },
    {
      id: 'user_id',
      label: t('booking.teamMembers.form.fields.userId.label', 'Linked user ID'),
      type: 'text',
      placeholder: t('booking.teamMembers.form.fields.userId.placeholder', 'Optional user UUID'),
    },
    {
      id: 'role_ids',
      label: t('booking.teamMembers.form.fields.roles.label', 'Roles'),
      type: 'select',
      multiple: true,
      options: [],
      loadOptions: loadRoleOptions,
      placeholder: t('booking.teamMembers.form.fields.roles.placeholder', 'Select roles'),
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
      required: false,
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'profile', title: t('booking.teamMembers.form.groups.profile', 'Profile'), column: 1, fields: ['display_name', 'user_id'] },
    { id: 'roles', title: t('booking.teamMembers.form.groups.roles', 'Assignments'), column: 1, fields: ['role_ids', 'tags'] },
    { id: 'status', title: t('booking.teamMembers.form.groups.status', 'Status'), column: 2, fields: ['is_active'] },
  ], [t])

  const successMessage = t('booking.teamMembers.form.flash.created', 'Team member created.')
  const successRedirect = React.useMemo(
    () => `/backend/team-members?flash=${encodeURIComponent(successMessage)}&type=success`,
    [successMessage],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<TeamMemberValues>
          title={t('booking.teamMembers.form.create.title', 'Add team member')}
          backHref="/backend/team-members"
          fields={fields}
          groups={groups}
          submitLabel={t('booking.teamMembers.form.create.submit', 'Create member')}
          cancelHref="/backend/team-members"
          successRedirect={successRedirect}
          onSubmit={async (values) => {
            try {
              await createCrud('booking/team-members', {
                display_name: values.display_name,
                user_id: values.user_id ? values.user_id : null,
                role_ids: Array.isArray(values.role_ids) ? values.role_ids : [],
                tags: Array.isArray(values.tags) ? values.tags : [],
                is_active: values.is_active ?? true,
              })
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.teamMembers.form.flash.createError', 'Failed to create team member.')
              flash(message, 'error')
              throw err
            }
          }}
        />
      </PageBody>
    </Page>
  )
}
