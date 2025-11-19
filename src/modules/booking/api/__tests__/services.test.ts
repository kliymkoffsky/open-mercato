/** @jest-environment node */
import { randomUUID } from 'crypto'

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
import { GET, POST, PATCH, DELETE } from '../services'

describe('Booking Services API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/booking/services', () => {
    it('should list all services for organization', async () => {
      const mockServices = [
        {
          id: randomUUID(),
          tenantId,
          organizationId: orgId,
          name: 'Test Service',
          description: 'Test description',
          durationMinutes: 60,
          capacityModel: 'one_to_one',
          maxAttendees: null,
          requiredRoles: [],
          requiredMembers: [],
          requiredResources: [],
          requiredResourceTypes: [],
          tags: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ]

      mockEntityManager.find.mockResolvedValue(mockServices)

      const req = new Request(
        `http://localhost/api/booking/services?organizationId=${orgId}`,
        { method: 'GET' }
      )
      const res = await GET(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.items).toHaveLength(1)
      expect(data.items[0].name).toBe('Test Service')
    })

    it('should get a specific service by ID', async () => {
      const serviceId = randomUUID()
      const mockService = {
        id: serviceId,
        tenantId,
        organizationId: orgId,
        name: 'Test Service',
        description: 'Test description',
        durationMinutes: 60,
        capacityModel: 'one_to_one',
        maxAttendees: null,
        requiredRoles: [],
        requiredMembers: [],
        requiredResources: [],
        requiredResourceTypes: [],
        tags: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }

      mockEntityManager.findOne.mockResolvedValue(mockService)

      const req = new Request(
        `http://localhost/api/booking/services?id=${serviceId}`,
        { method: 'GET' }
      )
      const res = await GET(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.item.id).toBe(serviceId)
      expect(data.item.name).toBe('Test Service')
    })

    it('should return 404 for non-existent service', async () => {
      mockEntityManager.findOne.mockResolvedValue(null)

      const req = new Request(
        `http://localhost/api/booking/services?id=${randomUUID()}`,
        { method: 'GET' }
      )
      const res = await GET(req)

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBeTruthy()
    })
  })

  describe('POST /api/booking/services', () => {
    it('should create a new service', async () => {
      const serviceId = randomUUID()
      const mockService = {
        id: serviceId,
        tenantId,
        organizationId: orgId,
        name: 'New Service',
        description: 'New description',
        durationMinutes: 60,
        capacityModel: 'one_to_one',
        maxAttendees: null,
        requiredRoles: [],
        requiredMembers: [],
        requiredResources: [],
        requiredResourceTypes: [],
        tags: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }

      mockCommandBus.execute.mockResolvedValue({
        result: { serviceId },
        logEntry: null,
      })
      mockEntityManager.findOne.mockResolvedValue(mockService)

      const body = {
        tenant_id: tenantId,
        organization_id: orgId,
        name: 'New Service',
        description: 'New description',
        duration_minutes: 60,
        capacity_model: 'one_to_one',
        required_roles: [],
        required_members: [],
        required_resources: [],
        required_resource_types: [],
        tags: [],
        is_active: true,
      }

      const req = new Request('http://localhost/api/booking/services', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await POST(req)

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBe(serviceId)
      expect(data.name).toBe('New Service')
    })

    it('should validate capacity model constraints', async () => {
      // Test that validation is called by the command
      const body = {
        tenant_id: tenantId,
        organization_id: orgId,
        name: 'Invalid Service',
        duration_minutes: 60,
        capacity_model: 'one_to_many',
        // Missing max_attendees for one_to_many
        required_roles: [],
        required_members: [],
        required_resources: [],
        required_resource_types: [],
        tags: [],
      }

      const req = new Request('http://localhost/api/booking/services', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      })

      // This should fail validation in the schema
      const res = await POST(req)
      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('PATCH /api/booking/services', () => {
    it('should update an existing service', async () => {
      const serviceId = randomUUID()
      const updatedService = {
        id: serviceId,
        tenantId,
        organizationId: orgId,
        name: 'Updated Service',
        description: 'Updated description',
        durationMinutes: 90,
        capacityModel: 'one_to_one',
        maxAttendees: null,
        requiredRoles: [],
        requiredMembers: [],
        requiredResources: [],
        requiredResourceTypes: [],
        tags: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }

      mockCommandBus.execute.mockResolvedValue({
        result: { serviceId },
        logEntry: null,
      })
      mockEntityManager.findOne.mockResolvedValue(updatedService)

      const body = {
        id: serviceId,
        name: 'Updated Service',
        duration_minutes: 90,
      }

      const req = new Request('http://localhost/api/booking/services', {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await PATCH(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.name).toBe('Updated Service')
      expect(data.durationMinutes).toBe(90)
    })
  })

  describe('DELETE /api/booking/services', () => {
    it('should soft delete a service', async () => {
      const serviceId = randomUUID()

      mockCommandBus.execute.mockResolvedValue({
        result: { serviceId },
        logEntry: null,
      })

      const body = { id: serviceId }

      const req = new Request('http://localhost/api/booking/services', {
        method: 'DELETE',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await DELETE(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(serviceId)
      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        'booking.services.delete',
        expect.any(Object)
      )
    })
  })
})


