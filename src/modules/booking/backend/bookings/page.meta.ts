import React from 'react'

const calendarCheckIcon = React.createElement('svg', {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
},
  React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, ry: 2 }),
  React.createElement('line', { x1: 16, y1: 2, x2: 16, y2: 6 }),
  React.createElement('line', { x1: 8, y1: 2, x2: 8, y2: 6 }),
  React.createElement('line', { x1: 3, y1: 10, x2: 21, y2: 10 }),
  React.createElement('polyline', { points: '9 16 11 18 15 14' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.view'],
  pageTitle: 'Bookings',
  pageTitleKey: 'booking.nav.bookings',
  pageGroup: 'Booking',
  pageGroupKey: 'booking.nav.group',
  pageOrder: 260,
  icon: calendarCheckIcon,
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Bookings', labelKey: 'booking.nav.bookings' },
  ],
}

