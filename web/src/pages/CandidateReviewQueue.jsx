import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Check, Star, ShieldCheck, MapPin, X, Users, Filter, Sliders } from "lucide-react";
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

const NOTICE_PERIOD_OPTIONS = [
  ["IMMEDIATE", "Immediate"],
  ["LESS_THAN_15_DAYS", "< 15 days"],
  ["THIRTY_DAYS", "30 days"],
  ["SIXTY_PLUS_DAYS", "60+ days"],
];

const RELOCATION_OPTIONS = [
  ["open", "Open to relocate"],
  ["prefer-not", "Prefer not to relocate"],
  ["negotiable", "Negotiable"],
];

const WORK_MODE_OPTIONS = [
  ["remote", "Remote"],
  ["hybrid", "Hybrid"],
  ["onsite", "Onsite"],
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
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("applicants");
  const [actionShowing, setActionShowing] = useState(null);
  const [declineReason, setDeclineReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Granular logistics filters
  const [filters, setFilters] = useState({
    noticePeriod: "",
    relocationReadiness: "",
    currentCTC: "",
    expectedCTC: "",
    remoteHybridPreference: "",
  });

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
              noticePeriod: profile.noticePeriod || "",
              relocationReadiness: profile.relocationReadiness || "",
              currentCTC: profile.currentCTC || "",
              expectedCTC: profile.expectedCTC || "",
              remoteHybridPreference: profile.remoteHybridPreference || "",
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

  const loadApplicants = async () => {
    const jobIds = jobs.map((j) => j.id);
    if (jobIds.length === 0) { setApplicants([]); return; }
    try {
      const q = query(collection(db, "candidate_reviews"), where("recruiterId", "==", user.uid));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => {
        const data = d.data();
        const job = jobs.find((j) => j.id === data.jobId);
        const candidate = candidates.find((c) => c.id === data.candidateId);
        return {
          id: data.id,
          jobId: data.jobId,
          jobTitle: job ? job.title : "Unknown role",
          candidateId: data.candidateId,
          candidateName: candidate ? candidate.displayName : "Candidate",
          candidateEmail: candidate ? candidate.email : "",
          candidateProfile: candidate ? candidate.profile : {},
          action: data.action,
          status: data.status,
          reason: data.reason || "",
          createdAt: data.createdAt,
        };
      }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setApplicants(list);
    } catch (e) {
      setError(`Could not load applicants: ${e.message || "unknown error"}`);
    }
  };

  useEffect(() => {
    if (activeTab === "applicants") {
      loadApplicants();
    }
  }, [activeTab, jobs, candidates, user, db]);

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

  // Filter candidates by granular logistics criteria
  const passesFilters = (candidate) => {
    if (filters.noticePeriod && candidate.noticePeriod !== filters.noticePeriod) return false;
    if (filters.relocationReadiness && candidate.relocationReadiness !== filters.relocationReadiness) return false;
    if (filters.remoteHybridPreference && candidate.remoteHybridPreference !== filters.remoteHybridPreference) return false;
    if (filters.currentCTC && candidate.currentCTC != null && Number(candidate.currentCTC) > Number(filters.currentCTC)) return false;
    if (filters.expectedCTC && candidate.expectedCTC != null && Number(candidate.expectedCTC) > Number(filters.expectedCTC)) return false;
    return true;
  };

  const filteredApplicants = useMemo(() => {
    return applicants.filter((app) => {
      const candidate = candidates.find((c) => c.id === app.candidateId);
      if (!candidate) return true;
      return passesFilters(candidate);
    });
  }, [applicants, candidates, filters]);

  const filteredGrouped = useMemo(() => {
    return grouped.map(({ job, candidates: jobCandidates }) => ({
      job,
      candidates: jobCandidates.filter((c) => passesFilters(c)),
    })).filter((g) => g.candidates.length > 0);
  }, [grouped, filters]);

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
      if (activeTab === "applicants") {
        await loadApplicants();
      }
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

  const hasActiveFilters = Object.values(filters).some((v) => v !== "" && v !== null);

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

  return (
    <div className="recruiter-page">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to dashboard</button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CANDIDATE REVIEW QUEUE</div>
          <h1>Review candidates</h1>
          <p>Track applicants and review by role with skill match scores.</p>
        </div>
      </div>

      {/* Granular Logistics Filters */}
      <div className="recruiter-card">
        <div className="filter-bar">
          <button className="filter-toggle" onClick={() => setActiveTab(activeTab)} title="Filters">
            <Sliders size={16} />
            <span>Filters</span>
            {hasActiveFilters && <span className="nav-count">{Object.values(filters).filter(Boolean).length}</span>}
          </button>
          <div className="filter-grid">
            <div className="filter-field">
              <label>Notice Period</label>
              <select value={filters.noticePeriod} onChange={(e) => setFilters({ ...filters, noticePeriod: e.target.value })}>
                <option value="">Any</option>
                {NOTICE_PERIOD_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="filter-field">
              <label>Relocation</label>
              <select value={filters.relocationReadiness} onChange={(e) => setFilters({ ...filters, relocationReadiness: e.target.value })}>
                <option value="">Any</option>
                {RELOCATION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="filter-field">
              <label>Work Preference</label>
              <select value={filters.remoteHybridPreference} onChange={(e) => setFilters({ ...filters, remoteHybridPreference: e.target.value })}>
                <option value="">Any</option>
                {WORK_MODE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="filter-field">
              <label>Max Current CTC (LPA)</label>
              <input type="number" value={filters.currentCTC} onChange={(e) => setFilters({ ...filters, currentCTC: e.target.value })} placeholder="0" />
            </div>
            <div className="filter-field">
              <label>Max Expected CTC (LPA)</label>
              <input type="number" value={filters.expectedCTC} onChange={(e) => setFilters({ ...filters, expectedCTC: e.target.value })} placeholder="0" />
            </div>
            {hasActiveFilters && (
              <button className="filter-clear" onClick={() => setFilters({ noticePeriod: "", relocationReadiness: "", currentCTC: "", expectedCTC: "", remoteHybridPreference: "" })}>
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="recruiter-tabs">
        <button
          key="applicants"
          className={`recruiter-tab ${activeTab === "applicants" ? "recruiter-tab-active" : ""}`}
          onClick={() => setActiveTab("applicants")}
        >
          <Users size={16} /> Applicants <span className="nav-count">{filteredApplicants.length}</span>
        </button>
        <button
          key="review"
          className={`recruiter-tab ${activeTab === "review" ? "recruiter-tab-active" : ""}`}
          onClick={() => setActiveTab("review")}
        >
          <Check size={16} /> Review Candidates <span className="nav-count">{filteredGrouped.reduce((sum, g) => sum + g.candidates.length, 0)}</span>
        </button>
      </div>

      {/* Applicants - flat list */}
      {activeTab === "applicants" && (
        <div className="recruiter-card">
          {filteredApplicants.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Users size={25} /></div>
              <h2>No applicants yet</h2>
              <p>Candidates who apply to your posted roles will appear here.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Email</th>
                    <th>Role Applied</th>
                    <th>Notice</th>
                    <th>CTC</th>
                    <th>Work Mode</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplicants.map((app) => {
                    const candidate = candidates.find((c) => c.id === app.candidateId);
                    return (
                      <tr key={app.id}>
                        <td>
                          <div className="admin-user-cell">
                            <div className="avatar admin-avatar">{app.candidateName.charAt(0).toUpperCase()}</div>
                            <div>{app.candidateName}</div>
                          </div>
                        </td>
                        <td>{app.candidateEmail || "—"}</td>
                        <td>{app.jobTitle}</td>
                        <td>{app.candidateProfile?.noticePeriod || candidate?.noticePeriod || "—"}</td>
                        <td>{candidate?.currentCTC ? `₹${candidate.currentCTC} LPA` : "—"}</td>
                        <td>{candidate?.remoteHybridPreference || "—"}</td>
                        <td><span className={`role-badge role-${(app.status || "submitted").toLowerCase()}`}>{(app.status || "Submitted").charAt(0).toUpperCase() + (app.status || "submitted").slice(1)}</span></td>
                        <td>
                          {app.status === "DECLINED" && (
                            <button className="button button-secondary" onClick={() => setActionShowing(ACTION_DECLINE)} disabled={busy}>
                              Decline Reason
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Review Candidates - grouped by job with match scores */}
      {activeTab === "review" && (
        <div className="recruiter-card">
          {filteredGrouped.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Check size={25} /></div>
              <h2>No candidates to review</h2>
              <p>No open jobs with matching candidates found.</p>
            </div>
          ) : (
            <>
              {filteredGrouped.map(({ job, candidates: jobCandidates }) => (
                <section key={job.id} className="review-job-card">
                  <div className="review-job-header">
                    <div>
                      <div className="eyebrow">{job.company}</div>
                      <h3 style={{ margin: 0 }}>{job.title}</h3>
                    </div>
                    <span className="nav-count">{jobCandidates.length}</span>
                  </div>
                  <div className="skill-list" style={{ marginBottom: 12 }}>
                    {job.coreSkills.slice(0, 6).map((s) => <span key={s} className="skill-tag">{s}</span>)}
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Candidate</th>
                          <th>Email</th>
                          <th>Match Score</th>
                          <th>Notice</th>
                          <th>CTC</th>
                          <th>Work Mode</th>
                          <th>Candidate Skills</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobCandidates.map((candidate) => {
                          const existing = applicants.find((a) => a.candidateId === candidate.id && a.jobId === job.id);
                          return (
                            <tr key={candidate.id}>
                              <td>
                                <div className="admin-user-cell">
                                  <div className="avatar admin-avatar">{candidate.displayName.charAt(0).toUpperCase()}</div>
                                  <div>{candidate.displayName}</div>
                                </div>
                              </td>
                              <td>{candidate.email || "—"}</td>
                              <td>{matchBadge(candidate.matchScore)}</td>
                              <td>{candidate.noticePeriod || "—"}</td>
                              <td>{candidate.expectedCTC ? `₹${candidate.expectedCTC} LPA` : "—"}</td>
                              <td>{candidate.remoteHybridPreference || "—"}</td>
                              <td>
                                <div className="skill-list" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {candidate.topSkills.slice(0, 4).map((s) => <span key={s} className="skill-tag" style={{ fontSize: 11, padding: "2px 8px" }}>{s}</span>)}
                                </div>
                              </td>
                              <td>
                                {existing ? (
                                  <button className="button button-secondary" disabled>
                                    {existing.status}
                                  </button>
                                ) : (
                                  <button className="button button-primary" onClick={() => recordAction(job.id, candidate.id, ACTION_SHORTLIST)} disabled={busy}>
                                    <Check size={14} /> Shortlist
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
      )}

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
