import { useState, useCallback } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, MapPin, ChevronDown, X, Check, Clock, Hash } from "lucide-react";
import { useRole } from "../context/RoleContext.jsx";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../backend.js";

export default function JobBuilder({ onBack, onJobCreated, jobToEdit }) {
  const { user } = useRole();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  });

  const steps = [
    { key: "jobtitle", label: "Job Title", hint: "e.g. Frontend Engineer", type: "text" },
    { key: "company", label: "Company", hint: "Company name", type: "text" },
    { key: "compensation", label: "Compensation", hint: "e.g. ₹8-12 LPA", type: "text" },
    { key: "experience", label: "Experience (years)", hint: "Number of years", type: "number" },
    { key: "location", label: "Location", hint: "e.g. Bangalore, India", type: "text" },
    { key: "region", label: "Region", hint: "e.g. South India / Remote", type: "text" },
    { key: "skillsets", label: "Skillsets (comma separated)", hint: "e.g. React, TypeScript, Node.js", type: "text" },
    { key: "jobdesc", label: "Job Description", hint: "Brief description of the role", type: "textarea" },
    { key: "responsibilities", label: "Responsibilities", hint: "Key responsibilities of the role", type: "textarea" },
  ];

  const current = steps[step];
  const canAdvance = useCallback(() => {
    switch (current.key) {
      case "jobtitle":
        return Boolean(form.jobtitle.trim());
      case "company":
        return Boolean(form.company.trim());
      case "compensation":
        return Boolean(form.compensation.trim());
      case "experience":
        return Boolean(form.experience.trim()) && !isNaN(Number(form.experience));
      case "location":
        return Boolean(form.location.trim());
      case "region":
        return Boolean(form.region.trim());
      case "skillsets":
        return Boolean(form.skillsets.trim());
      case "jobdesc":
        return Boolean(form.jobdesc.trim());
      case "responsibilities":
        return Boolean(form.responsibilities.trim());
      default:
        return true;
    }
  }, [current, form]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canAdvance()) {
      setError("Please complete this step before continuing.");
      return;
    }
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }
    // Final submit — create or update job
    setBusy(true);
    setError("");
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
        isavailable: form.isavailable,
      };
      if (isEditMode && form.jobid) {
        // Update existing job in Firestore
        await setDoc(doc(db, "jobs", form.jobid), { ...jobData, jobposted: new Date().toISOString() }, { merge: true });
        setError("");
        if (onJobCreated) onJobCreated({ ...jobData, jobid: form.jobid, jobposted: new Date().toISOString() });
      } else {
        // Create new job
        const jobid = crypto.randomUUID();
        const job = {
          jobid,
          ...jobData,
          jobposted: new Date().toISOString(),
          recruiterId: user.uid,
          recruiterEmail: user.email || "",
        };
        await setDoc(doc(db, "jobs", jobid), job);
        setError("");
        if (onJobCreated) onJobCreated(job);
      }
    } catch (err) {
      setError(err.message || "Could not save the job.");
    } finally {
      setBusy(false);
    }
  };

  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="recruiter-page">
      <div className="page-heading">
        <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to dashboard</button>
        <div>
          <div className="eyebrow">{isEditMode ? "EDIT JOB" : "STRUCTURED JOB BUILDER"}</div>
          <h1>{isEditMode ? "Edit job details" : "Create a new job"}</h1>
          <p>{isEditMode ? "Update the job requisition. Changes are saved to the jobs table." : "A standardized job requisition. All fields are required."}</p>
        </div>
      </div>

      <div className="recruiter-card">
        <div className="stepper">
          <div className="stepper-progress">
            <span className="step-copy">{current.label}</span>
            <span className="step-count">{step + 1} of {steps.length}</span>
          </div>
          <div className="step-track"><span style={{ width: `${progress}%` }} /></div>
        </div>

        <form onSubmit={handleSubmit} className="step-form">
          {current.key === "jobtitle" && (
            <>
              <label className="field-label">Job title</label>
              <input
                autoFocus
                value={form.jobtitle}
                onChange={(e) => update("jobtitle", e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                required
              />
              <p className="field-hint">Clear, specific title. Avoid internal jargon.</p>
            </>
          )}
          {current.key === "company" && (
            <>
              <label className="field-label">Company name</label>
              <input
                autoFocus
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
                placeholder="e.g. Acme Corp"
                required
              />
            </>
          )}
          {current.key === "compensation" && (
            <>
              <label className="field-label">Compensation</label>
              <input
                autoFocus
                value={form.compensation}
                onChange={(e) => update("compensation", e.target.value)}
                placeholder="e.g. ₹8-12 LPA"
                required
              />
            </>
          )}
          {current.key === "experience" && (
            <>
              <label className="field-label">Experience (years)</label>
              <input
                autoFocus
                type="number"
                min="0"
                value={form.experience}
                onChange={(e) => update("experience", e.target.value)}
                required
              />
            </>
          )}
          {current.key === "location" && (
            <>
              <label className="field-label">Location</label>
              <input
                autoFocus
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="e.g. Bangalore, India"
                required
              />
            </>
          )}
          {current.key === "region" && (
            <>
              <label className="field-label">Region</label>
              <input
                autoFocus
                value={form.region}
                onChange={(e) => update("region", e.target.value)}
                placeholder="e.g. South India / Remote"
                required
              />
            </>
          )}
          {current.key === "skillsets" && (
            <>
              <label className="field-label">Skillsets (comma separated)</label>
              <input
                autoFocus
                value={form.skillsets}
                onChange={(e) => update("skillsets", e.target.value)}
                placeholder="e.g. React, TypeScript, Node.js"
                required
              />
            </>
          )}
          {current.key === "jobdesc" && (
            <>
              <label className="field-label">Job description</label>
              <textarea
                autoFocus
                value={form.jobdesc}
                onChange={(e) => update("jobdesc", e.target.value)}
                rows="4"
                placeholder="Brief description of the role and team."
                required
              />
            </>
          )}
          {current.key === "responsibilities" && (
            <>
              <label className="field-label">Responsibilities</label>
              <textarea
                autoFocus
                value={form.responsibilities}
                onChange={(e) => update("responsibilities", e.target.value)}
                rows="4"
                placeholder="Key responsibilities of the role."
                required
              />
            </>
          )}

          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <div className="step-actions">
            {step > 0 && (
              <button className="button button-secondary" onClick={() => setStep(step - 1)} disabled={busy}>
                <ArrowLeft size={16} /> Back
              </button>
            )}
            <button className="button button-primary" onClick={(e) => { e.preventDefault(); handleSubmit(e); }} disabled={busy || !canAdvance()}>
              {busy ? "Creating job…" : step === steps.length - 1 ? "Publish job" : "Continue"} <ArrowRight size={17} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
