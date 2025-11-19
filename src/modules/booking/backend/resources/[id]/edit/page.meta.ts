export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.resources.manage'],
  pageTitle: 'Edit resource',
  pageTitleKey: 'booking.resources.form.edit.title',
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Resources', labelKey: 'booking.nav.resources', href: '/backend/resources' },
    { label: 'Edit', labelKey: 'booking.nav.resources.edit' },
  ],
}

