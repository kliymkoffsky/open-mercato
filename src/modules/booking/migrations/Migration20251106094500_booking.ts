import { Migration } from '@mikro-orm/migrations'

export class Migration20251106094500_booking extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table "booking_services" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "name" text not null, "description" text null, "duration_minutes" int not null, "capacity_model" text check ("capacity_model" in ('one_to_one', 'one_to_many', 'many_to_many')) not null, "max_attendees" int null, "required_roles" jsonb not null default '[]', "required_members" jsonb not null default '[]', "required_resources" jsonb not null default '[]', "required_resource_types" jsonb not null default '[]', "tags" jsonb not null default '[]', "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "booking_services_pkey" primary key ("id"));`)
    this.addSql(`create index "booking_services_org_tenant_idx" on "booking_services" ("organization_id", "tenant_id");`)

    this.addSql(`create table "booking_team_roles" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "name" text not null, "description" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "booking_team_roles_pkey" primary key ("id"));`)
    this.addSql(`create index "booking_team_roles_org_tenant_idx" on "booking_team_roles" ("organization_id", "tenant_id");`)

    this.addSql(`create table "booking_team_members" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "display_name" text not null, "user_id" uuid null, "role_ids" jsonb not null default '[]', "tags" jsonb not null default '[]', "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "booking_team_members_pkey" primary key ("id"));`)
    this.addSql(`create index "booking_team_members_org_tenant_idx" on "booking_team_members" ("organization_id", "tenant_id");`)

    this.addSql(`create table "booking_resource_types" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "name" text not null, "description" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "booking_resource_types_pkey" primary key ("id"));`)
    this.addSql(`create index "booking_resource_types_org_tenant_idx" on "booking_resource_types" ("organization_id", "tenant_id");`)

    this.addSql(`create table "booking_resources" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "name" text not null, "resource_type_id" uuid null, "capacity" int null, "tags" jsonb not null default '[]', "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "booking_resources_pkey" primary key ("id"));`)
    this.addSql(`create index "booking_resources_org_tenant_idx" on "booking_resources" ("organization_id", "tenant_id");`)

    this.addSql(`create table "booking_availability_rules" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "subject_type" text check ("subject_type" in ('member', 'resource')) not null, "subject_id" uuid not null, "timezone" text not null, "rrule" text not null, "exdates" jsonb not null default '[]', "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "booking_availability_rules_pkey" primary key ("id"));`)
    this.addSql(`create index "booking_availability_rules_org_tenant_idx" on "booking_availability_rules" ("organization_id", "tenant_id");`)
    this.addSql(`create index "booking_availability_rules_subject_idx" on "booking_availability_rules" ("subject_type", "subject_id");`)

    this.addSql(`create table "booking_events" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "service_id" uuid not null, "title" text not null, "starts_at" timestamptz not null, "ends_at" timestamptz not null, "timezone" text null, "rrule" text null, "exdates" jsonb not null default '[]', "status" text check ("status" in ('draft', 'confirmed', 'cancelled')) not null, "tags" jsonb not null default '[]', "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "booking_events_pkey" primary key ("id"));`)
    this.addSql(`create index "booking_events_org_tenant_idx" on "booking_events" ("organization_id", "tenant_id");`)
    this.addSql(`create index "booking_events_service_idx" on "booking_events" ("service_id");`)

    this.addSql(`create table "booking_event_attendees" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "event_id" uuid not null, "first_name" text not null, "last_name" text not null, "email" text null, "phone" text null, "address_line1" text null, "address_line2" text null, "city" text null, "region" text null, "postal_code" text null, "country" text null, "attendee_type" text null, "external_ref" text null, "tags" jsonb not null default '[]', "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "booking_event_attendees_pkey" primary key ("id"));`)
    this.addSql(`create index "booking_event_attendees_org_tenant_idx" on "booking_event_attendees" ("organization_id", "tenant_id");`)
    this.addSql(`create index "booking_event_attendees_event_idx" on "booking_event_attendees" ("event_id");`)

    this.addSql(`create table "booking_event_members" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "event_id" uuid not null, "member_id" uuid not null, "role_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "booking_event_members_pkey" primary key ("id"));`)
    this.addSql(`create index "booking_event_members_org_tenant_idx" on "booking_event_members" ("organization_id", "tenant_id");`)
    this.addSql(`create index "booking_event_members_event_idx" on "booking_event_members" ("event_id");`)

    this.addSql(`create table "booking_event_resources" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "event_id" uuid not null, "resource_id" uuid not null, "qty" int not null default 1, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "booking_event_resources_pkey" primary key ("id"));`)
    this.addSql(`create index "booking_event_resources_org_tenant_idx" on "booking_event_resources" ("organization_id", "tenant_id");`)
    this.addSql(`create index "booking_event_resources_event_idx" on "booking_event_resources" ("event_id");`)
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "booking_event_resources" cascade;')
    this.addSql('drop table if exists "booking_event_members" cascade;')
    this.addSql('drop table if exists "booking_event_attendees" cascade;')
    this.addSql('drop table if exists "booking_events" cascade;')
    this.addSql('drop table if exists "booking_availability_rules" cascade;')
    this.addSql('drop table if exists "booking_resources" cascade;')
    this.addSql('drop table if exists "booking_resource_types" cascade;')
    this.addSql('drop table if exists "booking_team_members" cascade;')
    this.addSql('drop table if exists "booking_team_roles" cascade;')
    this.addSql('drop table if exists "booking_services" cascade;')
  }
}

