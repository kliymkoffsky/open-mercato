import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
  Index,
  OptionalProps,
} from '@mikro-orm/core'

export type BookingCapacityModel = 'one_to_one' | 'one_to_many' | 'many_to_many'
export type BookingAvailabilitySubjectType = 'member' | 'resource'
export type BookingStatus = 'draft' | 'confirmed' | 'cancelled'

@Entity({ tableName: 'booking_services' })
@Index({ name: 'booking_services_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class BookingService {
  [OptionalProps]?: 'isActive' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'duration_minutes', type: 'int' })
  durationMinutes!: number

  @Enum({ items: () => ['one_to_one', 'one_to_many', 'many_to_many'], type: 'text' })
  capacityModel!: BookingCapacityModel

  @Property({ name: 'max_attendees', type: 'int', nullable: true })
  maxAttendees?: number | null

  @Property({ name: 'required_roles', type: 'jsonb', default: [] })
  requiredRoles: Array<{ role_id: string; qty: number }> = []

  @Property({ name: 'required_members', type: 'jsonb', default: [] })
  requiredMembers: Array<{ member_id: string; qty?: number }> = []

  @Property({ name: 'required_resources', type: 'jsonb', default: [] })
  requiredResources: Array<{ resource_id: string; qty: number }> = []

  @Property({ name: 'required_resource_types', type: 'jsonb', default: [] })
  requiredResourceTypes: Array<{ resource_type_id: string; qty: number }> = []

  @Property({ type: 'jsonb', default: [] })
  tags: string[] = []

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'booking_team_roles' })
@Index({ name: 'booking_team_roles_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class BookingTeamRole {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'booking_team_members' })
@Index({ name: 'booking_team_members_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class BookingTeamMember {
  [OptionalProps]?: 'isActive' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'display_name', type: 'text' })
  displayName!: string

  @Property({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null

  @Property({ name: 'role_ids', type: 'jsonb', default: [] })
  roleIds: string[] = []

  @Property({ type: 'jsonb', default: [] })
  tags: string[] = []

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'booking_resource_types' })
@Index({ name: 'booking_resource_types_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class BookingResourceType {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'booking_resources' })
@Index({ name: 'booking_resources_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class BookingResource {
  [OptionalProps]?: 'isActive' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ name: 'resource_type_id', type: 'uuid', nullable: true })
  resourceTypeId?: string | null

  @Property({ type: 'int', nullable: true })
  capacity?: number | null

  @Property({ type: 'jsonb', default: [] })
  tags: string[] = []

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'booking_availability_rules' })
@Index({ name: 'booking_availability_rules_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'booking_availability_rules_subject_idx', properties: ['subjectType', 'subjectId'] })
export class BookingAvailabilityRule {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Enum({ items: () => ['member', 'resource'], type: 'text', name: 'subject_type' })
  subjectType!: BookingAvailabilitySubjectType

  @Property({ name: 'subject_id', type: 'uuid' })
  subjectId!: string

  @Property({ type: 'text' })
  timezone!: string

  @Property({ type: 'text' })
  rrule!: string

  @Property({ type: 'jsonb', default: [] })
  exdates: string[] = []

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'booking_events' })
@Index({ name: 'booking_events_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'booking_events_service_idx', properties: ['serviceId'] })
export class BookingEvent {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'service_id', type: 'uuid' })
  serviceId!: string

  @Property({ type: 'text' })
  title!: string

  @Property({ name: 'starts_at', type: Date })
  startsAt!: Date

  @Property({ name: 'ends_at', type: Date })
  endsAt!: Date

  @Property({ type: 'text', nullable: true })
  timezone?: string | null

  @Property({ type: 'text', nullable: true })
  rrule?: string | null

  @Property({ type: 'jsonb', default: [] })
  exdates: string[] = []

  @Enum({ items: () => ['draft', 'confirmed', 'cancelled'], type: 'text', name: 'status' })
  status!: BookingStatus

  @Property({ type: 'jsonb', default: [] })
  tags: string[] = []

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'booking_event_attendees' })
@Index({ name: 'booking_event_attendees_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'booking_event_attendees_event_idx', properties: ['eventId'] })
export class BookingEventAttendee {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'event_id', type: 'uuid' })
  eventId!: string

  @Property({ name: 'first_name', type: 'text' })
  firstName!: string

  @Property({ name: 'last_name', type: 'text' })
  lastName!: string

  @Property({ type: 'text', nullable: true })
  email?: string | null

  @Property({ type: 'text', nullable: true })
  phone?: string | null

  @Property({ name: 'address_line1', type: 'text', nullable: true })
  addressLine1?: string | null

  @Property({ name: 'address_line2', type: 'text', nullable: true })
  addressLine2?: string | null

  @Property({ type: 'text', nullable: true })
  city?: string | null

  @Property({ type: 'text', nullable: true })
  region?: string | null

  @Property({ name: 'postal_code', type: 'text', nullable: true })
  postalCode?: string | null

  @Property({ type: 'text', nullable: true })
  country?: string | null

  @Property({ name: 'attendee_type', type: 'text', nullable: true })
  attendeeType?: string | null

  @Property({ name: 'external_ref', type: 'text', nullable: true })
  externalRef?: string | null

  @Property({ type: 'jsonb', default: [] })
  tags: string[] = []

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'booking_event_members' })
@Index({ name: 'booking_event_members_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'booking_event_members_event_idx', properties: ['eventId'] })
export class BookingEventMember {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'event_id', type: 'uuid' })
  eventId!: string

  @Property({ name: 'member_id', type: 'uuid' })
  memberId!: string

  @Property({ name: 'role_id', type: 'uuid', nullable: true })
  roleId?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'booking_event_resources' })
@Index({ name: 'booking_event_resources_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'booking_event_resources_event_idx', properties: ['eventId'] })
export class BookingEventResource {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'event_id', type: 'uuid' })
  eventId!: string

  @Property({ name: 'resource_id', type: 'uuid' })
  resourceId!: string

  @Property({ type: 'int', default: 1 })
  qty: number = 1

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

