import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Sparkles, ShieldCheck, UserRound, Paperclip } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db, supabase } from "../backend.js";
import { ResumeParser } from "../ats/ResumeParser.jsx";

export default function OnboardingPage({ user, busy, error, onSubmit, hideSidebar }) {
  const [step, setStep] = useState(0);
  const [review, setReview] = useState(false);
  const [form, setForm] = useState({
    fullName: user.displayName || "",
    email: user.email || "",
    phoneNumber: "",
    primarySkillsets: "",
    targetRole: "",
    yearsExperience: "",
    currentCompany: "",
    currentLocation: "",
    expectedLocation: "",
    noticePeriod: "IMMEDIATE",
    currentCTC: "",
    expectedCTC: "",
    relocationReadiness: "open",
    remoteHybridPreference: "remote",
    resumePath: null,
    parsedResumeText: "",
    rawSkills: [],
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeParsed, setResumeParsed] = useState(null);
  const [resumeUploading, setResumeUploading] = useState(false);

  const steps = [
    { key: "fullName", label: "What should we call you?", hint: "Your full name", type: "text" },
    { key: "email", label: "What's your email?", hint: "Work or personal email", type: "email" },
    { key: "phoneNumber", label: "How can we reach you?", hint: "Phone number", type: "tel" },
    { key: "targetRole", label: "What role are you looking for?", hint: "For example: Frontend Engineer", type: "text" },
    { key: "primarySkillsets", label: "What are your strongest skills?", hint: "For example: React, TypeScript, UX research", type: "text" },
    { key: "yearsExperience", label: "How many years of experience?", hint: "Years of experience", type: "number" },
    { key: "currentCompany", label: "Where do you work today?", hint: "Current company", type: "text" },
    { key: "currentLocation", label: "Where are you based?", hint: "Current city", type: "text" },
    { key: "expectedLocation", label: "Where would you like to work?", hint: "Preferred city or Remote", type: "text" },
    { key: "noticePeriod", label: "What's your notice period?", hint: "When can you join?", type: "select" },
    { key: "currentCTC", label: "Current CTC (LPA)", hint: "Current annual compensation", type: "number" },
    { key: "expectedCTC", label: "Expected CTC (LPA)", hint: "Expected annual compensation", type: "number" },
    { key: "relocationReadiness", label: "Are you open to relocate?", hint: "Relocation readiness", type: "select" },
    { key: "remoteHybridPreference", label: "Work preference", hint: "Remote / Hybrid / Onsite", type: "select" },
  ];
  const resumeStepIndex = 0;
  const totalDataSteps = steps.length;
  const noticeOptions = [
    ["IMMEDIATE", "Immediate"],
    ["LESS_THAN_15_DAYS", "< 15 days"],
    ["THIRTY_DAYS", "30 days"],
    ["SIXTY_PLUS_DAYS", "60+ days"],
  ];
  const relocationOptions = [
    ["open", "Open to relocate"],
    ["prefer-not", "Prefer not to relocate"],
    ["negotiable", "Negotiable"],
  ];
  const workModeOptions = [
    ["remote", "Remote"],
    ["hybrid", "Hybrid"],
    ["onsite", "Onsite"],
  ];
  const current = steps[step];
  const isResumeStep = step === resumeStepIndex;
  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const noticeLabel = (value) => noticeOptions.find(([key]) => key === value)?.[1] || value;
  const relocationLabel = (value) => relocationOptions.find(([key]) => key === value)?.[1] || value;
  const workModeLabel = (value) => workModeOptions.find(([key]) => key === value)?.[1] || value;

  useEffect(() => {
    if (resumeParsed && resumeParsed.contact) {
      const { contact } = resumeParsed;
      setForm((prev) => ({
        ...prev,
        fullName: prev.fullName || contact.fullName || "",
        email: prev.email || contact.email || "",
        phoneNumber: prev.phoneNumber || contact.phone || "",
      }));
    }
  }, [resumeParsed]);

  const handleResumeParsed = (parsed) => {
    setResumeParsed(parsed);
    setForm((prev) => ({
      ...prev,
      parsedResumeText: parsed.rawText,
      rawSkills: parsed.skills,
      primarySkillsets: prev.primarySkillsets || parsed.skills.slice(0, 6).join(", "),
      fullName: prev.fullName || parsed.contact.fullName || "",
      email: prev.email || parsed.contact.email || "",
      phoneNumber: prev.phoneNumber || parsed.contact.phone || "",
    }));
  };

  const handleResumeFileChange = (file) => {
    setResumeFile(file);
    if (!file) {
      setResumeParsed(null);
      setForm((prev) => ({ ...prev, parsedResumeText: "", rawSkills: [] }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    let uploadError = null;
    if (resumeFile && supabase) {
      setResumeUploading(true);
      try {
        const fileName = `resumes/${user.uid}/${Date.now()}_${resumeFile.name}`;
        const { error: err } = await supabase.storage.from("resumes").upload(fileName, resumeFile);
        if (err) throw err;
        setForm((prev) => ({ ...prev, resumePath: fileName }));
      } catch (err) {
        uploadError = err.message || "Resume upload failed";
      } finally {
        setResumeUploading(false);
      }
    }

    if (uploadError) {
      setError(uploadError);
      return;
    }

    onSubmit(form);
  };

  return (
    <div className={`onboarding-page ${hideSidebar ? "onboarding-full" : ""}`}>
      <header className="onboarding-top">
        <div className="brand-mark">Devait<span>Jobs</span></div>
        <span>PROFILE SETUP</span>
      </header>
      <div className="onboarding-card">
        <div className="onboarding-progress">
          <div className="progress-copy"><span>YOUR CANDIDATE PROFILE</span><span>{review ? "Review" : `${step + 1} of ${totalDataSteps + 1}`}</span></div>
          <div className="progress-track"><span style={{ width: `${review ? 100 : ((step + 1) / (totalDataSteps + 1)) * 100}%` }} /></div>
        </div>

        {review ? (
          <form onSubmit={handleSubmit}>
            <div className="onboarding-eyebrow"><Sparkles size={15} /> PROFILE SUMMARY</div>
            <h1>Looking good, {form.fullName.split(" ")[0] || "there"}.</h1>
            <p className="muted-copy">Review your details before we create your profile.</p>
            <div className="review-grid">
              {[
                ["Full name", form.fullName],
                ["Email", form.email],
                ["Phone", form.phoneNumber],
                ["Target role", form.targetRole],
                ["Skills", form.primarySkillsets],
                ["Experience", `${form.yearsExperience} years`],
                ["Current company", form.currentCompany],
                ["Current location", form.currentLocation],
                ["Preferred location", form.expectedLocation],
                ["Notice period", noticeLabel(form.noticePeriod)],
                ["Current CTC", form.currentCTC ? `₹${form.currentCTC} LPA` : "Not provided"],
                ["Expected CTC", form.expectedCTC ? `₹${form.expectedCTC} LPA` : "Not provided"],
                ["Relocation", relocationLabel(form.relocationReadiness)],
                ["Work preference", workModeLabel(form.remoteHybridPreference)],
                ["Resume", form.resumePath || resumeParsed ? "Uploaded & parsed" : "Not uploaded"],
              ].map(([label, value]) => (
                <div className="review-item" key={label}><span>{label}</span><strong>{value || "Not provided"}</strong></div>
              ))}
              {resumeParsed && (
                <div className="review-item"><span>Parsed skills</span><strong>{resumeParsed.skills.join(", ") || "None detected"}</strong></div>
              )}
            </div>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <div className="onboarding-actions">
              <button type="button" className="button button-secondary" onClick={() => setReview(false)} disabled={busy || resumeUploading}><ArrowLeft size={16} /> Edit details</button>
              <button className="button button-primary" disabled={busy || resumeUploading}>{busy || resumeUploading ? "Saving profile…" : "Confirm & continue"} <ArrowRight size={17} /></button>
            </div>
          </form>
        ) : isResumeStep ? (
          <div className="onboarding-field resume-first">
            <div className="onboarding-eyebrow"><Paperclip size={18} /> STEP 1 — RESUME UPLOAD</div>
            <h1>Upload your resume first</h1>
            <p className="muted-copy">We’ll extract your name, contact, skills, and experience automatically — saving you time on the rest of the form.</p>
            <div className="resume-upload-step">
              <ResumeParser
                onParsed={handleResumeParsed}
                jobSkills={form.primarySkillsets ? form.primarySkillsets.split(",").map((s) => s.trim()).filter(Boolean) : []}
                className="resume-parser-inline"
              />
              {resumeFile && (
                <div className="file-selected">
                  <Paperclip size={16} /> {resumeFile.name} ({Math.round(resumeFile.size / 1024)} KB)
                </div>
              )}
              {resumeUploading && <span className="parsing">Uploading resume…</span>}
            </div>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <div className="onboarding-actions">
              <button className="button button-primary" disabled={busy || resumeUploading}>{resumeParsed ? "Continue to details" : "Upload a resume to continue"} <ArrowRight size={17} /></button>
              <button type="button" className="button button-secondary" onClick={() => setStep(resumeStepIndex + 1)} style={{ marginLeft: 10, background: "transparent", color: "#8da0ba", border: "1px solid #2b3952" }}>Skip resume</button>
            </div>
            <div className="onboarding-footnote"><ShieldCheck size={15} /> Your resume is stored privately and only shared with recruiters you apply to.</div>
          </div>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); if (step < steps.length - 1) setStep(step + 1); else setReview(true); }}>
            <div className="onboarding-eyebrow"><span className="agent-dot">Devait</span> YOUR DEVAIT AGENT</div>
            <h1>{step === resumeStepIndex + 1 ? `Hi${form.fullName ? `, ${form.fullName.split(" ")[0]}` : ""}. Let's complete your profile.` : current.label}</h1>
            <p className="muted-copy">{step === resumeStepIndex + 1 ? "A few details help us find opportunities that fit." : current.label}</p>
            <div className="onboarding-field">
              <label className="field-label" htmlFor={`onboarding-${current.key}`}>{current.hint}</label>
              {current.key === "yearsExperience" ? (
                <input autoFocus id={`onboarding-${current.key}`} type={current.type} min="0" max="60" value={form[current.key]} onChange={(event) => update(current.key, event.target.value)} />
              ) : current.key === "noticePeriod" ? (
                <select id="notice-period" value={form.noticePeriod} onChange={(event) => update("noticePeriod", event.target.value)}>
                  {noticeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              ) : current.key === "relocationReadiness" ? (
                <select id="relocation-readiness" value={form.relocationReadiness} onChange={(event) => update("relocationReadiness", event.target.value)}>
                  {relocationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              ) : current.key === "remoteHybridPreference" ? (
                <select id="work-preference" value={form.remoteHybridPreference} onChange={(event) => update("remoteHybridPreference", event.target.value)}>
                  {workModeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              ) : (
                <input autoFocus id={`onboarding-${current.key}`} type={current.type} value={form[current.key]} onChange={(event) => update(current.key, event.target.value)} />
              )}
              {current.key === "primarySkillsets" && <span className="field-hint">Separate skills with commas. Parsed from your resume if uploaded.</span>}
            </div>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <div className="onboarding-actions">
              {step > resumeStepIndex && <button type="button" className="button button-secondary" onClick={() => setStep(step - 1)} disabled={busy}><ArrowLeft size={16} /> Back</button>}
              <button className="button button-primary" disabled={busy}>{step === steps.length - 1 ? "Review profile" : "Continue"} <ArrowRight size={17} /></button>
            </div>
            <div className="onboarding-footnote"><ShieldCheck size={15} /> Your information is private and securely stored.</div>
          </form>
        )}
      </div>
    </div>
  );
}
