import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Check, Star, ShieldCheck, MapPin, X } from "lucide-react";
import { useRole } from "../context/RoleContext.jsx";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../backend.js";

const ACTION_SHORTLIST = "shortlist";
const ACTION_DECLINE = "decline";
const ACTION_SAVE = "save";

const DECLINE_REASONS = [
  "Notice period mismatch",
  "Compensation expectation out of range",
  "Selected candidate with closer tech stack fit",
  "Other",
];

function skillsOverlap(jobSkills, candidateSkills) {
  const jobSet = new Set((jobSkills || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean));
  const candSet = new Set((candidateSkills || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean));
  if (jobSet.size === 0 || candSet.size === 0) return 0;
  const overlap = [...jobSet].filter((s) => candSet.has(s)).length;
  return overlap / Math.min(jobSet.size, candSet.size);
}

function titleSimilarity(jobTitle, candidateTitle) {
  const a = String(jobTitle || "").toLowerCase();
  const b = String(candidateTitle || "").toLowerCase();
  if (!a || !b) return 0;
  const wordsA = a.split(/\s+/).filter(Boolean);
  const wordsB = b.split(/\s+/).filter(Boolean);
  const matches = wordsA.filter((w) => wordsB.includes(w)).length;
  return wordsA.length ? matches / wordsA.length : 0;
}

