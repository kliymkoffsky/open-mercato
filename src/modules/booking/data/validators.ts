import { z } from 'zod';

/**
 * Booking module validator outlines.
 * These schemas intentionally focus on the high-priority service + booking + attendee flows.
 * Additional resource/member validators will extend the shared helpers below in a follow-up iteration.
 */

export const uuid = z.string().uuid();

const stringTagArray = z.array(z.string()).default([]);

const quantitySchema = z.number().int().positive();

const capacityModelSchema = z.enum(['one_to_one', 'one_to_many', 'many_to_many']);

const requiredRoleSchema = z
  .object({
    role_id: uuid,
    qty: quantitySchema,
  })
  .strict();

const requiredMemberSchema = z
  .object({
    member_id: uuid,
    qty: quantitySchema.optional(),
  })
  .strict();

const requiredResourceSchema = z
  .object({
    resource_id: uuid,
    qty: quantitySchema,
  })
  .strict();

const requiredResourceTypeSchema = z
  .object({
    resource_type_id: uuid,
    qty: quantitySchema,
  })
  .strict();

export const serviceSchema = z
  .object({
    id: uuid.optional(),
    tenant_id: uuid,
    organization_id: uuid,
    name: z.string().min(1),
    description: z.string().optional(),
    duration_minutes: quantitySchema,
    capacity_model: capacityModelSchema,
    max_attendees: quantitySchema.optional(),
    required_roles: z.array(requiredRoleSchema).default([]),
    required_members: z.array(requiredMemberSchema).default([]),
    required_resources: z.array(requiredResourceSchema).default([]),
    required_resource_types: z.array(requiredResourceTypeSchema).default([]),
    tags: stringTagArray,
    is_active: z.boolean().default(true),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.capacity_model === 'one_to_one' && data.max_attendees && data.max_attendees !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'max_attendees must be 1 when using the one_to_one capacity model',
        path: ['max_attendees'],
      });
    }

    if (data.capacity_model !== 'one_to_one' && data.max_attendees === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'max_attendees is required for one_to_many and many_to_many services',
        path: ['max_attendees'],
      });
    }
  });

const serviceCreateCoreSchema = serviceSchema.omit({ id: true });

export const serviceCreateSchema = serviceCreateCoreSchema;

export const serviceUpdateSchema = serviceCreateCoreSchema.partial().extend({
  id: uuid,
});

export type ServiceInput = z.infer<typeof serviceSchema>;
export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;

const eventStatusSchema = z.enum(['draft', 'confirmed', 'cancelled']);

export const bookingEventSchema = z
  .object({
    id: uuid.optional(),
    tenant_id: uuid,
    organization_id: uuid,
    service_id: uuid,
    title: z.string().min(1),
    starts_at: z.coerce.date(),
    ends_at: z.coerce.date(),
    timezone: z.string().min(1).optional(),
    rrule: z.string().min(1).optional(),
    exdates: z.array(z.string()).default([]),
    status: eventStatusSchema.default('confirmed'),
    tags: stringTagArray,
  })
  .strict()
  .refine((data) => data.ends_at > data.starts_at, {
    message: 'ends_at must be after starts_at',
    path: ['ends_at'],
  });

export type BookingEventInput = z.infer<typeof bookingEventSchema>;

export const attendeeSchema = z
  .object({
    id: uuid.optional(),
    tenant_id: uuid,
    organization_id: uuid,
    event_id: uuid,
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address_line1: z.string().optional(),
    address_line2: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().length(2).optional(),
    attendee_type: z.string().optional(),
    external_ref: z.string().optional(),
    tags: stringTagArray,
    notes: z.string().optional(),
  })
  .strict();

export type BookingEventAttendeeInput = z.infer<typeof attendeeSchema>;

export const teamRoleSchema = z
  .object({
    id: uuid.optional(),
    tenant_id: uuid,
    organization_id: uuid,
    name: z.string().min(1),
    description: z.string().optional(),
  })
  .strict();

export type BookingTeamRoleInput = z.infer<typeof teamRoleSchema>;

export const teamMemberSchema = z
  .object({
    id: uuid.optional(),
    tenant_id: uuid,
    organization_id: uuid,
    display_name: z.string().min(1),
    user_id: uuid.optional(),
    role_ids: z.array(uuid).default([]),
    tags: stringTagArray,
    is_active: z.boolean().default(true),
  })
  .strict();

export type BookingTeamMemberInput = z.infer<typeof teamMemberSchema>;

export const resourceTypeSchema = z
  .object({
    id: uuid.optional(),
    tenant_id: uuid,
    organization_id: uuid,
    name: z.string().min(1),
    description: z.string().optional(),
  })
  .strict();

export type BookingResourceTypeInput = z.infer<typeof resourceTypeSchema>;

export const resourceSchema = z
  .object({
    id: uuid.optional(),
    tenant_id: uuid,
    organization_id: uuid,
    name: z.string().min(1),
    resource_type_id: uuid.optional(),
    capacity: quantitySchema.optional(),
    tags: stringTagArray,
    is_active: z.boolean().default(true),
  })
  .strict();

export type BookingResourceInput = z.infer<typeof resourceSchema>;

export const availabilityRuleSchema = z
  .object({
    id: uuid.optional(),
    tenant_id: uuid,
    organization_id: uuid,
    subject_type: z.enum(['member', 'resource']),
    subject_id: uuid,
    timezone: z.string().min(1),
    rrule: z.string().min(1),
    exdates: z.array(z.string()).default([]),
  })
  .strict();

export type BookingAvailabilityRuleInput = z.infer<typeof availabilityRuleSchema>;

/**
 * TODO schemas (next iteration):
 * - bookingEventMemberSchema
 * - bookingEventResourceSchema
 * These will share the uuid + tags helpers declared above.
 */

