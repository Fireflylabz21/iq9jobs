-- ============================================================
-- Row-Level Security (RLS) Policies
-- ============================================================

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;

-- Profiles: candidates read own, recruiters/admins read all (for matching)
create policy "profiles_own_read" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_own_update" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_recruiter_admin_read_all" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('recruiter','admin')
    )
  );

-- Jobs: recruiters manage own, everyone reads active jobs
create policy "jobs_public_read_active" on public.jobs
  for select using (is_active = true);

create policy "jobs_recruiter_own" on public.jobs
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'recruiter' and p.id = jobs.recruiter_id
    )
  );

create policy "jobs_admin_all" on public.jobs
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Applications: candidates manage own, recruiters read applications to their jobs, admins read all
create policy "applications_candidate_own" on public.applications
  for all using (auth.uid() = candidate_id);

create policy "applications_recruiter_read_own_jobs" on public.applications
  for select using (
    exists (
      select 1 from public.jobs j
      where j.id = applications.job_id
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'recruiter' and p.id = j.recruiter_id
        )
    )
  );

create policy "applications_admin_all" on public.applications
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
// Storage: private "resumes" bucket with signed-URL access
-- ============================================================

-- Assumes bucket "resumes" created as private in Supabase Dashboard
-- (or via SQL: insert into storage.buckets (id, name, public) values ('resumes','resumes', false);)

-- Only the candidate (owner) can upload their own resume
create policy "resumes_candidate_upload" on storage.objects
  for insert with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Only the candidate can read/download their own resume
create policy "resumes_candidate_read" on storage.objects
  for select using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Recruiters can read resumes for applications to their jobs
create policy "resumes_recruiter_read_application" on storage.objects
  for select using (
    bucket_id = 'resumes'
    and exists (
      select 1 from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.candidate_id::text = (storage.foldername(name))[1]
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'recruiter' and p.id = j.recruiter_id
        )
    )
  );

-- Admins can read all resumes
create policy "resumes_admin_read" on storage.objects
  for select using (
    bucket_id = 'resumes'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Candidates can delete their own resume
create policy "resumes_candidate_delete" on storage.objects
  for delete using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
