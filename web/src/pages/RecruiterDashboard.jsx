import { useState, useEffect } from "react";
import { BriefcaseBusiness, Star, Check, Users, Plus, Settings, LogOut, ArrowRight, MessageCircle } from "lucide-react";
import { useRole } from "../context/RoleContext.jsx";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "../backend.js";
import JobBuilder from "./JobBuilder.jsx";
import CandidateReviewQueue from "./CandidateReviewQueue.jsx";
import ChatPage from "./ChatPage.jsx";

export default function RecruiterDashboard({ onSignOut, busy }) {
  const { user } = useRole();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [activeTab, setActiveTab] = useState("jobs");
  const [chatOpen, setChatOpen] = useState(null);
  const [chatJobTitle, setChatJobTitle] = useState("");

  useEffect(() => {
    if (!user || !db) return;
    setLoading(true);
    const q = query(collection(db, "jobs"), where("recruiterId", "==", user.uid));
    getDocs(q).then((snap) => {
      setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, db]);

  const tabs = [
    { key: "jobs", label: "My Roles", icon: <BriefcaseBusiness size={16} />, count: jobs.length },
    { key: "review", label: "Review Candidates", icon: <Users size={16} />, count: 0 },
    { key: "messages", label: "Messages", icon: <MessageCircle size={16} />, count: 0 },
  ];

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
                    <div className="company-location">{job.location || "Location not specified"}</div>
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

      {activeTab === "review" && <CandidateReviewQueue onBack={() => setActiveTab("jobs")} />}

      {activeTab === "messages" && (
        <div className="recruiter-card">
          <button className="back-link" onClick={() => setActiveTab("jobs")}><ArrowLeft size={16} /> Back to dashboard</button>
          <div className="page-heading">
            <div>
              <div className="eyebrow">MESSAGES</div>
              <h1>Direct chat</h1>
              <p>Message candidates you have shortlisted.</p>
            </div>
          </div>
          <div className="empty-state">
            <div className="empty-icon"><MessageCircle size={25} /></div>
            <h2>No active conversations</h2>
            <p>Shortlist a candidate from the review queue to start messaging.</p>
          </div>
        </div>
      )}

      {chatOpen && (
        <ChatPage
          user={user}
          otherUserId={chatOpen}
          jobTitle={chatJobTitle}
          onBack={() => setChatOpen(null)}
        />
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
