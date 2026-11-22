import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updatePassword,
  EmailAuthProvider,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Eye,
  EyeOff,
  Heart,
  Info,
  LockKeyhole,
  LogOut,
  MapPin,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  auth,
  db,
  firebaseConfigured,
  googleProvider,
  supabase,
  supabaseConfigured,
} from "./backend.js";
import { RoleProvider, useRole, ROLES } from "./context/RoleContext.jsx";
import OnboardingPage from "./pages/OnboardingPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import RecruiterDashboard from "./pages/RecruiterDashboard.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";
import JobBuilder from "./pages/JobBuilder.jsx";
import CandidateReviewQueue from "./pages/CandidateReviewQueue.jsx";
import ChatPage from "./pages/ChatPage.jsx";

const emptyProfile = {
  targetTitle: "",
  salaryFloor: "",
  noticePeriod: "IMMEDIATE",
  topSkills: [],
  highlights: [],
  expectedLocation: "",
};

const noticeOptions = [
  ["IMMEDIATE", "Immediate"],
  ["LESS_THAN_15_DAYS", "< 15 days"],
  ["THIRTY_DAYS", "30 days"],
  ["SIXTY_PLUS_DAYS", "60+ days"],
];

function readList(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function saveList(name, value, user) {
  const next = [...new Set(value)];
  const key = `devait:${user.uid}:${name}`;
  localStorage.setItem(key, JSON.stringify(next));
  return next;
}

function moneyRange(job) {
  if (!job.compensation) return "Compensation not listed";
  return job.compensation;
}

function experienceRange(job) {
  if (job.experience != null && job.experience > 0) {
    return `${job.experience} years`;
  }
  return null;
}

function deriveRegion(location) {
  if (!location) return "";
  const parts = location.split(/[,/]/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts[0] : location;
}

function normalizeJob(row) {
  const isSupabaseSchema = Boolean(row.title && !row.jobtitle);
  const skillsets = isSupabaseSchema
    ? (Array.isArray(row.required_skills) ? row.required_skills : [])
    : (row.skillsets || "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    id: isSupabaseSchema ? row.id : (row.jobid || row.id),
    title: isSupabaseSchema ? row.title : (row.jobtitle || "Untitled role"),
    companyName: row.company || "Company",
    location: row.location || "",
    region: row.region || deriveRegion(row.location) || "",
    experience: isSupabaseSchema ? (row.min_experience != null ? Number(row.min_experience) : 0) : (row.experience != null ? Number(row.experience) : 0),
    maxExperience: isSupabaseSchema ? (row.max_experience != null ? Number(row.max_experience) : 0) : 0,
    coreSkills: skillsets,
    teamObjective: isSupabaseSchema ? (row.description_text || "") : (row.jobdesc || ""),
    postedAt: isSupabaseSchema ? (row.posted_at || "") : (row.jobposted || ""),
    compensation: isSupabaseSchema ? (row.salary_min || row.salary_max ? `₹${row.salary_min || 0} – ₹${row.salary_max || 0}` : "") : (row.compensation || ""),
    isAvailable: isSupabaseSchema ? (row.is_active !== false) : (row.isavailable !== false),
    applyUrl: row.apply_url || "",
    workMode: isSupabaseSchema ? (row.work_style || "Unspecified") : "Unspecified",
    external: isSupabaseSchema,
  };
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function sameLocation(a, b) {
  if (!a || !b) return false;
  const norm = (s) => s.toLowerCase().trim();
  return norm(a) === norm(b);
}

function skillsOverlap(jobSkills, profileSkills) {
  if (!profileSkills || profileSkills.length === 0) return true;
  const jobSet = new Set((jobSkills || []).map((s) => s.toLowerCase().trim()));
  return profileSkills.some((s) => jobSet.has(s.toLowerCase().trim()));
}

function titleMatches(jobTitle, targetTitle) {
  if (!targetTitle) return true;
  return jobTitle.toLowerCase().includes(targetTitle.toLowerCase());
}

function screenTitle(screen) {
  if (screen === "saved") return "Saved jobs";
  if (screen === "applied") return "Applied jobs";
  if (screen === "settings") return "Settings";
  if (screen === "about") return "About us";
  if (screen === "kanban") return "Application Kanban";
  return "Discover roles";
}

function noticeLabel(value) {
  return noticeOptions.find(([key]) => key === value)?.[1] || value;
}

// Shared UI primitives
function LoadingScreen({ label }) {
  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <span>{label}</span>
    </div>
  );
}

function Brand() {
  return (
    <a className="brand" href="#" aria-label="Devait Jobs home">
      <span className="brand-mark">Devait<span>Jobs</span></span>
      <span className="brand-name">jobs<span>.</span></span>
    </a>
  );
}

function Alert({ type, children }) {
  const classes = type === "error" ? "alert alert-error" : type === "success" ? "alert alert-success" : "alert alert-warning";
  const role = type === "error" ? "alert" : type === "success" ? "status" : "alert";
  return <div className={classes} role={role}>{children}</div>;
}

function Button({ children, className = "", onClick, disabled, type = "button", ...props }) {
  return (
    <button className={`button ${className}`} onClick={onClick} disabled={disabled} type={type} {...props}>
      {children}
    </button>
  );
}

function AuthScreen({ configured }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { signOut, setUserRole, role, user } = useRole();

  const finishAuth = async (credential) => {
    const currentUser = credential.user;
    const snapshot = await getDoc(doc(db, "users", currentUser.uid));
    const data = snapshot.exists() ? snapshot.data() : {};
    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        uid: currentUser.uid,
        email: currentUser.email || "",
        provider:
          currentUser.providerData.find((item) => item.providerId !== "firebase")
            ?.providerId || "password",
        lastSignInAt: serverTimestamp(),
        ...(!snapshot.exists()
          ? {
              createdAt: serverTimestamp(),
              displayName: currentUser.displayName || "",
            }
          : {}),
      },
      { merge: true },
    );
    setError("");
  };

  const handleSubmit = async (mode, email, password) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result =
        mode === "create"
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);
      await finishAuth(result);
    } catch (authError) {
      setError(authError.message || "Could not authenticate.");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      await finishAuth(await signInWithPopup(auth, googleProvider));
    } catch (authError) {
      setError(authError.message || "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (email) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sendPasswordResetEmail(auth, email);
      setNotice("Password reset email sent.");
    } catch (authError) {
      setError(authError.message || "Could not send a reset email.");
    } finally {
      setBusy(false);
    }
  };

  const onClear = () => { setError(""); setNotice(""); };

  return (
    <div className="auth-page">
      <div className="auth-decoration auth-decoration-one" />
      <div className="auth-decoration auth-decoration-two" />
      <div className="auth-layout">
        <section className="auth-story">
          <Brand />
          <div className="story-content">
            <div className="eyebrow"><Sparkles size={15} /> YOUR NEXT MOVE, MADE CLEAR</div>
            <h1>Better work.<br /><span>Less noise.</span></h1>
            <p>Discover opportunities built around the things that matter: meaningful work, clear expectations, and a team that fits.</p>
            <div className="story-proof">
              <div className="proof-icon"><ShieldCheck size={19} /></div>
              <div><strong>Signal over scroll</strong><span>Clear roles. Real details. Your next step.</span></div>
            </div>
          </div>
          <div className="story-footer">A more human way to find your next role.</div>
        </section>
        <section className="auth-form-wrap">
          <div className="auth-card">
            <div className="auth-card-heading">
              <span className="auth-badge"><UserRound size={17} /></span>
              <div className="eyebrow">CANDIDATE ACCESS</div>
              <h2>{mode === "create" ? "Create your account" : "Welcome back"}</h2>
              <p>{mode === "create" ? "Start building a more focused job search." : "Sign in to pick up where you left off."}</p>
            </div>
            {!configured && (
              <Alert type="warning">Firebase isn't configured. Copy <code>.env.example</code> to <code>.env.local</code> and add your web app settings.</Alert>
            )}
            {error && <Alert type="error">{error}</Alert>}
            {notice && <Alert type="success">{notice}</Alert>}
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                onClear();
                handleSubmit(mode, email.trim(), password);
              }}
            >
              <label className="field-label" htmlFor="auth-email">Email address</label>
              <div className="input-wrap">
                <UserRound size={17} />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="field-label-row">
                <label className="field-label" htmlFor="auth-password">Password</label>
                {mode === "signin" && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy || !email.trim()}
                    onClick={() => handleReset(email.trim())}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="input-wrap">
                <LockKeyhole size={17} />
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "create" ? "new-password" : "current-password"}
                  placeholder="At least 6 characters"
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  className="input-trailing"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <button className="button button-primary button-full" disabled={busy || !configured}>
                {busy ? "Please wait…" : mode === "create" ? "Create account" : "Sign in"}
                {!busy && <ArrowRight size={17} />}
              </button>
            </form>
            <div className="divider"><span>OR</span></div>
            <button
              className="button button-google button-full"
              disabled={busy || !configured}
              onClick={handleGoogle}
            >
              <span className="google-mark" aria-hidden="true">G</span> Continue with Google
            </button>
            <p className="auth-switch">
              {mode === "create" ? "Already have an account?" : "New to Devait Jobs?"}{" "}
              <button
                className="text-button"
                onClick={() => {
                  setMode(mode === "create" ? "signin" : "create");
                  onClear();
                }}
              >
                {mode === "create" ? "Sign in" : "Create account"}
              </button>
            </p>
            <div className="auth-privacy"><ShieldCheck size={14} /> Your profile stays yours. Always.</div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function RouterApp() {
  const { user, role, ready, isRecruiter, isAdmin, signOut } = useRole();

  if (!ready) {
    return <LoadingScreen label="Connecting to Devait Jobs" />;
  }

  if (!user) {
    return <AuthScreen configured={firebaseConfigured} />;
  }

  const uid = user.uid;
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [profile, setProfile] = useState(emptyProfile);
  const [savedIds, setSavedIds] = useState([]);
  const [skippedIds, setSkippedIds] = useState([]);
  const [appliedIds, setAppliedIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedJob, setSelectedJob] = useState(null);
  const [applyBrowserUrl, setApplyBrowserUrl] = useState(null);
  const [query, setQuery] = useState("");
  const [screen, setScreen] = useState("jobs");
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [matchSource, setMatchSource] = useState("none");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load seeker profile + onboarding status
  useEffect(() => {
    if (!user) {
      setProfile(emptyProfile);
      setOnboardingComplete(false);
      return;
    }
    (async () => {
      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        const data = snapshot.exists() ? snapshot.data() : {};
        setProfile({ ...emptyProfile, ...(data.seekerProfile || {}) });
        setOnboardingComplete(
          data.onboardingCompleted === true ||
            Boolean(data.agentDetails) ||
            Boolean(data.seekerProfile && Object.keys(data.seekerProfile || {}).length > 0),
        );
      } catch (loadError) {
        setError(loadError.message || "Could not load your profile.");
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSavedIds([]);
      setSkippedIds([]);
      setAppliedIds([]);
      return;
    }
    const prefix = `devait:${user.uid}:`;
    setSavedIds(readList(`${prefix}saved`));
    setSkippedIds(readList(`${prefix}skipped`));
    setAppliedIds(readList(`${prefix}applied`));
  }, [user]);

  useEffect(() => {
    if (!user || !supabase || role !== ROLES.SEEKER) {
      setJobs([]);
      setMatchSource("none");
      return;
    }
    let active = true;
    setLoadingJobs(true);
    const profileSkills = profile.topSkills || [];
    const targetTitle = profile.targetTitle || "";
    const expectedLocation = profile.expectedLocation || "";
    const hasProfilePrefs = profileSkills.length > 0 || Boolean(targetTitle) || Boolean(expectedLocation);

    if (!db && !supabase) {
      setJobs([]);
      setMatchSource("none");
      setLoadingJobs(false);
      return;
    }

    // Fetch jobs from Firestore (recruiter-posted)
    const fetchFirestoreJobs = async () => {
      if (!db) return [];
      try {
        const q = query(collection(db, "jobs"), where("isavailable", "==", true));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({
          ...normalizeJob({ id: d.id, ...d.data() }),
          source: "internal",
        }));
      } catch (e) {
        console.error("Firestore jobs fetch error:", e);
        return [];
      }
    };

    // Fetch jobs from Supabase (external jobs)
    const fetchSupabaseJobs = async () => {
      if (!supabase) return [];
      try {
        const { data, error } = await supabase
          .from("jobs")
          .select("id,title,company,location,region,work_style,min_experience,max_experience,required_skills,description_text,apply_url,posted_at")
          .eq("is_active", true)
          .order("posted_at", { ascending: false });
        if (error) throw error;
        return (data || []).map((row) => ({
          ...normalizeJob(row),
          source: "external",
          applyUrl: row.apply_url || "",
        }));
      } catch (e) {
        console.error("Supabase jobs fetch error:", e);
        return [];
      }
    };

    Promise.all([fetchFirestoreJobs(), fetchSupabaseJobs()]).then(([firestoreJobs, supabaseJobs]) => {
      if (!active) return;
      const allJobs = [...firestoreJobs, ...supabaseJobs];

      let matched = allJobs;
      let source = "all";

      if (hasProfilePrefs) {
        matched = allJobs.filter((job) => {
          const skillMatch = skillsOverlap(job.coreSkills, profileSkills);
          const titleMatch = titleMatches(job.title, targetTitle);
          const locationMatch = sameLocation(job.location, expectedLocation) || sameLocation(job.region, expectedLocation);
          return skillMatch || titleMatch || locationMatch;
        });
        source = "profile";
      }

      if (matched.length === 0 && expectedLocation) {
        matched = allJobs.filter(
          (job) =>
            sameLocation(job.location, expectedLocation) ||
            sameLocation(job.region, expectedLocation) ||
            sameLocation(job.region, deriveRegion(expectedLocation)),
        );
        source = "location";
      }

      if (matched.length === 0) {
        matched = allJobs;
        source = "all";
      }

      setJobs(matched);
      setMatchSource(source);
      setError("");
    }).catch((fetchError) => {
      if (active) setError(fetchError.message || "Could not load jobs.");
    }).finally(() => {
      if (active) setLoadingJobs(false);
    });
    return () => {
      active = false;
    };
  }, [user, profile.topSkills, profile.targetTitle, profile.expectedLocation, role]);

  const matchingJobs = useMemo(() => {
    if (!jobs.length) return 0;
    const profileSkills = profile.topSkills || [];
    const targetTitle = profile.targetTitle || "";
    const expectedLocation = profile.expectedLocation || "";
    const hasPrefs = profileSkills.length > 0 || Boolean(targetTitle) || Boolean(expectedLocation);
    if (!hasPrefs) return jobs.length;
    return jobs.filter((job) => {
      const skillMatch = skillsOverlap(job.coreSkills, profileSkills);
      const titleMatch = titleMatches(job.title, targetTitle);
      const locationMatch = sameLocation(job.location, expectedLocation) || sameLocation(job.region, expectedLocation);
      return skillMatch || titleMatch || locationMatch;
    }).length;
  }, [jobs, profile.topSkills, profile.targetTitle, profile.expectedLocation]);
  const visibleJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (screen === "saved" && !savedIds.includes(job.id)) return false;
      if (screen === "applied" && !appliedIds.includes(job.id)) return false;
      if (screen === "jobs" && skippedIds.includes(job.id)) return false;
      if (!normalizedQuery) return true;
      return [
        job.title,
        job.companyName,
        job.location,
        ...job.coreSkills,
      ].some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [jobs, query, screen, savedIds, skippedIds, appliedIds]);

  const recordApplication = async (job) => {
    const url = safeExternalUrl(job.applyUrl);
    if (!url) {
      setError("This application link is invalid or unavailable.");
      return;
    }

    // Enforce 50% skill match threshold before applying
    const profileSkills = (profile.topSkills || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean);
    const jobSkills = (job.coreSkills || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean);
    if (jobSkills.length > 0 && profileSkills.length > 0) {
      const matched = jobSkills.filter((js) => profileSkills.includes(js)).length;
      const matchPct = Math.round((matched / jobSkills.length) * 100);
      if (matchPct < 50) {
        setError(`You need at least 50% skill match to apply. Your match: ${matchPct}%.`);
        return;
      }
    } else if (jobSkills.length > 0 && profileSkills.length === 0) {
      setError("Please complete your profile with skills before applying.");
      return;
    }

    setApplyBrowserUrl(url);
    const next = saveList("applied", [...appliedIds, job.id], user);
    setAppliedIds(next);
    setNotice("Application opened in-app. Your activity is saved.");
    setError("");
    try {
      // Fetch user's Firestore profile to include full details in application
      let seekerProfile = {};
      let agentDetails = {};
      let displayName = user.displayName || "";
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const udata = userSnap.data();
          seekerProfile = udata.seekerProfile || {};
          agentDetails = udata.agentDetails || {};
          displayName = udata.displayName || user.displayName || "";
        }
      } catch (e) {
        // ignore profile fetch errors
      }
      const { error: insertError } = await supabase.from("applications").insert({
        id: crypto.randomUUID(),
        jobId: job.id,
        seekerId: user.uid,
        seekerEmail: user.email || "",
        seekerDisplayName: displayName || "",
        seekerProfile,
        agentDetails,
        status: "SUBMITTED",
        appliedAt: new Date().toISOString(),
      });
      if (insertError) throw insertError;
    } catch (insertError) {
      setError(
        `The application is saved, but activity could not be synced: ${insertError.message}`,
      );
    }
  };

  const skipJob = (job) => {
    const next = saveList("skipped", [...skippedIds, job.id], user);
    setSkippedIds(next);
    setSelectedJob(null);
  };

  const toggleSaved = (job) => {
    const next = savedIds.includes(job.id)
      ? savedIds.filter((id) => id !== job.id)
      : [...savedIds, job.id];
    const savedNext = saveList("saved", next, user);
    setSavedIds(savedNext);
  };

  const handleSignOut = async () => {
    setBusy(true);
    setError("");
    try {
      await fbSignOut(auth);
      setScreen("jobs");
      setNotice("");
    } catch (signOutError) {
      setError(signOutError.message || "Could not sign out.");
    } finally {
      setBusy(false);
    }
  };

  // Role-based routing — set default screen per role, then shared shell renders
  const defaultScreen = useMemo(() => {
    if (role === ROLES.ADMIN) return "admin";
    if (role === ROLES.RECRUITER) return "jobs";
    return "jobs";
  }, [role]);

  // Initialize screen to default on role change
  useEffect(() => {
    if (screen === "jobs" || screen === "admin") {
      setScreen(defaultScreen);
    }
  }, [role, defaultScreen]);

  // Role-based content rendering — each role only sees its own modules
  const roleContent = useMemo(() => {
    // Onboarding gate for seekers only
    if (role === ROLES.SEEKER && !onboardingComplete) {
      return (
        <OnboardingPage
          user={user}
          busy={busy}
          error={error}
          hideSidebar={!onboardingComplete}
          onSubmit={async (details) => {
            setBusy(true);
            setError("");
            try {
              if (!supabase) {
                throw new Error("Supabase is not configured. Add its web settings to .env.local.");
              }
              const skills = details.primarySkillsets
                .split(",")
                .map((skill) => skill.trim())
                .filter(Boolean);
              if (skills.length > 6) {
                throw new Error("Enter no more than 6 skills.");
              }
              const agentDetails = {
                ...details,
                email: user.email || "",
                yearsExperience: Number(details.yearsExperience),
              };
              const { error: subscriberError } = await supabase
                .from("subscribers")
                .insert({
                  full_name: agentDetails.fullName,
                  email: agentDetails.email,
                  phone_number: agentDetails.phoneNumber,
                  primary_skillsets: agentDetails.primarySkillsets,
                  secondary_skillsets: "",
                  years_experience: agentDetails.yearsExperience,
                  current_company: agentDetails.currentCompany,
                  current_ctc: "Not provided",
                  notice_period: agentDetails.noticePeriod,
                  current_location: agentDetails.currentLocation,
                  expected_location: agentDetails.expectedLocation,
                  status: "Active",
                });
              if (subscriberError) throw subscriberError;
              const seekerProfile = {
                ...emptyProfile,
                targetTitle: agentDetails.targetRole,
                noticePeriod: noticeOptions.some(([value]) => value === agentDetails.noticePeriod)
                  ? agentDetails.noticePeriod
                  : "IMMEDIATE",
                topSkills: skills.slice(0, 6),
                expectedLocation: agentDetails.expectedLocation,
                resumePath: details.resumePath || null,
                parsedResumeText: details.parsedResumeText || "",
                rawSkills: Array.isArray(details.rawSkills) ? details.rawSkills : [],
                currentCTC: details.currentCTC || null,
                expectedCTC: details.expectedCTC || null,
                relocationReadiness: details.relocationReadiness || "open",
                remoteHybridPreference: details.remoteHybridPreference || "remote",
              };
              await setDoc(
                doc(db, "users", user.uid),
                {
                  uid: user.uid,
                  email: user.email || "",
                  agentDetails,
                  seekerProfile,
                  onboardingCompleted: true,
                },
                { merge: true },
              );
              setProfile(seekerProfile);
              setOnboardingComplete(true);
              setNotice("Profile created. Welcome to Devait Jobs.");
            } catch (submitError) {
              setError(submitError.message || "Could not save your profile.");
            } finally {
              setBusy(false);
            }
          }}
        />
      );
    }
    if (role === ROLES.ADMIN) {
      if (screen === "admin") {
        return <AdminPanel user={user} onSignOut={handleSignOut} busy={busy} />;
      }
      return <SettingsPage user={user} profile={profile} busy={busy} onSave={async (nextProfile) => {
        setBusy(true);
        setError("");
        setNotice("");
        try {
          await setDoc(doc(db, "users", user.uid), { seekerProfile: nextProfile }, { merge: true });
          setProfile(nextProfile);
          setNotice("Profile updated.");
        } catch (saveError) {
          setError(saveError.message || "Could not update your profile.");
        } finally {
          setBusy(false);
        }
      }} />;
    }

    if (role === ROLES.RECRUITER) {
      return <RecruiterDashboard user={user} onSignOut={handleSignOut} busy={busy} initialTab={screen} />;
    }

    // Seeker path
    if (screen === "settings") {
      return <SettingsPage user={user} profile={profile} busy={busy} onSave={async (nextProfile) => {
        setBusy(true);
        setError("");
        setNotice("");
        try {
          await setDoc(doc(db, "users", user.uid), { seekerProfile: nextProfile }, { merge: true });
          setProfile(nextProfile);
          setNotice("Profile updated.");
        } catch (saveError) {
          setError(saveError.message || "Could not update your profile.");
        } finally {
          setBusy(false);
        }
      }} />;
    }
    if (screen === "about") return <AboutScreen />;
    if (screen === "kanban") return <ApplicationKanban appliedIds={appliedIds} jobs={jobs} />;
    return (
      <SeekerFeed
        screen={screen}
        jobs={visibleJobs}
        allJobs={jobs}
        loading={loadingJobs}
        query={query}
        onQueryChange={setQuery}
        savedIds={savedIds}
        appliedIds={appliedIds}
        onSave={toggleSaved}
        onSkip={skipJob}
        onApply={recordApplication}
        onDetails={setSelectedJob}
      />
    );
  }, [role, screen, user, profile, busy, onboardingComplete, jobs, visibleJobs, loadingJobs, query, savedIds, appliedIds, skippedIds, selectedJob]);

  return (
    <div className="app-shell">
        <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
          <Brand />
          <div className="sidebar-label">WORKSPACE</div>

          {/* Profile stats card */}
          <div className="sidebar-stats">
            <div className="sidebar-stat">
              <div className="sidebar-stat-label">Profile</div>
              <div className="sidebar-stat-value">{user.displayName || user.email || "Candidate"}</div>
            </div>
            <div className="sidebar-stat">
              <div className="sidebar-stat-label">Matching Jobs</div>
              <div className="sidebar-stat-value">{matchingJobs}</div>
            </div>
            <div className="sidebar-stat">
              <div className="sidebar-stat-label">Applied</div>
              <div className="sidebar-stat-value">{appliedIds.length}</div>
            </div>
            <div className="sidebar-stat">
              <div className="sidebar-stat-label">Saved</div>
              <div className="sidebar-stat-value">{savedIds.length}</div>
            </div>
          </div>

          <nav className="side-nav" aria-label="Main navigation">
            {role === ROLES.ADMIN && (
              <>
                <NavButton
                  active={screen === "admin"}
                  icon={<Users size={18} />}
                  onClick={() => {
                    setScreen("admin");
                    setMobileMenuOpen(false);
                  }}
                >
                  User Management
                </NavButton>
                <NavButton
                  active={screen === "settings" || screen === "about"}
                  icon={<Settings size={18} />}
                  onClick={() => {
                    setScreen("settings");
                    setMobileMenuOpen(false);
                  }}
                >
                  Settings
                </NavButton>
              </>
            )}
            {role === ROLES.RECRUITER && (
              <>
                <NavButton
                  active={screen === "jobs"}
                  icon={<BriefcaseBusiness size={18} />}
                  onClick={() => {
                    setScreen("jobs");
                    setMobileMenuOpen(false);
                  }}
                >
                  Jobs posted
                </NavButton>
                <NavButton
                  active={screen === "review"}
                  icon={<Users size={18} />}
                  onClick={() => {
                    setScreen("review");
                    setMobileMenuOpen(false);
                  }}
                >
                  Review Candidates
                </NavButton>
              </>
            )}
            {role === ROLES.SEEKER && (
              <>
                <NavButton
                  active={screen === "jobs"}
                  icon={<BriefcaseBusiness size={18} />}
                  onClick={() => {
                    setScreen("jobs");
                    setMobileMenuOpen(false);
                  }}
                >
                  Discover roles
                </NavButton>
                <NavButton
                  active={screen === "saved"}
                  icon={<Star size={18} />}
                  onClick={() => {
                    setScreen("saved");
                    setMobileMenuOpen(false);
                  }}
                >
                  Saved jobs <span className="nav-count">{savedIds.length}</span>
                </NavButton>
                <NavButton
                  active={screen === "applied"}
                  icon={<Check size={18} />}
                  onClick={() => {
                    setScreen("applied");
                    setMobileMenuOpen(false);
                  }}
                >
                  Applied <span className="nav-count">{appliedIds.length}</span>
                </NavButton>
                <NavButton
                  active={screen === "kanban"}
                  icon={<Check size={18} />}
                  onClick={() => {
                    setScreen("kanban");
                    setMobileMenuOpen(false);
                  }}
                >
                  Kanban <span className="nav-count">{appliedIds.length}</span>
                </NavButton>
                <NavButton
                  active={screen === "settings" || screen === "about"}
                  icon={<Settings size={18} />}
                  onClick={() => {
                    setScreen("settings");
                    setMobileMenuOpen(false);
                  }}
                >
                  Settings
                </NavButton>
              </>
            )}
          </nav>
          <div className="sidebar-bottom">
            <div className="profile-chip">
              <div className="avatar">{(user.displayName || user.email || "U")[0].toUpperCase()}</div>
              <div className="profile-chip-copy">
                <strong>{user.displayName || "Candidate"}</strong>
                <span>{user.email}</span>
              </div>
              <button
                className="icon-button"
                onClick={handleSignOut}
                disabled={busy}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </aside>

        <main className="main-panel">
          <header className="topbar">
            <button
              className="icon-button mobile-menu-button"
              aria-label="Open navigation"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu size={20} />
            </button>
            <div className="topbar-center">
              <button className="icon-button topbar-search" aria-label="Search jobs" title="Search">
                <Search size={18} />
              </button>
              <button className="icon-button topbar-settings" aria-label="Settings" title="Settings" onClick={() => setScreen("settings")}>
                <Settings size={18} />
              </button>
            </div>
          </header>

          <div className="content-area">
            {error && <Alert type="error">{error}</Alert>}
            {notice && <Alert type="success">{notice}</Alert>}
            {!supabaseConfigured && (
              <Alert type="warning">
                Add Supabase web settings to <code>web/.env.local</code> to load and update roles.
              </Alert>
            )}
            {roleContent}
          </div>
        </main>
        {mobileMenuOpen && (
          <button
            className="mobile-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
          />
        )}
        {selectedJob && (
          <JobDetailsModal
            job={selectedJob}
            saved={savedIds.includes(selectedJob.id)}
            applied={appliedIds.includes(selectedJob.id)}
            onClose={() => setSelectedJob(null)}
            onSave={() => toggleSaved(selectedJob)}
            onSkip={() => skipJob(selectedJob)}
            onApply={() => recordApplication(selectedJob)}
          />
        )}
        {applyBrowserUrl && (
          <InAppBrowser url={applyBrowserUrl} onClose={() => setApplyBrowserUrl(null)} />
        )}
      </div>
    );
  };

