-- Reel Ideas Dashboard — Database Schema
-- Run this in the Supabase SQL Editor to set up all tables.

-- Daily topic batches
create table topic_batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  generated_date date not null,
  source_type text not null check (source_type in ('daily_cron', 'youtube', 'manual')),
  youtube_url text,
  performance_context text
);

-- Individual topics within a batch
create table topics (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references topic_batches(id) on delete cascade,
  created_at timestamptz default now(),
  position int not null,
  title text not null,
  category text not null,
  hook_line text not null,
  core_insight text not null,
  talking_points text[] not null,
  cta text not null,
  source_url text,
  status text not null default 'pending' check (status in ('pending', 'script_requested', 'script_ready', 'approved', 'shot', 'discarded'))
);

-- Full scripts generated from selected topics
create table scripts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references topics(id) on delete cascade,
  created_at timestamptz default now(),
  content text not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'shot'))
);

-- Performance data per script
create table performance (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references topics(id) on delete cascade,
  script_id uuid references scripts(id) on delete set null,
  logged_at timestamptz default now(),
  views int,
  likes int,
  shares int,
  saves int,
  comments int,
  notes text
);

-- Indexes for common queries
create index idx_topic_batches_date on topic_batches(generated_date desc);
create index idx_topics_batch_id on topics(batch_id);
create index idx_topics_status on topics(status);
create index idx_scripts_topic_id on scripts(topic_id);
create index idx_scripts_status on scripts(status);
create index idx_performance_topic_id on performance(topic_id);
create index idx_performance_logged_at on performance(logged_at desc);
