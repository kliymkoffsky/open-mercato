import type { ModuleInfo } from '@/modules/registry'

export const metadata: ModuleInfo = {
  name: 'booking',
  title: 'Booking',
  version: '0.1.0',
  description: 'Tenant-aware scheduling for services, resources, and attendees with conflict checks.',
}

export { features } from './acl'


