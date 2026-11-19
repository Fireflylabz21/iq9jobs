import { useState, useEffect } from "react";
import { ArrowLeft, Check, Star, ArrowUp, ShieldCheck, MapPin, Clock } from "lucide-react";
import { useRole } from "../context/RoleContext.jsx";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../backend.js";

const ACTION_SHORTLIST = "shortlist";
const ACTION_DECLINE = "decline";
const ACTION_SAVE = "save";

const DECLINE_REASONS = [
  "Notice period mismatch",
  "Compensation expectation out of range",
  "Selected candidate with closer tech stack fit",
  "Other",
];

export default function CandidateReviewQueue({ onBack }) {
  const { user } = useRole();
  const [candidates, setCandidates] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionShowing, setActionShowing] = useState(null); // null | 'shortlist'|'decline'|'save'
  const [declineReason, setDeclineReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !db) return;
    setLoading(true);
    const q = query(
      collection(db, "users"),
      where("role", "==", "seeker"),
    );
    getDocs(q).then((snap) => {
      const list = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: data.uid,
            email: data.email,
            displayName: data.displayName || "",
            seekerProfile: data.seekerProfile || {},
            agentDetails: data.agentDetails || {},
          };
        })
        .filter((c) => c.seekerProfile && Object.keys(c.seekerProfile).length > 0);
      setCandidates(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, db]);

  const current = candidates[index];
  const hasMore = index < candidates.length;

  const recordAction = async (action, reason = "") => {
    if (!current) return;
    setBusy(true);
    try {
      const reviewId = crypto.randomUUID();
      await setDoc(doc(db, "candidate_reviews", reviewId), {
        id: reviewId,
        recruiterId: user.uid,
        recruiterEmail: user.email || "",
        candidateId: current.id,
        candidateEmail: current.email || "",
        action,
        reason,
        status: action === ACTION_SHORTLIST ? "SHORTLISTED" : action === ACTION_DECLINE ? "DECLINED" : "SAVED",
        createdAt: serverTimestamp(),
      });
      // Move to next candidate
      setIndex((prev) => prev + 1);
      setActionShowing(null);
      setDeclineReason("");
    } catch (err) {
      setError(err.message || "Could not record review action.");
    } finally {
      setBusy(false);
    }
  };

  if (!hasMore) {
    return (
      <div className="recruiter-page">
        <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to dashboard</button>
        <div className="recruiter-card">
          <div className="empty-state">
            <div className="empty-icon"><Check size={25} /></div>
            <h2>Review queue complete</h2>
            <p>You have reviewed all available candidate profiles.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="recruiter-page">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to dashboard</button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CANDIDATE REVIEW QUEUE</div>
          <h1>Review candidates</h1>
          <p>Swipe Right: Shortlist · Swipe Left: Decline with Reason · Swipe Up: Save to Talent Pool</p>
        </div>
        <span className="nav-count">{index + 1} of {candidates.length}</span>
      </div>

      {loading ? (
        <div className="jobs-loading"><div className="loading-spinner" /> Loading candidates…</div>
      ) : (
        <div className="recruiter-card review-card">
          <article className="job-card review-candidate-card">
            <div className="company-heading">
              <div className="company-name">{current.agentDetails.fullName || current.seekerProfile.targetTitle || "Candidate"}</div>
              <div className="company-location">{current.seekerProfile.expectedLocation || "Location not specified"}</div>
            </div>
            <h3>{current.seekerProfile.targetTitle || "Untitled profile"}</h3>
            <div className="salary-line"><span>Notice: {current.seekerProfile.noticePeriod}</span></div>
            <div className="skill-list">
              {(current.seekerProfile.topSkills || []).map((s) => <span key={s} className="skill-tag">{s}</span>)}
            </div>
            <div className="review-actions">
              <button className="button button-secondary" onClick={() => setActionShowing(ACTION_DECLINE)} disabled={busy}>
                <X size={16} /> Decline with Reason
              </button>
              <button className="button button-primary" onClick={() => recordAction(ACTION_SHORTLIST)} disabled={busy}>
                <Check size={16} /> Shortlist
              </button>
              <button className="button button-secondary" onClick={() => recordAction(ACTION_SAVE)} disabled={busy}>
                <Star size={16} /> Save to Talent Pool
              </button>
            </div>
          </article>
        </div>
      )}

      {actionShowing === ACTION_DECLINE && (
        <div className="modal-backdrop" onClick={() => setActionShowing(null)}>
          <div className="details-modal">
            <div className="modal-top">
              <span className="eyebrow">DECLINE REASON</span>
              <button className="icon-button" onClick={() => setActionShowing(null)}><X size={19} /></button>
            </div>
            <p>Select a standardized reason for declining this candidate.</p>
            <div className="settings-fields">
              {DECLINE_REASONS.map((r) => (
                <label key={r} className="field-label">
                  {r}
                  <input
                    type="radio"
                    name="declineReason"
                    value={r}
                    checked={declineReason === r}
                    onChange={(e) => setDeclineReason(e.target.value)}
                  />
                </label>
              ))}
            </div>
            <div className="settings-actions">
              <button className="button button-secondary" onClick={() => setActionShowing(null)}>Cancel</button>
              <button className="button button-primary" onClick={() => recordAction(ACTION_DECLINE, declineReason)} disabled={busy || !declineReason}>
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
);
