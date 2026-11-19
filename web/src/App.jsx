import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  EmailAuthProvider,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
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

function moneyRange(job) {
  if (!job.salaryMin || !job.salaryMax) return "Compensation not listed";
  return `₹${Number(job.salaryMin).toLocaleString("en-IN")} – ₹${Number(job.salaryMax).toLocaleString("en-IN")}`;
}

function experienceRange(job) {
  if (job.minExperience != null && job.maxExperience != null) {
    return `${job.minExperience}–${job.maxExperience} years`;
  }
  if (job.minExperience != null) return `${job.minExperience}+ years`;
  if (job.maxExperience != null) return `Up to ${job.maxExperience} years`;
  return null;
}

function deriveRegion(location) {
  if (!location) return "";
  const parts = location.split(/[,/]/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts[0] : location;
}

function normalizeJob(row) {
  return {
    id: row.id,
    title: row.title || "Untitled role",
    companyName: row.company || "Company",
    location: row.location || "",
    region: row.region || deriveRegion(row.location) || "",
    workMode: row.work_style || "Unspecified",
    minExperience: row.min_experience,
    maxExperience: row.max_experience,
    coreSkills: Array.isArray(row.required_skills) ? row.required_skills : [],
    teamObjective: row.description_text || "",
    applyUrl: row.apply_url || "",
    postedAt: row.posted_at || "",
    salaryMin: row.salary_min || 0,
    salaryMax: row.salary_max || 0,
    verifiedCompany: Boolean(row.verified_company),
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

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [screen, setScreen] = useState("jobs");
  const [jobs, setJobs] = useState([]);
  const [profile, setProfile] = useState(emptyProfile);
  const [savedIds, setSavedIds] = useState([]);
  const [skippedIds, setSkippedIds] = useState([]);
  const [appliedIds, setAppliedIds] = useState([]);
const [loadingJobs, setLoadingJobs] = useState(false);
const [matchSource, setMatchSource] = useState("none");
const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [selectedJob, setSelectedJob] = useState(null);
const [applyBrowserUrl, setApplyBrowserUrl] = useState(null);
  const [query, setQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return undefined;
    }

    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setError("");
      setNotice("");
      if (!currentUser) {
        setProfile(emptyProfile);
        setOnboardingComplete(false);
        setAuthReady(true);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, "users", currentUser.uid));
        const data = snapshot.exists() ? snapshot.data() : {};
        setProfile({ ...emptyProfile, ...(data.seekerProfile || {}) });
        setOnboardingComplete(
          data.onboardingCompleted === true ||
            Boolean(data.agentDetails) ||
            Boolean(data.seekerProfile && Object.keys(data.seekerProfile || {}).length > 0),
        );
      } catch (loadError) {
        setError(loadError.message || "Could not load your profile.");
      } finally {
        setAuthReady(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedIds([]);
      setSkippedIds([]);
      setAppliedIds([]);
      return;
    }
    const prefix = `iq9:${user.uid}:`;
    setSavedIds(readList(`${prefix}saved`));
    setSkippedIds(readList(`${prefix}skipped`));
    setAppliedIds(readList(`${prefix}applied`));
  }, [user]);

  useEffect(() => {
    if (!user || !supabase) {
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

    supabase
      .from("jobs")
      .select(
        "id,title,company,location,region,work_style,min_experience,max_experience,required_skills,description_text,apply_url,posted_at",
      )
      .eq("is_active", true)
      .order("posted_at", { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (!active) return;
        if (fetchError) throw fetchError;
        const allJobs = (data || []).map(normalizeJob);

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
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message || "Could not load jobs.");
      })
      .finally(() => {
        if (active) setLoadingJobs(false);
      });
    return () => {
      active = false;
    };
  }, [user, profile.topSkills, profile.targetTitle, profile.expectedLocation]);

  const saveList = (name, value) => {
    const next = [...new Set(value)];
    const key = `iq9:${user.uid}:${name}`;
    localStorage.setItem(key, JSON.stringify(next));
    if (name === "saved") setSavedIds(next);
    if (name === "skipped") setSkippedIds(next);
    if (name === "applied") setAppliedIds(next);
  };

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
    setUser(currentUser);
    setProfile({ ...emptyProfile, ...(data.seekerProfile || {}) });
    setOnboardingComplete(
      data.onboardingCompleted === true ||
        Boolean(data.agentDetails) ||
        Boolean(data.seekerProfile && Object.keys(data.seekerProfile || {}).length > 0),
    );
    setError("");
  };

  const handleSignOut = async () => {
    setBusy(true);
    setError("");
    try {
      await signOut(auth);
      setScreen("jobs");
      setNotice("");
    } catch (signOutError) {
      setError(signOutError.message || "Could not sign out.");
    } finally {
      setBusy(false);
    }
  };

  const recordApplication = async (job) => {
    const url = safeExternalUrl(job.applyUrl);
    if (!url) {
      setError("This application link is invalid or unavailable.");
      return;
    }
    setApplyBrowserUrl(url);
    const next = [...new Set([...appliedIds, job.id])];
    saveList("applied", next);
    setNotice("Application opened in-app. Your activity is saved.");
    setError("");
    try {
      const { error: insertError } = await supabase.from("applications").insert({
        id: crypto.randomUUID(),
        jobId: job.id,
        seekerId: user.email || user.uid,
        status: "SUBMITTED",
      });
      if (insertError) throw insertError;
    } catch (insertError) {
      setError(
        `The application is saved, but activity could not be synced: ${insertError.message}`,
      );
    }
  };

  const skipJob = (job) => {
    saveList("skipped", [...skippedIds, job.id]);
    setSelectedJob(null);
  };

  const toggleSaved = (job) => {
    const next = savedIds.includes(job.id)
      ? savedIds.filter((id) => id !== job.id)
      : [...savedIds, job.id];
    saveList("saved", next);
  };

  if (!authReady) {
    return <LoadingScreen label="Connecting to iq9 Jobs" />;
  }

  if (!user) {
    return (
      <AuthScreen
        configured={firebaseConfigured}
        busy={busy}
        error={error}
        notice={notice}
        onSubmit={async (mode, email, password) => {
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
        }}
        onGoogle={async () => {
          setBusy(true);
          setError("");
          try {
            await finishAuth(await signInWithPopup(auth, googleProvider));
          } catch (authError) {
            setError(authError.message || "Google sign-in failed.");
          } finally {
            setBusy(false);
          }
        }}
        onReset={async (email) => {
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
        }}
        onClear={() => {
          setError("");
          setNotice("");
        }}
      />
    );
  }

  if (!onboardingComplete) {
    return (
      <OnboardingScreen
        user={user}
        busy={busy}
        error={error}
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
            setNotice("Profile created. Welcome to iq9 Jobs.");
          } catch (submitError) {
            setError(submitError.message || "Could not save your profile.");
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <Brand />
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
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
            active={screen === "settings" || screen === "about"}
            icon={<Settings size={18} />}
            onClick={() => {
              setScreen("settings");
              setMobileMenuOpen(false);
            }}
          >
            Settings
          </NavButton>
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
          <button
            className="topbar-user"
            onClick={() => setScreen("settings")}
            aria-label="Open profile settings"
          >
            <div className="avatar avatar-small">{(user.displayName || user.email || "U")[0].toUpperCase()}</div>
            <ChevronDown size={15} />
          </button>
        </header>

        <div className="content-area">
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {notice && <div className="alert alert-success" role="status">{notice}</div>}
          {!supabaseConfigured && (
            <div className="alert alert-warning">
              Add Supabase web settings to <code>web/.env.local</code> to load and update roles.
            </div>
          )}
          {screen === "settings" ? (
            <SettingsScreen
              user={user}
              profile={profile}
              busy={busy}
              onAbout={() => setScreen("about")}
              onSignOut={handleSignOut}
              onSave={async (nextProfile) => {
                setBusy(true);
                setError("");
                setNotice("");
                try {
                  await setDoc(
                    doc(db, "users", user.uid),
                    { seekerProfile: nextProfile },
                    { merge: true },
                  );
                  setProfile(nextProfile);
                  setNotice("Profile updated.");
                } catch (saveError) {
                  setError(saveError.message || "Could not update your profile.");
                } finally {
                  setBusy(false);
                }
              }}
              onChangePassword={async (currentPassword, nextPassword) => {
                setBusy(true);
                setError("");
                setNotice("");
                try {
                  if (user.providerData.every((item) => item.providerId !== "password")) {
                    throw new Error("This account uses Google sign-in. Use password reset instead.");
                  }
                  if (!user.email || !currentPassword || nextPassword.length < 6) {
                    throw new Error("Enter your current password and a new password of at least 6 characters.");
                  }
                  const credential = EmailAuthProvider.credential(user.email, currentPassword);
                  await reauthenticateWithCredential(user, credential);
                  await updatePassword(user, nextPassword);
                  setNotice("Password updated.");
                } catch (passwordError) {
                  setError(passwordError.message || "Could not update your password.");
                } finally {
                  setBusy(false);
                }
              }}
              onPasswordReset={async () => {
                setBusy(true);
                setError("");
                try {
                  if (!user.email) throw new Error("No email is associated with this account.");
                  await sendPasswordResetEmail(auth, user.email);
                  setNotice(`Password reset email sent to ${user.email}.`);
                } catch (resetError) {
                  setError(resetError.message || "Could not send a password reset email.");
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : screen === "about" ? (
            <AboutScreen onBack={() => setScreen("settings")} />
          ) : (
            <JobsScreen
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
          )}
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
        <JobDetails
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
}

function LoadingScreen({ label }) {
  return (
    <div className="loading-screen">
      <Brand />
      <div className="loading-spinner" />
      <span>{label}</span>
    </div>
  );
}

function Brand() {
  return (
    <a className="brand" href="#" aria-label="iq9 Jobs home">
      <span className="brand-mark">iq<span>9</span></span>
      <span className="brand-name">jobs<span>.</span></span>
    </a>
  );
}

function AuthScreen({ configured, busy, error, notice, onSubmit, onGoogle, onReset, onClear }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
              <div className="alert alert-warning">
                Firebase isn't configured. Copy <code>.env.example</code> to <code>.env.local</code> and add your web app settings.
              </div>
            )}
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            {notice && <div className="alert alert-success" role="status">{notice}</div>}
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                onClear();
                onSubmit(mode, email.trim(), password);
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
                    onClick={() => onReset(email.trim())}
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
              onClick={onGoogle}
            >
              <GoogleMark /> Continue with Google
            </button>
            <p className="auth-switch">
              {mode === "create" ? "Already have an account?" : "New to iq9?"}{" "}
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

function GoogleMark() {
  return <span className="google-mark" aria-hidden="true">G</span>;
}

function OnboardingScreen({ user, busy, error, onSubmit }) {
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
  const current = steps[step];
  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const advance = (event) => {
    event.preventDefault();
    if (step < steps.length - 1) setStep(step + 1);
    else setReview(true);
  };

  return (
    <div className="onboarding-page">
      <header className="onboarding-top"><Brand /><span>PROFILE SETUP</span></header>
      <div className="onboarding-card">
        <div className="onboarding-progress">
          <div className="progress-copy"><span>YOUR CANDIDATE PROFILE</span><span>{review ? "Review" : `${step + 1} of ${steps.length + 1}`}</span></div>
          <div className="progress-track"><span style={{ width: `${review ? 100 : ((step + 1) / (steps.length + 1)) * 100}%` }} /></div>
        </div>
        {review ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(form);
            }}
          >
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
          <form onSubmit={advance}>
            <div className="onboarding-eyebrow"><span className="agent-dot">iq</span> YOUR IQ9 AGENT</div>
            <h1>{step === 0 ? `Hi${form.fullName ? `, ${form.fullName.split(" ")[0]}` : ""}. Let's get to know you.` : current.label}</h1>
            <p className="muted-copy">{step === 0 ? current.label : "A few details help us find opportunities that fit."}</p>
            <div className="onboarding-field">
              <label className="field-label" htmlFor={`onboarding-${current.key}`}>{current.hint}</label>
              {current.key === "yearsExperience" ? (
                <input
                  autoFocus
                  id={`onboarding-${current.key}`}
                  type={current.type}
                  min="0"
                  max="60"
                  value={form[current.key]}
                  onChange={(event) => update(current.key, event.target.value)}
                  required
                />
              ) : (
                <input
                  autoFocus
                  id={`onboarding-${current.key}`}
                  type={current.type}
                  value={form[current.key]}
                  onChange={(event) => update(current.key, event.target.value)}
                  required
                />
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

function JobsScreen({ screen, jobs, allJobs, loading, query, onQueryChange, savedIds, appliedIds, onSave, onSkip, onApply, onDetails }) {
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

function JobDetails({ job, saved, applied, onClose, onSave, onSkip, onApply }) {
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

function SettingsScreen({ user, profile, busy, onAbout, onSignOut, onSave, onChangePassword, onPasswordReset }) {
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState("");
  const [targetTitle, setTargetTitle] = useState(profile.targetTitle || "");
  const [skills, setSkills] = useState((profile.topSkills || []).join(", "));
  const [location, setLocation] = useState(profile.expectedLocation || "");
  const [salaryFloor, setSalaryFloor] = useState(profile.salaryFloor || "");
  const [noticePeriod, setNoticePeriod] = useState(profile.noticePeriod || "IMMEDIATE");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");

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

  return (
    <div className="settings-page">
      <div className="page-heading">
        <div><div className="eyebrow">ACCOUNT & PREFERENCES</div><h1>Your settings</h1><p>Keep your profile and preferences up to date.</p></div>
      </div>
      <section className="settings-profile-card">
        <div className="settings-profile-avatar">{(user.displayName || user.email || "U")[0].toUpperCase()}</div>
        <div className="settings-profile-copy"><div className="section-label">SIGNED IN AS</div><h2>{user.displayName || "Candidate"}</h2><p>{user.email}</p></div>
        <button className="button button-secondary" onClick={() => setEditing(!editing)}><UserRound size={16} /> Edit profile</button>
      </section>
      {editing && (
        <form className="settings-card settings-form" onSubmit={saveProfile}>
          <div className="settings-card-heading"><h2>Candidate preferences</h2><p>Your details help personalize the roles you see.</p></div>
          <div className="settings-fields">
            <TextField label="Target role" value={targetTitle} onChange={setTargetTitle} required />
            <TextField label="Skills (comma separated, up to 6)" value={skills} onChange={setSkills} />
            <TextField label="Preferred location" value={location} onChange={setLocation} />
            <TextField label="Minimum salary (₹)" value={salaryFloor} onChange={setSalaryFloor} type="number" min="0" />
            <label className="field-label">Notice period<select value={noticePeriod} onChange={(event) => setNoticePeriod(event.target.value)}>{noticeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          {formError && <div className="alert alert-error" role="alert">{formError}</div>}
          <div className="settings-actions"><button type="button" className="button button-secondary" onClick={() => setEditing(false)}>Cancel</button><button className="button button-primary" disabled={busy}><Check size={16} /> Save changes</button></div>
        </form>
      )}
      <section className="settings-card">
        <div className="settings-card-heading"><div className="settings-heading-icon"><LockKeyhole size={18} /></div><div><h2>Password & security</h2><p>Update your password or request a reset link.</p></div></div>
        <form
          className="password-form"
          onSubmit={(event) => {
            event.preventDefault();
            onChangePassword(currentPassword, nextPassword);
            setCurrentPassword("");
            setNextPassword("");
          }}
        >
          <TextField label="Current password" value={currentPassword} onChange={setCurrentPassword} type="password" autoComplete="current-password" />
          <TextField label="New password" value={nextPassword} onChange={setNextPassword} type="password" minLength="6" autoComplete="new-password" />
          <button className="button button-secondary" disabled={busy || !currentPassword || nextPassword.length < 6}>Update password</button>
        </form>
        <button className="text-button reset-link" onClick={onPasswordReset} disabled={busy}>Send password reset email</button>
      </section>
      <section className="settings-link-grid">
        <button className="settings-link-card" onClick={onAbout}><span className="settings-heading-icon"><Info size={18} /></span><span><strong>About iq9 Jobs</strong><small>Our approach to better hiring</small></span><ArrowRight size={17} /></button>
        <button className="settings-link-card" onClick={onSignOut} disabled={busy}><span className="settings-heading-icon settings-icon-red"><LogOut size={18} /></span><span><strong>Sign out</strong><small>Sign out from this device</small></span><ArrowRight size={17} /></button>
      </section>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text", ...props }) {
  return (
    <label className="field-label">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  );
}

function AboutScreen({ onBack }) {
  return (
    <div className="about-page">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to settings</button>
      <div className="about-hero"><div className="about-mark">iq<span>9</span></div><div className="eyebrow">ABOUT IQ9 JOBS</div><h1>A clearer path to<br /><span>work that fits.</span></h1><p>We believe finding your next role should feel focused, transparent, and human.</p></div>
      <div className="about-values">
        <div><span className="value-icon"><CircleHelp size={18} /></span><strong>Clarity first</strong><p>Know what the role asks for before you apply.</p></div>
        <div><span className="value-icon"><Heart size={18} /></span><strong>People matter</strong><p>We make room for a better connection between people and teams.</p></div>
        <div><span className="value-icon"><Sparkles size={18} /></span><strong>Less noise</strong><p>Spend your attention on the opportunities that matter.</p></div>
      </div>
      <div className="about-note">iq9 Jobs · Find your next move.</div>
    </div>
  );
}

function NavButton({ active, icon, children, onClick }) {
  return <button className={`nav-button ${active ? "nav-active" : ""}`} onClick={onClick}>{icon}<span>{children}</span></button>;
}

function screenTitle(screen) {
  if (screen === "saved") return "Saved jobs";
  if (screen === "applied") return "Applied jobs";
  if (screen === "settings") return "Settings";
  if (screen === "about") return "About us";
  return "Discover roles";
}

function noticeLabel(value) {
  return noticeOptions.find(([key]) => key === value)?.[1] || value;
}

export default App;
