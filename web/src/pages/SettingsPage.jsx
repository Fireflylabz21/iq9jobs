import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Info, LockKeyhole, LogOut, UserRound } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "../backend.js";
import { sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";

export default function SettingsPage({ user, profile, busy, onSave }) {
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState("");
  const [targetTitle, setTargetTitle] = useState(profile.targetTitle || "");
  const [skills, setSkills] = useState((profile.topSkills || []).join(", "));
  const [location, setLocation] = useState(profile.expectedLocation || "");
  const [salaryFloor, setSalaryFloor] = useState(profile.salaryFloor || "");
  const [noticePeriod, setNoticePeriod] = useState(profile.noticePeriod || "IMMEDIATE");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [showAbout, setShowAbout] = useState(false);

  const noticeOptions = [
    ["IMMEDIATE", "Immediate"],
    ["LESS_THAN_15_DAYS", "< 15 days"],
    ["THIRTY_DAYS", "30 days"],
    ["SIXTY_PLUS_DAYS", "60+ days"],
  ];

  useEffect(() => {
    setTargetTitle(profile.targetTitle || "");
    setSkills((profile.topSkills || []).join(", "));
    setLocation(profile.expectedLocation || "");
    setSalaryFloor(profile.salaryFloor || "");
    setNoticePeriod(profile.noticePeriod || "IMMEDIATE");
  }, [profile]);

  const saveProfile = (event) => {
    event.preventDefault();
    const topSkills = skills.split(",").map((skill) => skill.trim()).filter(Boolean);
    if (topSkills.length > 6) {
      setFormError("Enter no more than 6 skills.");
      return;
    }
    setFormError("");
    onSave({
      ...profile,
      targetTitle,
      topSkills,
      expectedLocation: location,
      salaryFloor: Number(salaryFloor) || 0,
      noticePeriod,
    });
    setEditing(false);
  };

  const handleSignOut = async () => {
    // handled by parent in App
  };

  const handleChangePassword = async (currentPassword, nextPassword) => {
    if (user.providerData.every((item) => item.providerId !== "password")) {
      throw new Error("This account uses Google sign-in. Use password reset instead.");
    }
    if (!user.email || !currentPassword || nextPassword.length < 6) {
      throw new Error("Enter your current password and a new password of at least 6 characters.");
    }
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, nextPassword);
  };

  const handlePasswordReset = async () => {
    if (!user.email) throw new Error("No email is associated with this account.");
    await sendPasswordResetEmail(auth, user.email);
  };

  return (
    <div className="settings-page">
      {showAbout ? (
        <AboutPage onBack={() => setShowAbout(false)} />
      ) : (
        <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">ACCOUNT & PREFERENCES</div>
              <h1>Your settings</h1>
              <p>Keep your profile and preferences up to date.</p>
            </div>
          </div>
          <section className="settings-profile-card">
            <div className="settings-profile-avatar">{(user.displayName || user.email || "U")[0].toUpperCase()}</div>
            <div className="settings-profile-copy">
              <div className="section-label">SIGNED IN AS</div>
              <h2>{user.displayName || "Candidate"}</h2>
              <p>{user.email}</p>
            </div>
            <button className="button button-secondary" onClick={() => setEditing(!editing)}><UserRound size={16} /> Edit profile</button>
          </section>
          {editing && (
            <form className="settings-card settings-form" onSubmit={saveProfile}>
              <div className="settings-card-heading"><h2>Candidate preferences</h2><p>Your details help personalize the roles you see.</p></div>
              <div className="settings-fields">
                <label className="field-label">Target role
                  <input type="text" value={targetTitle} onChange={(e) => setTargetTitle(e.target.value)} required />
                </label>
                <label className="field-label">Skills (comma separated, up to 6)
                  <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} />
                </label>
                <label className="field-label">Preferred location
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
                </label>
                <label className="field-label">Minimum salary (₹)
                  <input type="number" min="0" value={salaryFloor} onChange={(e) => setSalaryFloor(e.target.value)} />
                </label>
                <label className="field-label">Notice period
                  <select value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)}>
                    {noticeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </div>
              {formError && <div className="alert alert-error" role="alert">{formError}</div>}
              <div className="settings-actions">
                <button type="button" className="button button-secondary" onClick={() => setEditing(false)}>Cancel</button>
                <button className="button button-primary" disabled={busy}><Check size={16} /> Save changes</button>
              </div>
            </form>
          )}
          <section className="settings-card">
            <div className="settings-card-heading"><div className="settings-heading-icon"><LockKeyhole size={18} /></div><div><h2>Password & security</h2><p>Update your password or request a reset link.</p></div></div>
            <form className="password-form" onSubmit={(event) => {
              event.preventDefault();
              handleChangePassword(currentPassword, nextPassword).then(() => {
                setCurrentPassword("");
                setNextPassword("");
              }).catch((err) => { setFormError(err.message || "Could not update password."); });
            }}>
              <label className="field-label">Current password
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
              </label>
              <label className="field-label">New password
                <input type="password" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} minLength="6" autoComplete="new-password" />
              </label>
              <button className="button button-secondary" disabled={busy || !currentPassword || nextPassword.length < 6}>Update password</button>
            </form>
            <button className="text-button reset-link" onClick={() => { handlePasswordReset().then(() => alert(`Password reset email sent to ${user.email}.`)).catch((err) => setFormError(err.message || "Could not send reset email.")); }} disabled={busy}>Send password reset email</button>
          </section>
          <section className="settings-link-grid">
            <button className="settings-link-card" onClick={() => setShowAbout(true)}><span className="settings-heading-icon"><Info size={18} /></span><span><strong>About iq9 Jobs</strong><small>Our approach to better hiring</small></span><ArrowRight size={17} /></button>
            <button className="settings-link-card" onClick={() => {}} disabled={busy}><span className="settings-heading-icon settings-icon-red"><LogOut size={18} /></span><span><strong>Sign out</strong><small>Sign out from this device</small></span><ArrowRight size={17} /></button>
          </section>
        </>
      )}
    </div>
  );
}

function AboutPage({ onBack }) {
  return (
    <div className="about-page">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to settings</button>
      <div className="about-hero"><div className="about-mark">iq<span>9</span></div><div className="eyebrow">ABOUT IQ9 JOBS</div><h1>A clearer path to<br /><span>work that fits.</span></h1><p>We believe finding your next role should feel focused, transparent, and human.</p></div>
      <div className="about-values">
        <div><span className="value-icon"><UserRound size={18} /></span><strong>Clarity first</strong><p>Know what the role asks for before you apply.</p></div>
        <div><span className="value-icon"><ShieldCheck size={18} /></span><strong>People matter</strong><p>We make room for a better connection between people and teams.</p></div>
        <div><span className="value-icon"><Sparkles size={18} /></span><strong>Less noise</strong><p>Spend your attention on the opportunities that matter.</p></div>
      </div>
      <div className="about-note">iq9 Jobs · Find your next move.</div>
    </div>
  );
}
