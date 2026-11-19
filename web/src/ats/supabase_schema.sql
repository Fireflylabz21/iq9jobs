-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- Profiles table (extends Supabase Auth users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text check (role in ('candidate', 'recruiter', 'admin')) default 'candidate',
  avatar_url text,
  raw_skills jsonb default '[]'::jsonb,           -- parsed skills array [{name, level, evidence}]
  experience jsonb default '[]'::jsonb,           -- structured work history
  education jsonb default '[]'::jsonb,
  contact jsonb default '{}'::jsonb,              -- phone, location, portfolio, etc.
  parsed_resume_text text default '',             -- full text extracted from resume (browser-parsed)
  resume_bucket_path text,                        -- storage path in private resumes bucket
  resume_content_type text,
  resume_file_size int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Jobs table (recruiter-posted)
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  company text not null,
  description text not null,
  location text,
  region text,
  experience_min int default 0,
  experience_max int,
  compensation text,
  work_style text check (work_style in ('remote','hybrid','onsite')) default 'remote',
  is_active boolean default true,
  status text check (status in ('draft','published','closed')) default 'published',
  required_skills jsonb default '[]'::jsonb,      -- [{name, level}]
  posted_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Applications table
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade not null,
  candidate_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('applied','screening','interview','offer','rejected')) default 'applied',
  match_score int default 0,                      -- 0-100 skill-overlap match
  match_breakdown jsonb default '{}'::jsonb,      -- {skills_matched, skills_missing, title_match, location_match}
  resume_text_hash text,                          -- hash of parsed resume text for dedup
  applied_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(job_id, candidate_id)
);

-- ATS Full-Text Search vector on profiles (parsed resume text)
create index idx_profiles_parsed_resume_fts on public.profiles
  using gin(to_tsvector('english', coalesce(parsed_resume_text, '')));

-- ATS Full-Text Search vector on jobs (description + required skills)
create index idx_jobs_description_fts on public.jobs
  using gin(to_tsvector('english', coalesce(description, '') || ' ' || coalesce(
    (select string_agg(skill->>'name', ' ') from jsonb_array_elements(required_skills) as skill), ''
  )));

-- Indexes for recruiter filtering
create index idx_applications_job_status on public.applications(job_id, status);
create index idx_applications_candidate on public.applications(candidate_id);
create index idx_jobs_recruiter on public.jobs(recruiter_id);

-- Updated-at triggers
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger jobs_updated_at before update on public.jobs
  for each row execute procedure public.set_updated_at();

create trigger applications_updated_at before update on public.applications
  for each row execute procedure public.set_updated_at();
