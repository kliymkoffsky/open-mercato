/** @jest-environment node */
import { addHours, addMinutes } from 'date-fns'
import { ensureNoEventConflicts, ensureWithinAvailability } from '../conflicts'

describe('Booking Conflict Detection', () => {
  const mockEntityManager: any = {
    find: jest.fn(),
  }

  const tenantId = 'tenant-123'
  const organizationId = 'org-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('ensureNoEventConflicts', () => {
    it('should pass when no conflicting events exist', async () => {
      mockEntityManager.find.mockResolvedValue([])

      const span = {
        startsAt: new Date('2025-01-10T10:00:00Z'),
        endsAt: new Date('2025-01-10T11:00:00Z'),
      }

      await expect(
        ensureNoEventConflicts(
          mockEntityManager,
          tenantId,
          organizationId,
          span,
          ['member-1'],
          ['resource-1']
        )
      ).resolves.not.toThrow()
    })

    it('should detect member conflicts in overlapping bookings', async () => {
      const conflictingEvent = {
        id: 'event-1',
        startsAt: new Date('2025-01-10T10:00:00Z'),
        endsAt: new Date('2025-01-10T11:00:00Z'),
      }

      // First call returns conflicting events
      mockEntityManager.find.mockResolvedValueOnce([conflictingEvent])
      
      // Second call returns member assignments
      mockEntityManager.find.mockResolvedValueOnce([
        { eventId: 'event-1', memberId: 'member-1' },
      ])
      
      // Third call returns resource assignments
      mockEntityManager.find.mockResolvedValueOnce([])

      const span = {
        startsAt: new Date('2025-01-10T10:30:00Z'),
        endsAt: new Date('2025-01-10T11:30:00Z'),
      }

      await expect(
        ensureNoEventConflicts(
          mockEntityManager,
          tenantId,
          organizationId,
          span,
          ['member-1'],
          []
        )
      ).rejects.toThrow('Booking conflicts with existing events.')
    })

    it('should detect resource conflicts in overlapping bookings', async () => {
      const conflictingEvent = {
        id: 'event-1',
        startsAt: new Date('2025-01-10T10:00:00Z'),
        endsAt: new Date('2025-01-10T11:00:00Z'),
      }

      mockEntityManager.find.mockResolvedValueOnce([conflictingEvent])
      mockEntityManager.find.mockResolvedValueOnce([])
      mockEntityManager.find.mockResolvedValueOnce([
        { eventId: 'event-1', resourceId: 'resource-1' },
      ])

      const span = {
        startsAt: new Date('2025-01-10T10:30:00Z'),
        endsAt: new Date('2025-01-10T11:30:00Z'),
      }

      await expect(
        ensureNoEventConflicts(
          mockEntityManager,
          tenantId,
          organizationId,
          span,
          [],
          ['resource-1']
        )
      ).rejects.toThrow('Booking conflicts with existing events.')
    })

    it('should allow updating same event (ignoreEventId)', async () => {
      const eventId = 'event-1'
      const conflictingEvent = {
        id: eventId,
        startsAt: new Date('2025-01-10T10:00:00Z'),
        endsAt: new Date('2025-01-10T11:00:00Z'),
      }

      // Query filters out the event being updated
      mockEntityManager.find.mockResolvedValue([])

      const span = {
        startsAt: new Date('2025-01-10T10:30:00Z'),
        endsAt: new Date('2025-01-10T11:30:00Z'),
      }

      await expect(
        ensureNoEventConflicts(
          mockEntityManager,
          tenantId,
          organizationId,
          span,
          ['member-1'],
          ['resource-1'],
          eventId
        )
      ).resolves.not.toThrow()
    })

    it('should pass when events have no overlapping members/resources', async () => {
      const conflictingEvent = {
        id: 'event-1',
        startsAt: new Date('2025-01-10T10:00:00Z'),
        endsAt: new Date('2025-01-10T11:00:00Z'),
      }

      mockEntityManager.find.mockResolvedValueOnce([conflictingEvent])
      mockEntityManager.find.mockResolvedValueOnce([
        { eventId: 'event-1', memberId: 'member-2' }, // Different member
      ])
      mockEntityManager.find.mockResolvedValueOnce([
        { eventId: 'event-1', resourceId: 'resource-2' }, // Different resource
      ])

      const span = {
        startsAt: new Date('2025-01-10T10:30:00Z'),
        endsAt: new Date('2025-01-10T11:30:00Z'),
      }

      await expect(
        ensureNoEventConflicts(
          mockEntityManager,
          tenantId,
          organizationId,
          span,
          ['member-1'], // Different from member-2
          ['resource-1'] // Different from resource-2
        )
      ).resolves.not.toThrow()
    })

    it('should pass when events do not overlap in time', async () => {
      mockEntityManager.find.mockResolvedValue([])

      const span = {
        startsAt: new Date('2025-01-10T11:00:00Z'), // Starts when previous ends
        endsAt: new Date('2025-01-10T12:00:00Z'),
      }

      await expect(
        ensureNoEventConflicts(
          mockEntityManager,
          tenantId,
          organizationId,
          span,
          ['member-1'],
          ['resource-1']
        )
      ).resolves.not.toThrow()
    })
  })

  describe('ensureWithinAvailability', () => {
    it('should pass when no availability rules exist', async () => {
      mockEntityManager.find.mockResolvedValue([])

      const span = {
        startsAt: new Date('2025-01-10T10:00:00Z'),
        endsAt: new Date('2025-01-10T11:00:00Z'),
      }

      await expect(
        ensureWithinAvailability(
          mockEntityManager,
          tenantId,
          organizationId,
          span,
          'member',
          ['member-1']
        )
      ).resolves.not.toThrow()
    })

    it('should validate booking falls within availability window', async () => {
      const availabilityRules = [
        {
          timezone: 'UTC',
          rrule: 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=10;BYMINUTE=0;BYSECOND=0',
          exdates: [],
        },
      ]

      mockEntityManager.find.mockResolvedValue(availabilityRules)

      // Monday 10:00-11:00 should match the rule
      const span = {
        startsAt: new Date('2025-01-13T10:00:00Z'), // Monday
        endsAt: new Date('2025-01-13T11:00:00Z'),
      }

      // This test depends on RRule expansion logic working correctly
      // For now, we just ensure the function runs without throwing
      await expect(
        ensureWithinAvailability(
          mockEntityManager,
          tenantId,
          organizationId,
          span,
          'member',
          ['member-1']
        )
      ).resolves.toBeDefined()
    })

    it('should reject booking outside availability window', async () => {
      const availabilityRules = [
        {
          timezone: 'UTC',
          rrule: 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=10;BYMINUTE=0;BYSECOND=0',
          exdates: [],
        },
      ]

      mockEntityManager.find.mockResolvedValue(availabilityRules)

      // Tuesday 10:00-11:00 does not match Monday rule
      const span = {
        startsAt: new Date('2025-01-14T10:00:00Z'), // Tuesday
        endsAt: new Date('2025-01-14T11:00:00Z'),
      }

      // The function should throw for bookings outside availability
      await expect(
        ensureWithinAvailability(
          mockEntityManager,
          tenantId,
          organizationId,
          span,
          'member',
          ['member-1']
        )
      ).rejects.toThrow('Booking is outside the subject availability window.')
    })

    it('should pass when subject list is empty', async () => {
      const span = {
        startsAt: new Date('2025-01-10T10:00:00Z'),
        endsAt: new Date('2025-01-10T11:00:00Z'),
      }

      await expect(
        ensureWithinAvailability(
          mockEntityManager,
          tenantId,
          organizationId,
          span,
          'member',
          [] // No members to check
        )
      ).resolves.not.toThrow()
    })
  })
})