export default function CandidateReviewQueue({ onBack }) {
  const { user } = useRole();
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionShowing, setActionShowing] = useState(null);
  const [declineReason, setDeclineReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !db) return;
    setLoading(true);
    let active = true;

    const loadJobs = async () => {
      try {
        const q = query(
          collection(db, "jobs"),
          where("recruiterId", "==", user.uid),
          where("isavailable", "==", true),
        );
        const snap = await getDocs(q);
        const jobList = snap.docs.map((d) => {
          const data = d.data();
          const skillsets = (data.skillsets || "").split(",").map((s) => s.trim()).filter(Boolean);
          return {
            id: data.jobid || d.id,
            title: data.jobtitle || "Untitled role",
            company: data.company || "Company",
            location: data.location || "",
            coreSkills: skillsets,
            recruiterId: data.recruiterId,
          };
        });
        if (active) setJobs(jobList);
      } catch (e) {
        if (active) setError(`Could not load jobs: ${e.message || "unknown error"}`);
      }
    };

    const loadCandidates = async () => {
      try {
        const q = query(collection(db, "users"), where("role", "==", "seeker"));
        const snap = await getDocs(q);
        const list = snap.docs
          .map((d) => {
            const data = d.data();
            const profile = data.seekerProfile || {};
            return {
              id: data.uid || d.id,
              uid: data.uid,
              email: data.email || "",
              displayName: data.displayName || "",
              profile,
              topSkills: (Array.isArray(profile.topSkills) ? profile.topSkills : []),
              targetTitle: profile.targetTitle || "",
              expectedLocation: profile.expectedLocation || "",
              agentDetails: data.agentDetails || {},
            };
          })
          .filter((c) => c.topSkills && c.topSkills.length > 0);
        if (active) setCandidates(list);
      } catch (e) {
        if (active) setError(`Could not load candidates: ${e.message || "unknown error"}`);
      }
    };

    loadJobs();
    loadCandidates();

    return () => { active = false; };
  }, [user, db]);

  const grouped = useMemo(() => {
    return jobs.map((job) => {
      const scored = candidates.map((candidate) => {
        const skillScore = skillsOverlap(job.coreSkills, candidate.topSkills);
        const titleScore = titleSimilarity(job.title, candidate.targetTitle);
        const score = Math.round((skillScore * 0.7 + titleScore * 0.3) * 100);
        return { ...candidate, matchScore: score };
      }).sort((a, b) => b.matchScore - a.matchScore);
      return { job, candidates: scored };
    }).filter((g) => g.candidates.length > 0);
  }, [jobs, candidates]);

  const recordAction = async (jobId, candidateId, action, reason = "") => {
    setBusy(true);
    try {
      const reviewId = crypto.randomUUID();
      await setDoc(doc(db, "candidate_reviews", reviewId), {
        id: reviewId,
        recruiterId: user.uid,
        recruiterEmail: user.email || "",
        jobId,
        candidateId,
        action,
        reason,
        status: action === ACTION_SHORTLIST ? "SHORTLISTED" : action === ACTION_DECLINE ? "DECLINED" : "SAVED",
        createdAt: serverTimestamp(),
      });
      setActionShowing(null);
      setDeclineReason("");
    } catch (err) {
      setError(err.message || "Could not record review action.");
    } finally {
      setBusy(false);
    }
  };

  const matchBadge = (score) => {
    if (score >= 70) return <span className="match-score match-high">{score}% match</span>;
    if (score >= 40) return <span className="match-score match-med">{score}% match</span>;
    return <span className="match-score match-low">{score}% match</span>;
  };

  if (loading) {
    return (
      <div className="recruiter-page">
        <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to dashboard</button>
        <div className="recruiter-card">
          <div className="jobs-loading"><div className="loading-spinner" /> Loading review queue…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="recruiter-page">
        <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to dashboard</button>
        <div className="recruiter-card">
          <div className="empty-state">
            <div className="empty-icon"><ShieldCheck size={25} /></div>
            <h2>Something went wrong</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (grouped.length === 0) {
    return (
      <div className="recruiter-page">
        <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to dashboard</button>
        <div className="recruiter-card">
          <div className="empty-state">
            <div className="empty-icon"><Check size={25} /></div>
            <h2>No candidates to review</h2>
            <p>No open jobs with matching candidates found.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="recruiter-page">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to dashboard</button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CANDIDATE REVIEW QUEUE</div>
          <h1>Review candidates by role</h1>
          <p>Candidates grouped by your open roles with skill match scores.</p>
        </div>
      </div>

      {grouped.map(({ job, candidates: jobCandidates }) => (
        <section key={job.id} className="recruiter-card" style={{ marginBottom: 24 }}>
          <div className="page-heading" style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #1b2535" }}>
            <div>
              <div className="eyebrow">{job.company}</div>
              <h2 style={{ margin: 0, fontSize: 18 }}>{job.title}</h2>
              <div className="company-location"><MapPin size={13} /> {job.location || "Location not specified"}</div>
            </div>
            <span className="nav-count">{jobCandidates.length} candidates</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {jobCandidates.map((candidate) => (
              <article key={candidate.id} className="review-candidate-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="company-avatar">{candidate.displayName.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 700, color: "#d8e1f0" }}>{candidate.displayName || "Candidate"}</div>
                      <div style={{ fontSize: 12, color: "#8592a7" }}>{candidate.targetTitle || "Untitled profile"}</div>
                    </div>
                  </div>
                  {matchBadge(candidate.matchScore)}
                </div>
                <div style={{ marginBottom: 10, fontSize: 12, color: "#8592a7" }}>
                  <MapPin size={13} /> {candidate.expectedLocation || "Location not specified"}
                </div>
                <div className="skill-list" style={{ marginBottom: 14 }}>
                  {(candidate.topSkills || []).slice(0, 6).map((s) => <span key={s} className="skill-tag">{s}</span>)}
                </div>
                <div className="review-actions" style={{ justifyContent: "flex-start" }}>
                  <button className="button button-secondary" onClick={() => setActionShowing(ACTION_DECLINE)} disabled={busy}>
                    Decline with Reason
                  </button>
                  <button className="button button-primary" onClick={() => recordAction(job.id, candidate.id, ACTION_SHORTLIST)} disabled={busy}>
                    <Check size={16} /> Shortlist
                  </button>
                  <button className="button button-secondary" onClick={() => recordAction(job.id, candidate.id, ACTION_SAVE)} disabled={busy}>
                    <Star size={16} /> Save to Talent Pool
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {actionShowing === ACTION_DECLINE && (
        <div className="modal-backdrop" onClick={() => setActionShowing(null)}>
          <div className="details-modal">
            <div className="modal-top">
              <span className="eyebrow">DECLINE REASON</span>
              <button className="icon-button" onClick={() => setActionShowing(null)}><X size={19} /></button>
            </div>
            <p>Select a standardized reason for declining this candidate.</p>
            <div className="settings-fields">
              {DECLINE_REASONS.map((r) => (
                <label key={r} className="field-label">
                  {r}
                  <input
                    type="radio"
                    name="declineReason"
                    value={r}
                    checked={declineReason === r}
                    onChange={(e) => setDeclineReason(e.target.value)}
                  />
                </label>
              ))}
            </div>
            <div className="settings-actions">
              <button className="button button-secondary" onClick={() => setActionShowing(null)}>Cancel</button>
              <button className="button button-primary" onClick={() => recordAction("", "", ACTION_DECLINE, declineReason)} disabled={busy || !declineReason}>
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
