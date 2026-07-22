-- -----------------------------------------------------------------------------
-- SQL SCHEMA FOR CABLE GUY MVP
-- -----------------------------------------------------------------------------

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. LOCATIONS TABLE (Hierarchical storage locations)
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_location_id uuid references public.locations(id) on delete set null,
  description text,
  user_id uuid not null default auth.uid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.locations enable row level security;

-- Create RLS Policies for locations
create policy "Users can perform all actions on their own locations"
  on public.locations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 2. CABLES TABLE (Cables & Power Supplies)
create table if not exists public.cables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  connector_type text not null,
  location_id uuid references public.locations(id) on delete set null,
  is_multi_output boolean default false not null,
  power_outputs jsonb, -- array of PowerOutput specs
  user_id uuid not null default auth.uid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.cables enable row level security;

-- Create RLS Policies for cables
create policy "Users can perform all actions on their own cables"
  on public.cables for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 3. DEVICES TABLE
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manufacturer text,
  required_voltage numeric,
  required_amperage numeric,
  required_connector_type text,
  location_id uuid references public.locations(id) on delete set null,
  user_id uuid not null default auth.uid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.devices enable row level security;

-- Create RLS Policies for devices
create policy "Users can perform all actions on their own devices"
  on public.devices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 4. CABLE_DEVICE_LINKS TABLE (Many-to-Many connections)
create table if not exists public.cable_device_links (
  cable_id uuid references public.cables(id) on delete cascade not null,
  device_id uuid references public.devices(id) on delete cascade not null,
  user_id uuid not null default auth.uid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (cable_id, device_id)
);

-- Enable RLS
alter table public.cable_device_links enable row level security;

-- Create RLS Policies for mappings
create policy "Users can perform all actions on their own mappings"
  on public.cable_device_links for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
create index if not exists idx_locations_user_id on public.locations(user_id);
create index if not exists idx_cables_user_id on public.cables(user_id);
create index if not exists idx_devices_user_id on public.devices(user_id);
create index if not exists idx_cable_device_links_user_id on public.cable_device_links(user_id);