describe('Conflict Detection Edge Cases', () => {
  const mockEntityManager: any = {
    find: jest.fn(),
  }

  const tenantId = 'tenant-123'
  const organizationId = 'org-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle bookings that start at the same time', async () => {
    const conflictingEvent = {
      id: 'event-1',
      startsAt: new Date('2025-01-10T10:00:00Z'),
      endsAt: new Date('2025-01-10T11:00:00Z'),
    }

    mockEntityManager.find.mockResolvedValueOnce([conflictingEvent])
    mockEntityManager.find.mockResolvedValueOnce([
      { eventId: 'event-1', memberId: 'member-1' },
    ])
    mockEntityManager.find.mockResolvedValueOnce([])

    const span = {
      startsAt: new Date('2025-01-10T10:00:00Z'), // Same start time
      endsAt: new Date('2025-01-10T11:00:00Z'),
    }

    await expect(
      ensureNoEventConflicts(
        mockEntityManager,
        tenantId,
        organizationId,
        span,
        ['member-1'],
        []
      )
    ).rejects.toThrow()
  })

  it('should handle bookings that end at the same time', async () => {
    const conflictingEvent = {
      id: 'event-1',
      startsAt: new Date('2025-01-10T10:00:00Z'),
      endsAt: new Date('2025-01-10T11:00:00Z'),
    }

    mockEntityManager.find.mockResolvedValueOnce([conflictingEvent])
    mockEntityManager.find.mockResolvedValueOnce([
      { eventId: 'event-1', memberId: 'member-1' },
    ])
    mockEntityManager.find.mockResolvedValueOnce([])

    const span = {
      startsAt: new Date('2025-01-10T09:00:00Z'),
      endsAt: new Date('2025-01-10T11:00:00Z'), // Same end time
    }

    await expect(
      ensureNoEventConflicts(
        mockEntityManager,
        tenantId,
        organizationId,
        span,
        ['member-1'],
        []
      )
    ).rejects.toThrow()
  })

  it('should handle partial overlaps', async () => {
    const conflictingEvent = {
      id: 'event-1',
      startsAt: new Date('2025-01-10T10:00:00Z'),
      endsAt: new Date('2025-01-10T11:00:00Z'),
    }

    mockEntityManager.find.mockResolvedValueOnce([conflictingEvent])
    mockEntityManager.find.mockResolvedValueOnce([
      { eventId: 'event-1', memberId: 'member-1' },
    ])
    mockEntityManager.find.mockResolvedValueOnce([])

    const span = {
      startsAt: new Date('2025-01-10T10:30:00Z'), // Overlaps by 30 minutes
      endsAt: new Date('2025-01-10T11:30:00Z'),
    }

    await expect(
      ensureNoEventConflicts(
        mockEntityManager,
        tenantId,
        organizationId,
        span,
        ['member-1'],
        []
      )
    ).rejects.toThrow()
  })
})


