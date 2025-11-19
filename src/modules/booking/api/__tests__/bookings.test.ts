/** @jest-environment node */
import { randomUUID } from 'crypto'
import { addHours, startOfDay, addDays } from 'date-fns'

const tenantId = randomUUID()
const orgId = randomUUID()

// Mock implementations
const mockEntityManager = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  persist: jest.fn(),
  flush: jest.fn(),
  fork: jest.fn(),
  transactional: jest.fn(),
}

const mockCommandBus = {
  execute: jest.fn(),
}

const mockContainer = {
  resolve: jest.fn((name: string) => {
    if (name === 'em') return mockEntityManager
    if (name === 'commandBus') return mockCommandBus
    return null
  }),
}

// Mock the modules
jest.mock('@open-mercato/shared/lib/i18n/server', () => ({
  resolveTranslations: async () => ({
    t: (_key: string, fallback?: string) => fallback ?? '',
    translate: (_key: string, fallback?: string) => fallback ?? '',
  }),
}))

jest.mock('@/lib/di/container', () => ({
  createRequestContainer: async () => mockContainer,
}))

jest.mock('@/lib/auth/session', () => ({
  getSession: async () => ({
    userId: randomUUID(),
    tenantId,
    organizationIds: [orgId],
    email: 'test@example.com',
  }),
}))

// Import after mocks
import { GET, POST, PATCH, DELETE } from '../bookings'

