import { useState, useEffect } from "react";
import { BriefcaseBusiness, Star, Check, Users, Plus, Settings, LogOut, ArrowRight, MapPin } from "lucide-react";
import { useRole } from "../context/RoleContext.jsx";
import { collection, query, where, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db, supabase } from "../backend.js";
import JobBuilder from "./JobBuilder.jsx";

export default function RecruiterDashboard({ user, onSignOut, busy, initialTab }) {
  const { user: currentUser } = useRole();
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [jobToEdit, setJobToEdit] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab || "jobs");
  const [applicantLoading, setApplicantLoading] = useState(false);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Load jobs posted by this recruiter from Firestore jobs table
  useEffect(() => {
    if (!currentUser || !db) return;
    setLoading(true);
    const q = query(collection(db, "jobs"), where("recruiterId", "==", currentUser.uid));
    getDocs(q).then((snap) => {
      setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [currentUser, db]);

  // Load applicants for recruiter's jobs from Supabase applications table
  useEffect(() => {
    if (!currentUser || !supabase || jobs.length === 0) {
      setApplicants([]);
      return;
    }
    setApplicantLoading(true);
    const jobIds = jobs.map((j) => j.id);
    supabase
      .from("applications")
      .select("*")
      .in("jobId", jobIds)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setApplicants([]);
          setApplicantLoading(false);
          return;
        }
        const apps = (data || []).map((a) => ({
          ...a,
          jobTitle: jobs.find((j) => j.id === a.jobId)?.title || "Unknown role",
          jobId: a.jobId,
        }));
        setApplicants(apps);
        setApplicantLoading(false);
      })
      .catch(() => {
        setApplicants([]);
        setApplicantLoading(false);
      });
  }, [currentUser, supabase, jobs]);

  const tabs = [
    { key: "jobs", label: "Jobs posted", icon: <BriefcaseBusiness size={16} />, count: jobs.length },
    { key: "applicants", label: "Applicants", icon: <Users size={16} />, count: applicants.length },
    { key: "review", label: "Review Candidates", icon: <Check size={16} />, count: 0 },
  ];

  const getApplicantName = (app) => {
    if (app.seekerProfile?.targetTitle) return app.seekerProfile.targetTitle;
    if (app.agentDetails?.fullName) return app.agentDetails.fullName;
    return app.seekerEmail || app.seekerId || "Candidate";
  };

  const getApplicantEmail = (app) => app.seekerEmail || app.seekerId || "—";

  // Calculate skill match score between candidate profile skills and job required skills
  const calculateMatchScore = (candidateSkills, jobSkills) => {
    if (!candidateSkills || candidateSkills.length === 0) return 0;
    if (!jobSkills || jobSkills.length === 0) return 0;
    const candidateSet = new Set(candidateSkills.map((s) => s.toLowerCase().trim()));
    const matched = jobSkills.filter((s) => candidateSet.has(s.toLowerCase().trim())).length;
    return Math.round((matched / jobSkills.length) * 100);
  };

  // Group applicants by job with match scores
  const applicantsByJob = jobs.map((job) => {
    const jobApps = applicants.filter((a) => a.jobId === job.id);
    const scoredApps = jobApps.map((app) => {
      const candidateSkills = app.seekerProfile?.topSkills || [];
      const jobSkills = job.skillsets ? job.skillsets.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const score = calculateMatchScore(candidateSkills, jobSkills);
      return { ...app, matchScore: score };
    }).sort((a, b) => b.matchScore - a.matchScore);
    return { job, applicants: scoredApps };
  }).filter((j) => j.applicants.length > 0);

  return (
    <div className="recruiter-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">RECRUITER WORKSPACE</div>
          <h1>Hiring dashboard</h1>
          <p>Post roles, track applications, and review candidates.</p>
        </div>
        <button className="button button-primary" onClick={() => { setJobToEdit(null); setShowBuilder(true); }} disabled={busy}>
          <Plus size={16} /> Post a new role
        </button>
      </div>

      <div className="recruiter-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`recruiter-tab ${activeTab === tab.key ? "recruiter-tab-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label} <span className="nav-count">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Jobs posted */}
      {activeTab === "jobs" && (
        <div className="recruiter-card">
          {loading ? (
            <div className="jobs-loading"><div className="loading-spinner" /> Loading jobs…</div>
          ) : jobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><BriefcaseBusiness size={25} /></div>
              <h2>No jobs posted yet</h2>
              <p>Post your first structured role to start receiving candidates.</p>
            </div>
          ) : (
            <div className="job-grid">
              {jobs.map((job) => (
                <article key={job.jobid || job.id} className="job-card recruiter-job-card">
                  <div className="company-heading">
                    <div className="company-name">{job.company}</div>
                    <div className="company-location"><MapPin size={13} /> {job.location || "Location not specified"}</div>
                  </div>
                  <h3>{job.jobtitle}</h3>
                  <div className="salary-line"><span>{job.compensation || "Compensation not listed"}</span></div>
                  <span className="tag tag-mode">{job.experience != null ? job.experience + " years exp" : ""}</span>
                  <div className="skill-list" style={{ marginTop: 10 }}>
                    {(job.skillsets ? job.skillsets.split(",").map((s) => s.trim()).filter(Boolean) : []).map((s) => <span key={s} className="skill-tag">{s}</span>)}
                  </div>
                  <div className="job-card-actions" style={{ marginTop: 16 }}>
                    <button className="button button-secondary" onClick={() => { setJobToEdit(job); setShowBuilder(true); }}>Edit</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Applicants - all applications across recruiter's jobs */}
      {activeTab === "applicants" && (
        <div className="recruiter-card">
          <button className="back-link" onClick={() => setActiveTab("jobs")}><ArrowLeft size={16} /> Back to dashboard</button>
          <div className="page-heading">
            <div>
              <div className="eyebrow">APPLICATION DETAILS</div>
              <h1>All Applicants</h1>
              <p>View candidates who applied to your posted roles.</p>
            </div>
          </div>
          {applicantLoading ? (
            <div className="jobs-loading"><div className="loading-spinner" /> Loading applicants…</div>
          ) : applicants.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Users size={25} /></div>
              <h2>No applicants yet</h2>
              <p>Candidates who apply to your roles will appear here.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Email</th>
                    <th>Role Applied</th>
                    <th>Status</th>
                    <th>Applied At</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.map((app) => (
                    <tr key={app.id}>
                      <td>
                        <div className="admin-user-cell">
                          <div className="avatar admin-avatar">{getApplicantName(app).charAt(0).toUpperCase()}</div>
                          <div>{getApplicantName(app)}</div>
                        </div>
                      </td>
                      <td>{getApplicantEmail(app)}</td>
                      <td>{app.jobTitle}</td>
                      <td><span className={`role-badge role-${(app.status || "submitted").toLowerCase()}`}>{(app.status || "Submitted").charAt(0).toUpperCase() + (app.status || "submitted").slice(1)}</span></td>
                      <td>{app.created_at ? new Date(app.created_at).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Review Candidates - job-wise with skill match scores */}
      {activeTab === "review" && (
        <div className="recruiter-page">
          <button className="back-link" onClick={() => setActiveTab("jobs")}><ArrowLeft size={16} /> Back to dashboard</button>
          <div className="page-heading">
            <div>
              <div className="eyebrow">CANDIDATE REVIEW — SKILL MATCHING</div>
              <h1>Review by Job</h1>
              <p>Candidates ranked by skill match score for each posted role.</p>
            </div>
          </div>
          {applicantLoading ? (
            <div className="jobs-loading"><div className="loading-spinner" /> Loading reviews…</div>
          ) : applicantsByJob.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Check size={25} /></div>
              <h2>No applications to review</h2>
              <p>Candidates who apply to your posted roles will appear here with match scores.</p>
            </div>
          ) : (
            <div className="review-by-job">
              {applicantsByJob.map(({ job, applicants: jobApplicants }) => (
                <article key={job.jobid || job.id} className="review-job-card">
                  <div className="review-job-header">
                    <h3>{job.jobtitle}</h3>
                    <span className="tag tag-mode">{job.experience != null ? job.experience + " yrs exp" : ""}</span>
                  </div>
                  <div className="skill-list" style={{ marginBottom: 12 }}>
                    {(job.skillsets ? job.skillsets.split(",").map((s) => s.trim()).filter(Boolean) : []).map((s) => <span key={s} className="skill-tag">{s}</span>)}
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Candidate</th>
                          <th>Email</th>
                          <th>Match Score</th>
                          <th>Candidate Skills</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobApplicants.map((app) => {
                          const candidateSkills = app.seekerProfile?.topSkills || [];
                          return (
                            <tr key={app.id}>
                              <td>
                                <div className="admin-user-cell">
                                  <div className="avatar admin-avatar">{getApplicantName(app).charAt(0).toUpperCase()}</div>
                                  <div>{getApplicantName(app)}</div>
                                </div>
                              </td>
                              <td>{getApplicantEmail(app)}</td>
                              <td>
                                <span className={`match-score match-${app.matchScore >= 70 ? "high" : app.matchScore >= 40 ? "med" : "low"}`}>
                                  {app.matchScore}%
                                </span>
                              </td>
                              <td>
                                <div className="skill-list" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {candidateSkills.slice(0, 4).map((s) => <span key={s} className="skill-tag" style={{ fontSize: 11, padding: "2px 8px" }}>{s}</span>)}
                                </div>
                              </td>
                              <td><span className={`role-badge role-${(app.status || "submitted").toLowerCase()}`}>{(app.status || "Submitted").charAt(0).toUpperCase() + (app.status || "submitted").slice(1)}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {showBuilder && (
        <JobBuilder
          jobToEdit={jobToEdit}
          onBack={() => { setJobToEdit(null); setShowBuilder(false); }}
          onJobCreated={(job) => {
            setShowBuilder(false);
            setJobToEdit(null);
            if (jobToEdit) {
              // Update existing job in list
              setJobs(jobs.map((j) => (j.jobid === job.jobid ? job : j)));
            } else {
              setJobs([...jobs, job]);
            }
          }} />
      )}
    </div>
  );
}
