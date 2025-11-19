import React from 'react'

const layersIcon = React.createElement('svg', {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
},
  React.createElement('polygon', { points: '12 2 2 7 12 12 22 7 12 2' }),
  React.createElement('polyline', { points: '2 12 12 17 22 12' }),
  React.createElement('polyline', { points: '2 17 12 22 22 17' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.resources.manage'],
  pageTitle: 'Resource types',
  pageTitleKey: 'booking.nav.resourceTypes',
  pageGroup: 'Booking',
  pageGroupKey: 'booking.nav.group',
  pageOrder: 210,
  icon: layersIcon,
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Resource types', labelKey: 'booking.nav.resourceTypes' },
  ],
}

