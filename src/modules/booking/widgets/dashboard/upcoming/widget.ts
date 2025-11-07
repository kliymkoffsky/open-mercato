import type { DashboardWidgetModule } from '@open-mercato/shared/modules/dashboard/widgets'
import BookingUpcomingWidget from './widget.client'
import { DEFAULT_SETTINGS, hydrateUpcomingSettings, type BookingUpcomingSettings } from './config'

const widget: DashboardWidgetModule<BookingUpcomingSettings> = {
  metadata: {
    id: 'booking.dashboard.upcoming',
    title: 'Upcoming bookings',
    description: 'Shows the next scheduled bookings scoped to the current organization.',
    features: ['booking.view'],
    defaultEnabled: true,
    defaultSize: 'md',
    defaultSettings: DEFAULT_SETTINGS,
    tags: ['booking', 'schedule'],
  },
  Widget: BookingUpcomingWidget,
  hydrateSettings: hydrateUpcomingSettings,
  dehydrateSettings: (value) => ({ limit: value.limit, includeCancelled: value.includeCancelled }),
}

export default widget

