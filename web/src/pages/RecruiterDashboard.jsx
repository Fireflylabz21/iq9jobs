import { useState, useEffect } from "react";
import { BriefcaseBusiness, Users, Check, Plus, MapPin } from "lucide-react";
import { useRole } from "../context/RoleContext.jsx";
import { collection, query, where, getDocs } from "firebase/firestore";
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

  // Load applicants for recruiter's jobs from Supabase applications table (for KPI stats only)
  useEffect(() => {
    if (!currentUser || !supabase || jobs.length === 0) {
      setApplicants([]);
      return;
    }
    const jobIds = jobs.map((j) => j.id);
    supabase
      .from("applications")
      .select("*")
      .in("jobId", jobIds)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setApplicants([]);
          return;
        }
        const apps = (data || []).map((a) => ({
          ...a,
          jobTitle: jobs.find((j) => j.id === a.jobId)?.title || "Unknown role",
          jobId: a.jobId,
        }));
        setApplicants(apps);
      })
      .catch(() => setApplicants([]));
  }, [currentUser, supabase, jobs]);

  const totalJobs = jobs.length;
  const totalApplicants = applicants.length;
  const totalShortlisted = applicants.filter((a) => (a.status || "").toLowerCase() === "shortlisted").length;

  const tabs = [
    { key: "jobs", label: "Jobs posted", icon: <BriefcaseBusiness size={16} />, count: totalJobs },
  ];

  return (
    <div className="recruiter-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">RECRUITER WORKSPACE</div>
          <h1>Hiring dashboard</h1>
          <p>Post roles and track applications.</p>
        </div>
        <button className="button button-primary" onClick={() => { setJobToEdit(null); setShowBuilder(true); }} disabled={busy}>
          <Plus size={16} /> Post a new role
        </button>
      </div>

      {/* Analytics KPI tiles */}
      <div className="stats-banner">
        <div className="stat-tile">
          <div className="stat-icon"><BriefcaseBusiness size={20} /></div>
          <div className="stat-value">{totalJobs}</div>
          <div className="stat-label">Jobs posted</div>
        </div>
        <div className="stat-tile">
          <div className="stat-icon"><Users size={20} /></div>
          <div className="stat-value">{totalApplicants}</div>
          <div className="stat-label">Total applicants</div>
        </div>
        <div className="stat-tile">
          <div className="stat-icon"><Check size={20} /></div>
          <div className="stat-value">{totalShortlisted}</div>
          <div className="stat-label">Total shortlisted</div>
        </div>
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

      {showBuilder && (
        <JobBuilder
          jobToEdit={jobToEdit}
          onBack={() => { setJobToEdit(null); setShowBuilder(false); }}
          onJobCreated={(job) => {
            setShowBuilder(false);
            setJobToEdit(null);
            if (jobToEdit) {
              setJobs(jobs.map((j) => (j.jobid === job.jobid ? job : j)));
            } else {
              setJobs([...jobs, job]);
            }
          }} />
      )}
    </div>
  );
}
