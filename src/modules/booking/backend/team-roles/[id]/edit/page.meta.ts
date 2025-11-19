export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.members.manage'],
  pageTitle: 'Edit team role',
  pageTitleKey: 'booking.teamRoles.form.edit.title',
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Team roles', labelKey: 'booking.nav.teamRoles', href: '/backend/team-roles' },
    { label: 'Edit', labelKey: 'booking.nav.teamRoles.edit' },
  ],
}

