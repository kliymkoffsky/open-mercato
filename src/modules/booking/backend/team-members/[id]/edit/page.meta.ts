export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.members.manage'],
  pageTitle: 'Edit team member',
  pageTitleKey: 'booking.teamMembers.form.edit.title',
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Team members', labelKey: 'booking.nav.teamMembers', href: '/backend/team-members' },
    { label: 'Edit', labelKey: 'booking.nav.teamMembers.edit' },
  ],
}
