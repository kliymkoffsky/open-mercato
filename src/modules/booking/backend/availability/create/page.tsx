"use client"

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import {
  CrudForm,
  type CrudField,
  type CrudFormGroup,
} from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@/lib/i18n/context'
import { AvailabilityRuleBuilder } from '../../../components/AvailabilityRuleBuilder'

interface AvailabilityValues {
  subject_type: 'member' | 'resource'
  subject_id: string
  timezone: string
  rrule: string
  exdates: string[]
}

export default function BookingAvailabilityCreatePage() {
  const t = useT()

  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'subject_type',
      label: t('booking.availability.form.fields.subjectType.label', 'Subject type'),
      type: 'select',
      required: true,
      options: [
        { value: 'member', label: t('booking.availability.form.subject.member', 'Team member') },
        { value: 'resource', label: t('booking.availability.form.subject.resource', 'Resource') },
      ],
    },
    {
      id: 'subject_id',
      label: t('booking.availability.form.fields.subjectId.label', 'Subject ID'),
      type: 'text',
      required: true,
      placeholder: t('booking.availability.form.fields.subjectId.placeholder', 'UUID of member or resource'),
    },
    {
      id: 'timezone',
      label: t('booking.availability.form.fields.timezone.label', 'Timezone'),
      type: 'text',
      required: true,
      placeholder: 'Europe/Paris',
    },
    {
      id: 'rrule',
      label: t('booking.availability.form.fields.rrule.label', 'Recurrence rule'),
      type: 'text',
      required: true,
      placeholder: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    },
    {
      id: 'exdates',
      label: t('booking.availability.form.fields.exdates.label', 'Exceptions (ISO dates)'),
      type: 'tags',
      placeholder: '2025-11-10T09:00:00',
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'subject', title: t('booking.availability.form.groups.subject', 'Subject'), column: 1, fields: ['subject_type', 'subject_id'] },
    { id: 'timing', title: t('booking.availability.form.groups.timing', 'Timing'), column: 1, fields: ['timezone', 'rrule', 'exdates'] },
    {
      id: 'builder',
      title: t('booking.availability.form.groups.builder', 'Visual builder'),
      column: 2,
      component: (ctx) => <AvailabilityRuleBuilder {...ctx} t={t} />,
    },
  ], [t])

  const successMessage = t('booking.availability.form.flash.created', 'Availability rule created.')
  const successRedirect = React.useMemo(
    () => `/backend/availability?flash=${encodeURIComponent(successMessage)}&type=success`,
    [successMessage],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<AvailabilityValues>
          title={t('booking.availability.form.create.title', 'Create availability rule')}
          backHref="/backend/availability"
          fields={fields}
          groups={groups}
          submitLabel={t('booking.availability.form.create.submit', 'Create rule')}
          cancelHref="/backend/availability"
          successRedirect={successRedirect}
          onSubmit={async (values) => {
            try {
              await createCrud('booking/availability', {
                subject_type: values.subject_type,
                subject_id: values.subject_id,
                timezone: values.timezone,
                rrule: values.rrule,
                exdates: Array.isArray(values.exdates) ? values.exdates : [],
              })
            } catch (err) {
              const message = err instanceof Error ? err.message : t('booking.availability.form.flash.createError', 'Failed to create availability rule.')
              flash(message, 'error')
              throw err
            }
          }}
        />
      </PageBody>
    </Page>
  )
}

