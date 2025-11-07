import React from 'react'

const usersIcon = React.createElement('svg', {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
},
  React.createElement('path', { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' }),
  React.createElement('circle', { cx: 9, cy: 7, r: 4 }),
  React.createElement('path', { d: 'M23 21v-2a4 4 0 0 0-3-3.85' }),
  React.createElement('path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.members.manage'],
  pageTitle: 'Team members',
  pageTitleKey: 'booking.nav.teamMembers',
  pageGroup: 'Booking',
  pageGroupKey: 'booking.nav.group',
  pageOrder: 240,
  icon: usersIcon,
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Team members', labelKey: 'booking.nav.teamMembers' },
  ],
}
