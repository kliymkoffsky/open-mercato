export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.create'],
  pageTitle: 'Create booking',
  pageTitleKey: 'booking.events.form.create.title',
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Bookings', labelKey: 'booking.nav.bookings', href: '/backend/bookings' },
    { label: 'Create', labelKey: 'booking.nav.bookings.create' },
  ],
}


