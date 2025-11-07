import React from 'react'

const boxIcon = React.createElement('svg', {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
},
  React.createElement('path', { d: 'M21 16V8a2 2 0 0 0-1-1.73L12 2 4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73L12 22l8-4.27A2 2 0 0 0 21 16Z' }),
  React.createElement('path', { d: 'M3.27 6.96 12 12.01l8.73-5.05' }),
  React.createElement('path', { d: 'M12 22.08V12' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.resources.manage'],
  pageTitle: 'Resources',
  pageTitleKey: 'booking.nav.resources',
  pageGroup: 'Booking',
  pageGroupKey: 'booking.nav.group',
  pageOrder: 220,
  icon: boxIcon,
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Resources', labelKey: 'booking.nav.resources' },
  ],
}
