import type { AppContainer } from '@/lib/di/container'

import './commands/services'
import './commands/resourceTypes'
import './commands/resources'
import './commands/teamRoles'
import './commands/teamMembers'
import './commands/availability'
import './commands/events'

export function register(container: AppContainer) {
  void container
}

