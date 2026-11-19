import { useState, useCallback } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, MapPin, ChevronDown, X, Check, Clock, Hash } from "lucide-react";
import { useRole } from "../context/RoleContext.jsx";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../backend.js";

const WORK_MODES = ["REMOTE", "HYBRID", "ONSITE", "UNSPECIFIED"];
const WORK_MODE_LABELS = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ONSITE: "Onsite",
  UNSPECIFIED: "Unspecified",
};

export default function JobBuilder({ onBack, onJobCreated }) {
  const { user } = useRole();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    company: "",
    salaryMin: "",
    salaryMax: "",
    workMode: "REMOTE",
    skills: ["", "", ""],
    knockoutQuestions: ["", "", ""],
    location: "",
    description: "",
    minExperience: "",
    maxExperience: "",
  });

  const steps = [
    { key: "title", label: "Role Title", hint: "e.g. Frontend Engineer", type: "text" },
    { key: "company", label: "Company", hint: "Company name", type: "text" },
    { key: "salary", label: "Salary Range", hint: "Minimum and maximum (INR)", type: "number" },
    { key: "workMode", label: "Work Mode", hint: "Remote / Hybrid / Onsite", type: "select" },
    { key: "skills", label: "Core Skills (exactly 3)", hint: "Pick 3 non-negotiable skills", type: "skills" },
    { key: "knockout", label: "Knockout Questions (3)", hint: "Binary or numeric screening questions", type: "knockout" },
    { key: "details", label: "Role Details", hint: "Location, experience, description", type: "details" },
  ];

  const current = steps[step];
  const canAdvance = useCallback(() => {
    switch (current.key) {
      case "title":
        return Boolean(form.title.trim());
      case "company":
        return Boolean(form.company.trim());
      case "salary":
        return Boolean(form.salaryMin.trim()) && Boolean(form.salaryMax.trim()) && Number(form.salaryMax) > Number(form.salaryMin);
      case "workMode":
        return Boolean(form.workMode);
      case "skills":
        return form.skills.filter((s) => s.trim()).length === 3;
      case "knockout":
        return form.knockoutQuestions.filter((q) => q.trim()).length === 3;
      case "details":
        return Boolean(form.location.trim()) && Boolean(form.description.trim());
      default:
        return true;
    }
  }, [current, form]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const updateSkill = (index, value) => {
    const skills = [...form.skills];
    skills[index] = value;
    setForm({ ...form, skills });
    setError("");
  };

  const updateKnockout = (index, value) => {
    const qs = [...form.knockoutQuestions];
    qs[index] = value;
    setForm({ ...form, knockoutQuestions: qs });
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
    // Final submit — create job
    setBusy(true);
    setError("");
    try {
      const jobId = crypto.randomUUID();
      const job = {
        id: jobId,
        title: form.title.trim(),
        company: form.company.trim(),
        location: form.location.trim(),
        region: form.location.trim().split(/[,/]/).map((p) => p.trim()).filter(Boolean)[0] || "",
        work_style: form.workMode,
        min_experience: form.minExperience ? Number(form.minExperience) : null,
        max_experience: form.maxExperience ? Number(form.maxExperience) : null,
        required_skills: form.skills.map((s) => s.trim()).filter(Boolean),
        description_text: form.description.trim(),
        apply_url: "",
        posted_at: new Date().toISOString(),
        salary_min: Number(form.salaryMin) || 0,
        salary_max: Number(form.salaryMax) || 0,
        verified_company: false,
        is_active: true,
        recruiterId: user.uid,
        recruiterEmail: user.email || "",
        knockoutQuestions: form.knockoutQuestions.map((q) => q.trim()).filter(Boolean),
      };
      await setDoc(doc(db, "jobs", jobId), job);
      setError("");
      if (onJobCreated) onJobCreated(job);
    } catch (err) {
      setError(err.message || "Could not create the role.");
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
          <div className="eyebrow">STRUCTURED JOB BUILDER</div>
          <h1>Create a new role</h1>
          <p>A 3-minute, standardized job requisition. Salary range and exactly 3 skills are mandatory.</p>
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
          {current.key === "title" && (
            <>
              <label className="field-label">Role title</label>
              <input
                autoFocus
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
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
          {current.key === "salary" && (
            <>
              <div className="settings-fields">
                <label className="field-label">Minimum salary (₹)</label>
                <input
                  autoFocus
                  type="number"
                  min="0"
                  value={form.salaryMin}
                  onChange={(e) => update("salaryMin", e.target.value)}
                  required
                />
                <label className="field-label">Maximum salary (₹)</label>
                <input
                  autoFocus
                  type="number"
                  min="0"
                  value={form.salaryMax}
                  onChange={(e) => update("salaryMax", e.target.value)}
                  required
                />
              </div>
              <p className="field-hint">Both floor and ceiling are required. Max must exceed min.</p>
            </>
          )}
          {current.key === "workMode" && (
            <>
              <label className="field-label">Work mode</label>
              <select
                autoFocus
                value={form.workMode}
                onChange={(e) => update("workMode", e.target.value)}
              >
                {WORK_MODES.map((m) => (
                  <option key={m} value={m}>{WORK_MODE_LABELS[m]}</option>
                ))}
              </select>
            </>
          )}
          {current.key === "skills" && (
            <>
              <label className="field-label">Core skills (exactly 3)</label>
              <div className="skills-inputs">
                {form.skills.map((skill, index) => (
                  <input
                    key={index}
                    autoFocus={index === 0}
                    value={skill}
                    onChange={(e) => updateSkill(index, e.target.value)}
                    placeholder={`Skill ${index + 1}`}
                  />
                ))}
              </div>
              <p className="field-hint">Exactly 3 non-negotiable skills from the standardized taxonomy.</p>
              {form.skills.filter((s) => s.trim()).length !== 3 && (
                <span className="field-hint error-hint">You have {form.skills.filter((s) => s.trim()).length} of 3 skills.</span>
              )}
            </>
          )}
          {current.key === "knockout" && (
            <>
              <label className="field-label">Knockout questions (3)</label>
              <div className="skills-inputs">
                {form.knockoutQuestions.map((q, index) => (
                  <input
                    key={index}
                    autoFocus={index === 0}
                    value={q}
                    onChange={(e) => updateKnockout(index, e.target.value)}
                    placeholder={`Question ${index + 1} (Yes/No or numeric)`}
                  />
                ))}
              </div>
              <p className="field-hint">Exactly 3 binary or numeric screening questions.</p>
              {form.knockoutQuestions.filter((q) => q.trim()).length !== 3 && (
                <span className="field-hint error-hint">You have {form.knockoutQuestions.filter((q) => q.trim()).length} of 3 questions.</span>
              )}
            </>
          )}
          {current.key === "details" && (
            <>
              <div className="settings-fields">
                <label className="field-label">Location</label>
                <input
                  autoFocus
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  placeholder="e.g. Bangalore, India / Remote"
                  required
                />
                <label className="field-label">Role description / team objective</label>
                <textarea
                  autoFocus
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  rows="4"
                  placeholder="One-sentence team objective and what the role owns."
                  required
                />
                <div className="settings-fields">
                  <label className="field-label">Min experience (years)</label>
                  <input type="number" min="0" value={form.minExperience} onChange={(e) => update("minExperience", e.target.value)} />
                  <label className="field-label">Max experience (years)</label>
                  <input type="number" min="0" value={form.maxExperience} onChange={(e) => update("maxExperience", e.target.value)} />
                </div>
              </div>
            </>
          )}

          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <div className="step-actions">
            {step > 0 && (
              <Button className="button-secondary" onClick={() => setStep(step - 1)} disabled={busy}>
                <ArrowLeft size={16} /> Back
              </Button>
            )}
            <Button className="button-primary" onClick={(e) => { e.preventDefault(); handleSubmit(e); }} disabled={busy || !canAdvance()}>
              {busy ? "Creating role…" : step === steps.length - 1 ? "Publish role" : "Continue"} <ArrowRight size={17} />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
