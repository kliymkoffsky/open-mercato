import React from 'react'

const clockIcon = React.createElement('svg', {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
},
  React.createElement('circle', { cx: 12, cy: 12, r: 10 }),
  React.createElement('polyline', { points: '12 6 12 12 16 14' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.services.manage'],
  pageTitle: 'Availability rules',
  pageTitleKey: 'booking.nav.availability',
  pageGroup: 'Booking',
  pageGroupKey: 'booking.nav.group',
  pageOrder: 130,
  icon: clockIcon,
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Availability', labelKey: 'booking.nav.availability' },
  ],
}

