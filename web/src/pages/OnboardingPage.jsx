import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Sparkles, ShieldCheck, UserRound } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db, supabase } from "../backend.js";

export default function OnboardingPage({ user, busy, error, onSubmit }) {
  const [step, setStep] = useState(0);
  const [review, setReview] = useState(false);
  const [form, setForm] = useState({
    fullName: user.displayName || "",
    phoneNumber: "",
    primarySkillsets: "",
    targetRole: "",
    yearsExperience: "",
    currentCompany: "",
    currentLocation: "",
    expectedLocation: "",
    noticePeriod: "IMMEDIATE",
  });
  const steps = [
    { key: "fullName", label: "What should we call you?", hint: "Your full name", type: "text" },
    { key: "phoneNumber", label: "How can we reach you?", hint: "Phone number", type: "tel" },
    { key: "primarySkillsets", label: "What are your strongest skills?", hint: "For example: React, TypeScript, UX research", type: "text" },
    { key: "targetRole", label: "What role are you looking for?", hint: "For example: Frontend Engineer", type: "text" },
    { key: "yearsExperience", label: "How many years of experience?", hint: "Years of experience", type: "number" },
    { key: "currentCompany", label: "Where do you work today?", hint: "Current company", type: "text" },
    { key: "currentLocation", label: "Where are you based?", hint: "Current city", type: "text" },
    { key: "expectedLocation", label: "Where would you like to work?", hint: "Preferred city or Remote", type: "text" },
  ];
  const noticeOptions = [
    ["IMMEDIATE", "Immediate"],
    ["LESS_THAN_15_DAYS", "< 15 days"],
    ["THIRTY_DAYS", "30 days"],
    ["SIXTY_PLUS_DAYS", "60+ days"],
  ];
  const current = steps[step];
  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const noticeLabel = (value) => noticeOptions.find(([key]) => key === value)?.[1] || value;

  return (
    <div className="onboarding-page">
      <header className="onboarding-top">
        <div className="brand-mark">iq<span>9</span></div>
        <span>PROFILE SETUP</span>
      </header>
      <div className="onboarding-card">
        <div className="onboarding-progress">
          <div className="progress-copy"><span>YOUR CANDIDATE PROFILE</span><span>{review ? "Review" : `${step + 1} of ${steps.length + 1}`}</span></div>
          <div className="progress-track"><span style={{ width: `${review ? 100 : ((step + 1) / (steps.length + 1)) * 100}%` }} /></div>
        </div>
        {review ? (
          <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
            <div className="onboarding-eyebrow"><Sparkles size={15} /> PROFILE SUMMARY</div>
            <h1>Looking good, {form.fullName.split(" ")[0] || "there"}.</h1>
            <p className="muted-copy">Review your details before we create your profile.</p>
            <div className="review-grid">
              {[
                ["Full name", form.fullName],
                ["Email", user.email],
                ["Phone", form.phoneNumber],
                ["Skills", form.primarySkillsets],
                ["Target role", form.targetRole],
                ["Experience", `${form.yearsExperience} years`],
                ["Current company", form.currentCompany],
                ["Current location", form.currentLocation],
                ["Preferred location", form.expectedLocation],
                ["Notice period", noticeLabel(form.noticePeriod)],
              ].map(([label, value]) => (
                <div className="review-item" key={label}><span>{label}</span><strong>{value || "Not provided"}</strong></div>
              ))}
            </div>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <div className="onboarding-actions">
              <button type="button" className="button button-secondary" onClick={() => setReview(false)} disabled={busy}><ArrowLeft size={16} /> Edit details</button>
              <button className="button button-primary" disabled={busy}>{busy ? "Saving profile…" : "Confirm & continue"} <ArrowRight size={17} /></button>
            </div>
          </form>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); if (step < steps.length - 1) setStep(step + 1); else setReview(true); }}>
            <div className="onboarding-eyebrow"><span className="agent-dot">iq</span> YOUR IQ9 AGENT</div>
            <h1>{step === 0 ? `Hi${form.fullName ? `, ${form.fullName.split(" ")[0]}` : ""}. Let's get to know you.` : current.label}</h1>
            <p className="muted-copy">{step === 0 ? current.label : "A few details help us find opportunities that fit."}</p>
            <div className="onboarding-field">
              <label className="field-label" htmlFor={`onboarding-${current.key}`}>{current.hint}</label>
              {current.key === "yearsExperience" ? (
                <input autoFocus id={`onboarding-${current.key}`} type={current.type} min="0" max="60" value={form[current.key]} onChange={(event) => update(current.key, event.target.value)} required />
              ) : (
                <input autoFocus id={`onboarding-${current.key}`} type={current.type} value={form[current.key]} onChange={(event) => update(current.key, event.target.value)} required />
              )}
              {current.key === "primarySkillsets" && <span className="field-hint">Separate skills with commas. You can list up to 6.</span>}
            </div>
            {step === steps.length - 1 && (
              <div className="onboarding-field">
                <label className="field-label" htmlFor="notice-period">Notice period</label>
                <select id="notice-period" value={form.noticePeriod} onChange={(event) => update("noticePeriod", event.target.value)}>
                  {noticeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            )}
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <div className="onboarding-actions">
              {step > 0 && <button type="button" className="button button-secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button>}
              <button className="button button-primary" disabled={busy}>{step === steps.length - 1 ? "Review profile" : "Continue"} <ArrowRight size={17} /></button>
            </div>
            <div className="onboarding-footnote"><ShieldCheck size={15} /> Your information is private and securely stored.</div>
          </form>
        )}
      </div>
    </div>
  );
}
