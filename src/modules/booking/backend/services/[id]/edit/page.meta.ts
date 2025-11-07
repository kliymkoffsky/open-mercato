export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.services.manage'],
  pageTitle: 'Edit service',
  pageTitleKey: 'booking.services.form.edit.title',
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Services', labelKey: 'booking.nav.services', href: '/backend/services' },
    { label: 'Edit', labelKey: 'booking.nav.services.edit' },
  ],
}