// --- Seeker sub-components ---

function SeekerFeed({ screen, jobs, allJobs, loading, query, onQueryChange, savedIds, appliedIds, onSave, onSkip, onApply, onDetails }) {
  const emptyTitle = screen === "saved" ? "Nothing saved yet" : screen === "applied" ? "No applications yet" : "No roles found";
  const emptyText = screen === "saved"
    ? "Save roles that catch your eye and find them here."
    : screen === "applied"
      ? "When you open an application link, your roles will appear here."
      : "Try another search or check back soon for new opportunities.";
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div>
          <h1>{screenTitle(screen)}</h1>
          <p>Thoughtful opportunities, with the details up front.</p>
        </div>
        <div className="heading-metric"><span className="metric-dot" /> <strong>{allJobs.length}</strong> open roles</div>
      </div>
      <div className="job-toolbar">
        <div className="search-box"><Search size={18} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search role, company, skill…" aria-label="Search jobs" /></div>
        <div className="toolbar-note"><Sparkles size={15} /> Curated for your next move</div>
      </div>
      {loading ? (
        <div className="jobs-loading"><div className="loading-spinner" /> Loading open roles…</div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><BriefcaseBusiness size={25} /></div>
          <h2>{emptyTitle}</h2><p>{emptyText}</p>
        </div>
      ) : (
        <div className="job-grid">
          {jobs.map((job, index) => (
            <JobCard
              key={job.id}
              job={job}
              index={index}
              saved={savedIds.includes(job.id)}
              applied={appliedIds.includes(job.id)}
              onSave={() => onSave(job)}
              onSkip={() => onSkip(job)}
              onApply={() => onApply(job)}
              onDetails={() => onDetails(job)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function JobCard({ job, index, saved, applied, onSave, onSkip, onApply, onDetails }) {
  const workMode = String(job.workMode).toLowerCase();
  return (
    <article className="job-card" style={{ "--card-index": index }}>
      <div className="job-card-top">
        <div className="company-avatar">{job.companyName.slice(0, 1).toUpperCase()}</div>
        <div className="company-heading">
          <div className="company-name">{job.companyName}{job.verifiedCompany && <ShieldCheck className="verified-icon" size={14} aria-label="Verified company" />}</div>
          <div className="company-location"><MapPin size={13} /> {job.location || "Location not specified"}</div>
        </div>
        <button className={`icon-button save-button ${saved ? "is-saved" : ""}`} onClick={onSave} aria-label={saved ? "Remove saved job" : "Save job"} title={saved ? "Remove saved job" : "Save job"}>
          <Star size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <button className="job-title-button" onClick={onDetails}><h2>{job.title}</h2></button>
      <div className="job-tags">
        {workMode !== "unspecified" && <span className="tag tag-mode">{job.workMode}</span>}
        {job.external && <span className="tag tag-external">External</span>}
        {experienceRange(job) && <span className="tag">{experienceRange(job)}</span>}
      </div>
      <div className="salary-line"><span>{moneyRange(job)}</span><span className="salary-caption">annual compensation</span></div>
      <div className="job-description">
        <div className="section-label">THE ROLE</div>
        <p>{job.teamObjective || "More details will be shared by the hiring team."}</p>
      </div>
      {job.coreSkills.length > 0 && (
        <div className="skill-list">{job.coreSkills.slice(0, 5).map((skill) => <span className="skill-tag" key={skill}>{skill}</span>)}</div>
      )}
      <div className="job-card-actions">
        <button className="button button-secondary" onClick={onSkip}><ArrowDownRight size={16} /> Pass</button>
        {applied ? (
          <button className="button button-applied" disabled><Check size={16} /> Applied</button>
        ) : (
          <button className="button button-primary" onClick={onApply} disabled={!safeExternalUrl(job.applyUrl)}><ExternalLink size={16} /> Apply</button>
        )}
      </div>
      <button className="details-link" onClick={onDetails}>View role details <ArrowRight size={14} /></button>
    </article>
  );
}

function ApplicationKanban({ appliedIds, jobs }) {
  const statuses = ["SUBMITTED", "VIEWED", "SHORTLISTED", "INTERVIEW_SCHEDULED", "OFFER", "ARCHIVED"];
  const appliedJobs = jobs.filter((j) => appliedIds.includes(j.id));
  const byStatus = useMemo(() => {
    const map = {};
    statuses.forEach((s) => (map[s] = []));
    appliedJobs.forEach((job) => {
      // default all applied to SUBMITTED since we don't store per-app status locally yet
      map["SUBMITTED"].push(job);
    });
    return map;
  }, [appliedJobs]);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">APPLICATION PIPELINE</div>
          <h1>Application Kanban</h1>
          <p>Track your applications from submission to offer.</p>
        </div>
      </div>
      <div className="job-grid">
        {statuses.map((status) => (
          <div key={status} className="kanban-column">
            <div className="kanban-header">
              <h3>{status.charAt(0) + status.slice(1).toLowerCase()}</h3>
              <span className="kanban-count">{byStatus[status].length}</span>
            </div>
            <div className="kanban-cards">
              {byStatus[status].map((job) => (
                <article key={job.id} className="job-card kanban-card">
                  <div className="company-heading">
                    <div className="company-name">{job.companyName}</div>
                    <div className="company-location"><MapPin size={12} /> {job.location}</div>
                  </div>
                  <h3>{job.title}</h3>
                  <div className="salary-line"><span>{moneyRange(job)}</span></div>
                  <span className="tag">Submitted</span>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function AboutScreen() {
  return (
    <div className="about-page">
      <div className="about-hero"><div className="about-mark">Devait<span>Jobs</span></div><div className="eyebrow">ABOUT DEVAIT JOBS</div><h1>A clearer path to<br /><span>work that fits.</span></h1><p>We believe finding your next role should feel focused, transparent, and human.</p></div>
      <div className="about-values">
        <div><span className="value-icon"><CircleHelp size={18} /></span><strong>Clarity first</strong><p>Know what the role asks for before you apply.</p></div>
        <div><span className="value-icon"><Heart size={18} /></span><strong>People matter</strong><p>We make room for a better connection between people and teams.</p></div>
        <div><span className="value-icon"><Sparkles size={18} /></span><strong>Less noise</strong><p>Spend your attention on the opportunities that matter.</p></div>
      </div>
      <div className="about-note">Devait Jobs · Find your next move.</div>
    </div>
  );
}

function NavButton({ active, icon, children, onClick }) {
  return <button className={`nav-button ${active ? "nav-active" : ""}`} onClick={onClick}>{icon}<span>{children}</span></button>;
}

function JobDetailsModal({ job, saved, applied, onClose, onSave, onSkip, onApply }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="details-modal" role="dialog" aria-modal="true" aria-labelledby="job-details-title">
        <div className="modal-top">
          <span className="eyebrow">ROLE DETAILS</span>
          <button className="icon-button" onClick={onClose} aria-label="Close details"><X size={19} /></button>
        </div>
        <div className="details-company"><div className="company-avatar">{job.companyName.slice(0, 1).toUpperCase()}</div><div><strong>{job.companyName}</strong><span><MapPin size={13} /> {job.location || "Location not specified"}</span></div></div>
        <h1 id="job-details-title">{job.title}</h1>
        <div className="job-tags">
          <span className="tag tag-mode">{job.workMode}</span>
          {experienceRange(job) && <span className="tag">{experienceRange(job)}</span>}
        </div>
        <div className="details-facts">
          <div><span>Compensation</span><strong>{moneyRange(job)}</strong></div>
          <div><span>Work style</span><strong>{job.workMode}</strong></div>
          <div><span>Posted</span><strong>{job.postedAt ? new Date(job.postedAt).toLocaleDateString() : "Not specified"}</strong></div>
        </div>
        <div className="details-section"><div className="section-label">ABOUT THE ROLE</div><p>{job.teamObjective || "No job summary provided."}</p></div>
        <div className="details-section"><div className="section-label">REQUIRED SKILLS</div><div className="skill-list">{job.coreSkills.length ? job.coreSkills.map((skill) => <span className="skill-tag" key={skill}>{skill}</span>) : <span className="muted-copy">No required skills listed.</span>}</div></div>
        <div className="details-actions">
          <button className={`button ${saved ? "button-saved" : "button-secondary"}`} onClick={onSave}><Star size={16} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save role"}</button>
          {applied ? <button className="button button-applied" disabled><Check size={16} /> Application opened</button> : <button className="button button-primary" disabled={!safeExternalUrl(job.applyUrl)} onClick={onApply}><ExternalLink size={16} /> Open application link</button>}
        </div>
        <button className="details-skip" onClick={onSkip}>Not for me — pass on this role</button>
      </section>
    </div>
  );
}

function InAppBrowser({ url, onClose }) {
  return (
    <div className="in-app-browser" onClick={onClose}>
      <div className="in-app-browser-header">
        <div className="in-app-browser-url">{url}</div>
        <button className="in-app-browser-close" onClick={onClose} aria-label="Close application browser"><X size={16} /></button>
      </div>
      <iframe className="in-app-browser-frame" src={url} referrerPolicy="no-referrer" title="Application form" />
    </div>
  );
}
