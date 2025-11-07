export type BookingUpcomingSettings = {
  limit: number
  includeCancelled: boolean
}

export const DEFAULT_SETTINGS: BookingUpcomingSettings = {
  limit: 5,
  includeCancelled: false,
}

export function hydrateUpcomingSettings(raw: unknown): BookingUpcomingSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS
  const value = raw as Partial<BookingUpcomingSettings>
  const limit = typeof value.limit === 'number' && Number.isFinite(value.limit) && value.limit > 0 ? Math.round(value.limit) : DEFAULT_SETTINGS.limit
  const includeCancelled = typeof value.includeCancelled === 'boolean' ? value.includeCancelled : DEFAULT_SETTINGS.includeCancelled
  return { limit, includeCancelled }
}

