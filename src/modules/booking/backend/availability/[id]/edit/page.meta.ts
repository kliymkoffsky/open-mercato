export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.services.manage'],
  pageTitle: 'Edit availability rule',
  pageTitleKey: 'booking.availability.form.edit.title',
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Availability', labelKey: 'booking.nav.availability', href: '/backend/availability' },
    { label: 'Edit', labelKey: 'booking.nav.availability.edit' },
  ],
}

