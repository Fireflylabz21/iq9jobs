-- ============================================================
-- User Profile Schema (Supabase PostgreSQL)
-- Run this on top of the existing supabase_schema.sql
-- ============================================================

-- Add missing profile columns for logistics filtering (ALTER if profiles already exists)
alter table public.profiles
  add column if not exists notice_period text check (notice_period in ('IMMEDIATE','LESS_THAN_15_DAYS','THIRTY_DAYS','SIXTY_PLUS_DAYS')) default 'IMMEDIATE';

alter table public.profiles
  add column if not exists current_ctc numeric;                    -- LPA, current compensation

alter table public.profiles
  add column if not exists expected_ctc numeric;                   -- LPA, expected compensation

alter table public.profiles
  add column if not exists relocation_readiness text check (relocation_readiness in ('open','prefer-not','negotiable')) default 'open';

alter table public.profiles
  add column if not exists remote_hybrid_preference text check (remote_hybrid_preference in ('remote','hybrid','onsite')) default 'remote';

alter table public.profiles
  add column if not exists target_role text;                       -- target job title

-- Indexes for recruiter logistics filtering
create index if not exists idx_profiles_notice_period on public.profiles(notice_period);
create index if not exists idx_profiles_relocation on public.profiles(relocation_readiness);
create index if not exists idx_profiles_work_mode on public.profiles(remote_hybrid_preference);
create index if not exists idx_profiles_current_ctc on public.profiles(current_ctc);
create index if not exists idx_profiles_expected_ctc on public.profiles(expected_ctc);

-- ============================================================
-- Firestore users/{uid} document structure (web app)
-- ============================================================
/*
{
  uid: string,
  email: string,
  displayName: string,
  role: 'candidate' | 'recruiter' | 'admin',
  agentDetails: {
    fullName: string,
    email: string,
    phoneNumber: string,
    primarySkillsets: string[],
    targetRole: string,
    yearsExperience: number,
    currentCompany: string,
    currentLocation: string,
    expectedLocation: string,
    noticePeriod: string,
    currentCTC: number | null,
    expectedCTC: number | null,
    relocationReadiness: string,
    remoteHybridPreference: string,
  },
  seekerProfile: {
    targetTitle: string,
    noticePeriod: string,
    topSkills: string[],
    expectedLocation: string,
    parsedResumeText: string,
    rawSkills: string[],
    currentCTC: number | null,
    expectedCTC: number | null,
    relocationReadiness: string,
    remoteHybridPreference: string,
    resumePath: string | null,
  },
  onboardingCompleted: boolean,
  createdAt: timestamp,
  updatedAt: timestamp,
}
*/

-- ============================================================
-- Supabase subscribers table (candidate registration)
-- ============================================================
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique not null,
  phone_number text,
  primary_skillsets text,
  secondary_skillsets text default '',
  years_experience int default 0,
  current_company text,
  current_ctc text default 'Not provided',
  notice_period text,
  current_location text,
  expected_location text,
  status text check (status in ('Active','Inactive')) default 'Active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_subscribers_email on public.subscribers(email);
create index if not exists idx_subscribers_notice_period on public.subscribers(notice_period);
