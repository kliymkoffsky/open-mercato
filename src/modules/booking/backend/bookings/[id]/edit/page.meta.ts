export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.edit'],
  pageTitle: 'Edit booking',
  pageTitleKey: 'booking.events.form.edit.title',
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Bookings', labelKey: 'booking.nav.bookings', href: '/backend/bookings' },
    { label: 'Edit', labelKey: 'booking.nav.bookings.edit' },
  ],
}


