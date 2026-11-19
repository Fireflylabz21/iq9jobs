import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const ATS_STATUSES = ["applied", "screening", "interview", "offer", "rejected"];

/**
 * Fetch applicants for a recruiter's jobs with ATS filtering.
 * Filters by status and min match_score. Keyword search falls back to client-side
 * on parsed_resume_text (production should use Postgres tsquery via RPC).
 */
export async function searchApplicants(filter) {
  let query = supabase
    .from("applications")
    .select(
      `id, job_id, candidate_id, status, match_score, match_breakdown,
      applied_at, updated_at,
      candidate:candidate_id (
        id, email, full_name, raw_skills, parsed_resume_text,
        resume_bucket_path, resume_content_type
      ),
      job:job_id (id, title, company)`
    )
    .order("match_score", { ascending: false })
    .order("applied_at", { ascending: false });

  if (filter.jobId) query = query.eq("job_id", filter.jobId);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.candidateId) query = query.eq("candidate_id", filter.candidateId);
  if (filter.minMatchScore != null) {
    query = query.gte("match_score", filter.minMatchScore);
  }

  const { data, error } = await query;
  if (error) throw error;

  let results = data || [];

  if (filter.keyword) {
    const kw = filter.keyword.toLowerCase();
    results = results.filter((a) =>
      a.candidate?.parsed_resume_text?.toLowerCase().includes(kw) ||
      a.candidate?.full_name?.toLowerCase().includes(kw) ||
      a.candidate?.email?.toLowerCase().includes(kw)
    );
  }

  return results;
}

/**
 * Generate a 15-minute pre-signed download URL for a candidate's resume.
 * Access is gated by Storage RLS policies (candidate owner, recruiter of job, admin).
 */
export async function getResumeDownloadUrl(bucketPath) {
  const { data, error } = await supabase.storage
    .from("resumes")
    .createSignedUrl(bucketPath, 60 * 15); // 15 minutes
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Compute match_score between a job's required_skills and a candidate's parsed skills.
 */
export function computeMatchScore(jobRequiredSkills, candidateSkills) {
  const jobSet = new Set(jobRequiredSkills.map((s) => s.toLowerCase().trim()));
  const candSet = new Set(candidateSkills.map((s) => s.toLowerCase().trim()));
  const matched = [...jobSet].filter((s) => candSet.has(s));
  const missing = [...jobSet].filter((s) => !candSet.has(s));
  const score = jobSet.size === 0 ? 0 : Math.round((matched.length / jobSet.size) * 100);
  return {
    score,
    breakdown: {
      skills_matched: matched,
      skills_missing: missing,
      match_ratio: jobSet.size ? matched.length / jobSet.size : 0,
    },
  };
}