describe('Booking Events API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/booking/bookings', () => {
    it('should list all bookings for organization', async () => {
      const serviceId = randomUUID()
      const now = new Date()
      const mockEvents = [
        {
          id: randomUUID(),
          tenantId,
          organizationId: orgId,
          serviceId,
          title: 'Test Booking',
          startsAt: addHours(now, 1),
          endsAt: addHours(now, 2),
          timezone: 'UTC',
          rrule: null,
          exdates: [],
          status: 'confirmed',
          tags: [],
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]

      mockEntityManager.find.mockResolvedValue(mockEvents)

      const req = new Request(
        `http://localhost/api/booking/bookings?organizationId=${orgId}`,
        { method: 'GET' }
      )
      const res = await GET(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.items).toHaveLength(1)
      expect(data.items[0].title).toBe('Test Booking')
    })

    it('should filter bookings by service', async () => {
      const serviceId = randomUUID()
      const now = new Date()
      const mockEvents = [
        {
          id: randomUUID(),
          tenantId,
          organizationId: orgId,
          serviceId,
          title: 'Service Specific Booking',
          startsAt: addHours(now, 1),
          endsAt: addHours(now, 2),
          timezone: 'UTC',
          rrule: null,
          exdates: [],
          status: 'confirmed',
          tags: [],
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]

      mockEntityManager.find.mockResolvedValue(mockEvents)

      const req = new Request(
        `http://localhost/api/booking/bookings?serviceId=${serviceId}`,
        { method: 'GET' }
      )
      const res = await GET(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.items.every((item: any) => item.serviceId === serviceId)).toBe(true)
    })

    it('should filter bookings by date range', async () => {
      const now = new Date()
      const startsFrom = startOfDay(addDays(now, 1))
      const startsTo = startOfDay(addDays(now, 7))

      const mockEvents = [
        {
          id: randomUUID(),
          tenantId,
          organizationId: orgId,
          serviceId: randomUUID(),
          title: 'Within Range',
          startsAt: addDays(now, 3),
          endsAt: addDays(now, 3.5),
          timezone: 'UTC',
          rrule: null,
          exdates: [],
          status: 'confirmed',
          tags: [],
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]

      mockEntityManager.find.mockResolvedValue(mockEvents)

      const req = new Request(
        `http://localhost/api/booking/bookings?startsFrom=${startsFrom.toISOString()}&startsTo=${startsTo.toISOString()}`,
        { method: 'GET' }
      )
      const res = await GET(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(Array.isArray(data.items)).toBe(true)
    })

    it('should filter bookings by member', async () => {
      const memberId = randomUUID()
      const eventId = randomUUID()

      const mockMemberships = [{ eventId }]
      mockEntityManager.find.mockResolvedValueOnce(mockMemberships)

      const now = new Date()
      const mockEvents = [
        {
          id: eventId,
          tenantId,
          organizationId: orgId,
          serviceId: randomUUID(),
          title: 'Member Booking',
          startsAt: addHours(now, 1),
          endsAt: addHours(now, 2),
          timezone: 'UTC',
          rrule: null,
          exdates: [],
          status: 'confirmed',
          tags: [],
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]
      mockEntityManager.find.mockResolvedValueOnce(mockEvents)

      const req = new Request(
        `http://localhost/api/booking/bookings?memberId=${memberId}`,
        { method: 'GET' }
      )
      const res = await GET(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(Array.isArray(data.items)).toBe(true)
    })
  })

  describe('POST /api/booking/bookings', () => {
    it('should create a booking with attendees', async () => {
      const eventId = randomUUID()
      const serviceId = randomUUID()
      const now = new Date()

      const mockEvent = {
        id: eventId,
        tenantId,
        organizationId: orgId,
        serviceId,
        title: 'New Booking',
        startsAt: addHours(now, 1),
        endsAt: addHours(now, 2),
        timezone: 'UTC',
        rrule: null,
        exdates: [],
        status: 'confirmed',
        tags: [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }

      mockCommandBus.execute.mockResolvedValue({
        result: { eventId },
        logEntry: null,
      })
      mockEntityManager.findOne.mockResolvedValue(mockEvent)
      mockEntityManager.find.mockResolvedValue([])

      const body = {
        event: {
          tenant_id: tenantId,
          organization_id: orgId,
          service_id: serviceId,
          title: 'New Booking',
          starts_at: addHours(now, 1).toISOString(),
          ends_at: addHours(now, 2).toISOString(),
          timezone: 'UTC',
          status: 'confirmed',
          tags: [],
          exdates: [],
        },
        attendees: [
          {
            tenant_id: tenantId,
            organization_id: orgId,
            event_id: '',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john.doe@example.com',
            tags: [],
          },
        ],
        members: [],
        resources: [],
      }

      const req = new Request('http://localhost/api/booking/bookings', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await POST(req)

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBe(eventId)
    })

    it('should validate booking conflicts', async () => {
      // Command should throw conflict error
      mockCommandBus.execute.mockRejectedValue({
        status: 409,
        body: { error: 'Booking conflicts with existing events.' },
      })

      const now = new Date()
      const body = {
        event: {
          tenant_id: tenantId,
          organization_id: orgId,
          service_id: randomUUID(),
          title: 'Conflicting Booking',
          starts_at: addHours(now, 1).toISOString(),
          ends_at: addHours(now, 2).toISOString(),
          timezone: 'UTC',
          status: 'confirmed',
          tags: [],
          exdates: [],
        },
        attendees: [],
        members: [],
        resources: [],
      }

      const req = new Request('http://localhost/api/booking/bookings', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await POST(req)

      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('PATCH /api/booking/bookings', () => {
    it('should update an existing booking', async () => {
      const eventId = randomUUID()
      const now = new Date()

      const updatedEvent = {
        id: eventId,
        tenantId,
        organizationId: orgId,
        serviceId: randomUUID(),
        title: 'Updated Booking',
        startsAt: addHours(now, 1),
        endsAt: addHours(now, 2),
        timezone: 'UTC',
        rrule: null,
        exdates: [],
        status: 'confirmed',
        tags: [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }

      mockCommandBus.execute.mockResolvedValue({
        result: { eventId },
        logEntry: null,
      })
      mockEntityManager.findOne.mockResolvedValue(updatedEvent)
      mockEntityManager.find.mockResolvedValue([])

      const body = {
        event: {
          id: eventId,
          title: 'Updated Booking',
        },
      }

      const req = new Request('http://localhost/api/booking/bookings', {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await PATCH(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.title).toBe('Updated Booking')
    })
  })

  describe('DELETE /api/booking/bookings', () => {
    it('should cancel/delete a booking', async () => {
      const eventId = randomUUID()

      mockCommandBus.execute.mockResolvedValue({
        result: { eventId },
        logEntry: null,
      })

      const body = { id: eventId }

      const req = new Request('http://localhost/api/booking/bookings', {
        method: 'DELETE',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await DELETE(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(eventId)
    })
  })
})


