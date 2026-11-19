import { useState } from "react";
import { ArrowLeft, Plus, Save, CheckCircle, Clock, MapPin, BriefcaseBusiness } from "lucide-react";
import { useRole } from "../context/RoleContext.jsx";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../backend.js";

export default function JobBuilder({ onBack, onJobCreated, jobToEdit }) {
  const { user } = useRole();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isEditMode, setIsEditMode] = useState(Boolean(jobToEdit));
  const [form, setForm] = useState({
    jobid: jobToEdit?.jobid || "",
    jobtitle: jobToEdit?.jobtitle || "",
    company: jobToEdit?.company || "",
    compensation: jobToEdit?.compensation || "",
    experience: jobToEdit?.experience != null ? String(jobToEdit.experience) : "",
    location: jobToEdit?.location || "",
    region: jobToEdit?.region || "",
    skillsets: jobToEdit?.skillsets || "",
    jobdesc: jobToEdit?.jobdesc || "",
    responsibilities: jobToEdit?.responsibilities || "",
    isavailable: jobToEdit?.isavailable ?? true,
    status: jobToEdit?.status || "DRAFT",
  });

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
    setNotice("");
  };

  const validate = () => {
    if (!form.jobtitle.trim()) return "Job title is required";
    if (!form.company.trim()) return "Company is required";
    if (!form.compensation.trim()) return "Compensation is required";
    if (!form.experience.trim() || isNaN(Number(form.experience))) return "Valid experience is required";
    if (!form.location.trim()) return "Location is required";
    if (!form.region.trim()) return "Region is required";
    if (!form.skillsets.trim()) return "Skillsets are required";
    if (!form.jobdesc.trim()) return "Job description is required";
    if (!form.responsibilities.trim()) return "Responsibilities are required";
    return null;
  };

  const saveJob = async (status) => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const jobData = {
        jobtitle: form.jobtitle.trim(),
        company: form.company.trim(),
        compensation: form.compensation.trim(),
        experience: Number(form.experience),
        location: form.location.trim(),
        region: form.region.trim(),
        skillsets: form.skillsets.trim(),
        jobdesc: form.jobdesc.trim(),
        responsibilities: form.responsibilities.trim(),
        isavailable: status === "PUBLISHED",
        status,
      };
      if (isEditMode && form.jobid) {
        await setDoc(doc(db, "jobs", form.jobid), { ...jobData, jobposted: new Date().toISOString() }, { merge: true });
        setNotice(isEditMode ? "Job updated successfully." : "Job saved as draft.");
        if (onJobCreated) onJobCreated({ ...jobData, jobid: form.jobid, jobposted: new Date().toISOString() });
      } else {
        const jobid = crypto.randomUUID();
        const job = {
          jobid,
          ...jobData,
          jobposted: new Date().toISOString(),
          recruiterId: user.uid,
          recruiterEmail: user.email || "",
        };
        await setDoc(doc(db, "jobs", jobid), job);
        setNotice(status === "PUBLISHED" ? "Job published successfully." : "Job saved as draft.");
        if (onJobCreated) onJobCreated(job);
      }
    } catch (err) {
      setError(err.message || "Could not save the job.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="recruiter-page">
      <div className="page-heading">
        <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to dashboard</button>
        <div>
          <div className="eyebrow">{isEditMode ? "EDIT JOB" : "POST A NEW JOB"}</div>
          <h1>{isEditMode ? "Edit job details" : "Create a new job requisition"}</h1>
          <p>Fill in all details below. You can save as draft or publish immediately.</p>
        </div>
      </div>

      <div className="recruiter-card job-form-page">
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {notice && <div className="alert alert-success" role="alert">{notice}</div>}

        <form onSubmit={(e) => { e.preventDefault(); saveJob("PUBLISHED"); }} className="job-form">
          <div className="form-section">
            <div className="section-header"><BriefcaseBusiness size={18} /> Basic Details</div>
            <div className="form-fields">
              <div className="form-field">
                <label className="field-label">Job title <span style={{ color: "#fb7185" }}>*</span></label>
                <input autoFocus value={form.jobtitle} onChange={(e) => update("jobtitle", e.target.value)} placeholder="e.g. Senior Frontend Engineer" required />
              </div>
              <div className="form-field">
                <label className="field-label">Company <span style={{ color: "#fb7185" }}>*</span></label>
                <input value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="e.g. Acme Corp" required />
              </div>
              <div className="form-field">
                <label className="field-label">Compensation <span style={{ color: "#fb7185" }}>*</span></label>
                <input value={form.compensation} onChange={(e) => update("compensation", e.target.value)} placeholder="e.g. ₹8-12 LPA" required />
              </div>
              <div className="form-field">
                <label className="field-label">Experience (years) <span style={{ color: "#fb7185" }}>*</span></label>
                <input type="number" min="0" value={form.experience} onChange={(e) => update("experience", e.target.value)} required />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="section-header"><MapPin size={18} /> Location</div>
            <div className="form-fields">
              <div className="form-field">
                <label className="field-label">Location <span style={{ color: "#fb7185" }}>*</span></label>
                <input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="e.g. Bangalore, India" required />
              </div>
              <div className="form-field">
                <label className="field-label">Region <span style={{ color: "#fb7185" }}>*</span></label>
                <input value={form.region} onChange={(e) => update("region", e.target.value)} placeholder="e.g. South India / Remote" required />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="section-header"><Plus size={18} /> Skills</div>
            <div className="form-field">
              <label className="field-label">Skillsets <span style={{ color: "#fb7185" }}>*</span></label>
              <input value={form.skillsets} onChange={(e) => update("skillsets", e.target.value)} placeholder="e.g. React, TypeScript, Node.js, AWS" required />
              <p className="field-hint">Comma-separated list of required skills.</p>
            </div>
          </div>

          <div className="form-section">
            <div className="section-header"><Clock size={18} /> Description</div>
            <div className="form-field">
              <label className="field-label">Job Description <span style={{ color: "#fb7185" }}>*</span></label>
              <textarea value={form.jobdesc} onChange={(e) => update("jobdesc", e.target.value)} rows="4" placeholder="Brief description of the role and team." required />
            </div>
            <div className="form-field">
              <label className="field-label">Responsibilities <span style={{ color: "#fb7185" }}>*</span></label>
              <textarea value={form.responsibilities} onChange={(e) => update("responsibilities", e.target.value)} rows="4" placeholder="Key responsibilities of the role." required />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="button button-secondary" onClick={() => saveJob("DRAFT")} disabled={busy}>
              <Save size={16} /> {busy ? "Saving…" : "Save as Draft"}
            </button>
            <button type="submit" className="button button-primary" disabled={busy}>
              <CheckCircle size={16} /> {busy ? "Publishing…" : "Publish Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
