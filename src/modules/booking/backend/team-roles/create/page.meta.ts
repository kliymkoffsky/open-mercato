export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.members.manage'],
  pageTitle: 'Create team role',
  pageTitleKey: 'booking.teamRoles.form.create.title',
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Team roles', labelKey: 'booking.nav.teamRoles', href: '/backend/team-roles' },
    { label: 'Create', labelKey: 'booking.nav.teamRoles.create' },
  ],
}
