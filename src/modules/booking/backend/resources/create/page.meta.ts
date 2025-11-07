export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.resources.manage'],
  pageTitle: 'Create resource',
  pageTitleKey: 'booking.resources.form.create.title',
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Resources', labelKey: 'booking.nav.resources', href: '/backend/resources' },
    { label: 'Create', labelKey: 'booking.nav.resources.create' },
  ],
}
