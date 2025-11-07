export const metadata = {
  requireAuth: true,
  requireFeatures: ['booking.members.manage'],
  pageTitle: 'Add team member',
  pageTitleKey: 'booking.teamMembers.form.create.title',
  breadcrumb: [
    { label: 'Booking', labelKey: 'booking.nav.group' },
    { label: 'Team members', labelKey: 'booking.nav.teamMembers', href: '/backend/team-members' },
    { label: 'Create', labelKey: 'booking.nav.teamMembers.create' },
  ],
}
