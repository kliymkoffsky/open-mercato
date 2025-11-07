export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.resources.manage'],
  pageTitle: 'Edit resource type',
  pageTitleKey: 'booking.resourceTypes.form.edit.title',
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Resource types', labelKey: 'booking.nav.resourceTypes', href: '/backend/resource-types' },
    { label: 'Edit', labelKey: 'booking.nav.resourceTypes.edit' },
  ],
}
