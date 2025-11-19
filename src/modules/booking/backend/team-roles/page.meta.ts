import React from 'react'

const shieldIcon = React.createElement('svg', {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
},
  React.createElement('path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.members.manage'],
  pageTitle: 'Team roles',
  pageTitleKey: 'booking.nav.teamRoles',
  pageGroup: 'Booking',
  pageGroupKey: 'booking.nav.group',
  pageOrder: 230,
  icon: shieldIcon,
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Team roles', labelKey: 'booking.nav.teamRoles' },
  ],
}

