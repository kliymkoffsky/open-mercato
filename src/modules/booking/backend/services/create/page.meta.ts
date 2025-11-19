export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.services.manage'],
  pageTitle: 'Create booking service',
  pageTitleKey: 'booking.services.form.create.title',
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Services', labelKey: 'booking.nav.services', href: '/backend/services' },
    { label: 'Create', labelKey: 'booking.nav.services.create' },
  ],
}



