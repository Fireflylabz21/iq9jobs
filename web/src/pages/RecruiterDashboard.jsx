import { useState, useEffect } from "react";
import { BriefcaseBusiness, Star, Check, Users, Plus, Settings, LogOut, ArrowRight, MessageCircle, MapPin } from "lucide-react";
import { useRole } from "../context/RoleContext.jsx";
import { collection, query, where, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db, supabase } from "../backend.js";
import JobBuilder from "./JobBuilder.jsx";
import CandidateReviewQueue from "./CandidateReviewQueue.jsx";
import ChatPage from "./ChatPage.jsx";

export default function RecruiterDashboard({ user, onSignOut, busy, initialTab }) {
  const { user: currentUser } = useRole();
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || "jobs");
  const [chatOpen, setChatOpen] = useState(null);
  const [chatJobTitle, setChatJobTitle] = useState("");
  const [applicantLoading, setApplicantLoading] = useState(false);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

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
    { key: "jobs", label: "My Roles", icon: <BriefcaseBusiness size={16} />, count: jobs.length },
    { key: "applicants", label: "Applicants", icon: <Users size={16} />, count: applicants.length },
    { key: "review", label: "Review Candidates", icon: <Check size={16} />, count: 0 },
    { key: "messages", label: "Messages", icon: <MessageCircle size={16} />, count: 0 },
  ];

  const getApplicantName = (app) => {
    if (app.seekerProfile?.targetTitle) return app.seekerProfile.targetTitle;
    if (app.agentDetails?.fullName) return app.agentDetails.fullName;
    return app.seekerEmail || app.seekerId || "Candidate";
  };

  const getApplicantEmail = (app) => app.seekerEmail || app.seekerId || "—";

  return (
    <div className="recruiter-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">RECRUITER WORKSPACE</div>
          <h1>Hiring dashboard</h1>
          <p>Post roles, review candidates, and manage your hiring pipeline.</p>
        </div>
        <button className="button button-primary" onClick={() => setShowBuilder(true)} disabled={busy}>
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

      {/* Posted Jobs */}
      {activeTab === "jobs" && (
        <div className="recruiter-card">
          {loading ? (
            <div className="jobs-loading"><div className="loading-spinner" /> Loading roles…</div>
          ) : jobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><BriefcaseBusiness size={25} /></div>
              <h2>No roles posted yet</h2>
              <p>Post your first structured role to start receiving candidates.</p>
            </div>
          ) : (
            <div className="job-grid">
              {jobs.map((job) => (
                <article key={job.id} className="job-card recruiter-job-card">
                  <div className="company-heading">
                    <div className="company-name">{job.company}</div>
                    <div className="company-location"><MapPin size={13} /> {job.location || "Location not specified"}</div>
                  </div>
                  <h3>{job.title}</h3>
                  <div className="salary-line"><span>{job.salary_min || 0} – ₹{job.salary_max || 0}</span></div>
                  <span className="tag tag-mode">{job.work_style}</span>
                  <div className="skill-list" style={{ marginTop: 10 }}>
                    {(job.required_skills || []).map((s) => <span key={s} className="skill-tag">{s}</span>)}
                  </div>
                  <div className="job-card-actions" style={{ marginTop: 16 }}>
                    <button className="button button-secondary" onClick={() => setShowBuilder(true)}>Edit</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Applicants - users who applied to recruiter's jobs */}
      {activeTab === "applicants" && (
        <div className="recruiter-card">
          <button className="back-link" onClick={() => setActiveTab("jobs")}><ArrowLeft size={16} /> Back to dashboard</button>
          <div className="page-heading">
            <div>
              <div className="eyebrow">APPLICATION DETAILS</div>
              <h1>Applicants</h1>
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
                    <th>Actions</th>
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
                      <td>
                        <button className="button button-secondary" onClick={() => {
                          setChatOpen(app.seekerId || app.seekerEmail);
                          setChatJobTitle(app.jobTitle);
                          setActiveTab("messages");
                        }}><MessageCircle size={14} /> Message</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "review" && <CandidateReviewQueue onBack={() => setActiveTab("jobs")} />}

      {activeTab === "messages" && (
        <div className="recruiter-page">
          <button className="back-link" onClick={() => setActiveTab("applicants")}><ArrowLeft size={16} /> Back to applicants</button>
          {chatOpen && (
            <ChatPage
              user={currentUser}
              otherUserId={chatOpen}
              jobTitle={chatJobTitle}
              onBack={() => setChatOpen(null)}
            />
          )}
          {!chatOpen && (
            <div className="recruiter-card">
              <div className="page-heading">
                <div>
                  <div className="eyebrow">MESSAGES</div>
                  <h1>Direct chat</h1>
                  <p>Message candidates you have shortlisted or who applied to your roles.</p>
                </div>
              </div>
              <div className="empty-state">
                <div className="empty-icon"><MessageCircle size={25} /></div>
                <h2>No active conversation</h2>
                <p>Select a candidate from Applicants to start messaging.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {showBuilder && (
        <JobBuilder onBack={() => setShowBuilder(false)} onJobCreated={(job) => {
          setShowBuilder(false);
          setJobs([...jobs, job]);
        }} />
      )}
    </div>
  );
}
