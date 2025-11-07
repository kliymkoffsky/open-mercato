export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.members.manage'],
  pageTitle: 'Create availability rule',
  pageTitleKey: 'booking.availability.form.create.title',
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Availability', labelKey: 'booking.nav.availability', href: '/backend/availability' },
    { label: 'Create', labelKey: 'booking.nav.availability.create' },
  ],
}

