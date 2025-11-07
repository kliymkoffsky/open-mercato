export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.resources.manage'],
  pageTitle: 'Create resource type',
  pageTitleKey: 'booking.resourceTypes.form.create.title',
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Resource types', labelKey: 'booking.nav.resourceTypes', href: '/backend/resource-types' },
    { label: 'Create', labelKey: 'booking.nav.resourceTypes.create' },
  ],
}
