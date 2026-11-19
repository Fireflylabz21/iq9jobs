# BrevityJobs: Product Requirements, Business Rules & Architectural Guardrails

## 1. System Philosophy & Core Tenets

BrevityJobs is a mobile-first, high-signal talent marketplace engineered to eliminate cognitive overload, wall-of-text job descriptions, and multi-page resume screening.

### 1.1 Core Tenets
1. **Zero Text Walls:** Multi-page job postings are replaced with 5-point, structured **Role Cards**. Resumes are replaced with standardized, 1-screen **Candidate Snapshots**.
2. **Signal-First Transparency:** Mandatory compensation bands (no "competitive salary" placeholders), exact work arrangement (remote/hybrid/onsite with office days), notice periods, and exactly 3 non-negotiable hard skills.
3. **Strict Anti-Ghosting Protocol:** Enforced SLA timelines for employers with automated state transitions, transparency badges, and automatic application release.
4. **Frictionless Mobile-Native UX:** Sub-100ms gesture-driven swiping, 1-tap quick application with pre-computed skill matches, and zero external ATS redirects.

---

## 2. Business Rules & Enforcement Guardrails

### 2.1 Job Provider / Recruiter Rules
* **BR-REC-01 (Mandatory Salary Floor & Ceiling):** No job requisition can be published without an explicit numeric base compensation range (minimum and maximum in local currency). Requisitions violating parity or leaving null values fail validation.
* **BR-REC-02 (The "Rule of Three" Skills):** Employers must select **exactly 3** non-negotiable core skills from the platform's standardized taxonomy. Freeform keyword stuffing is rejected.
* **BR-REC-03 (Anti-Ghosting SLA & Quick Responder Badging):**
  * When a candidate applies, the recruiter has **5 business days** to take action (`Shortlist`, `Request Screen`, or `Polite Pass`).
  * If no action occurs after 5 business days, the candidate receives an automated notification, and the recruiter receives a priority warning flag.
  * Employers maintaining a **≥90% response rate within 72 hours** receive the public **"Verified Fast Responder"** badge on their role cards.
* **BR-REC-04 (Mandatory Rejection Reason Tag):** Recruiters declining applicants must select one standardized reason tag (e.g., *Notice period mismatch*, *Compensation expectation out of range*, *Selected candidate with closer tech stack fit*). Generic silence is programmatically impossible.

### 2.2 Job Seeker Rules
* **BR-JS-01 (Snapshot Profile Constraints):**
  * Profile is strictly limited to 1 mobile viewport (no scrolling needed for primary evaluation).
  * Maximum 3 achievement bullets (max 140 characters per bullet; must contain quantifiable impact metrics).
  * Maximum 6 verified technical or functional skills.
  * Explicit availability selector (`Immediate`, `< 15 Days`, `30 Days`, `60+ Days`).
* **BR-JS-02 (Anti-Spam Application Rate Limiting):**
  * Standard accounts can submit a maximum of **10 applications per rolling 24-hour window** to discourage indiscriminate spray-and-pray behavior and preserve recruiter inbox quality.
  * Applications require answering up to 3 binary/numeric knockout questions configured by the employer.
* **BR-JS-03 (Incognito & Stealth Mode):**
  * Candidates can register up to 5 email domain blocks (e.g., `@currentemployer.com`). Recruiters tied to verified blocked domains cannot see the candidate's profile in talent searches or recommendation queues.

---

## 3. Detailed Functional Requirements Specification

### 3.1 Job Seeker Flow (Candidate Experience)
* **FR-JS-01 (Smart Onboarding & CV Parsing):**
  * 1-tap resume ingest (PDF/DOCX) via serverless text extractor. Automatically populates current title, years of experience, primary skills, and education.
  * Manual override fallback with autocomplete chips based on the platform taxonomy.
* **FR-JS-02 (Swipeable Role Feed):**
  * Native card stack with swipe gestures (Swipe Right: Save/Bookmark; Swipe Left: Pass/Not Interested; Swipe Up: Instant Apply modal).
  * Each card displays: Role Title, Company Logo & Size, Salary Range, Work Mode, Match Score Indicator (computed on-device via skill intersection), and 1-sentence team objective.
* **FR-JS-03 (1-Tap Quick Apply):**
  * Submits the standardized Candidate Snapshot directly to the recruiter's inbox.
  * Presents employer knockout questions in a slide-up bottom sheet with binary (Yes/No) or range selections.
  * Optional 140-character "Elevator Pitch" note; strictly no custom cover letter attachments allowed.
* **FR-JS-04 (Application Kanban & Status Pipeline):**
  * Live status tracker tracking 5 states: `Submitted` $\rightarrow$ `Viewed by Recruiter` $\rightarrow$ `Shortlisted` $\rightarrow$ `Interview Scheduled` $\rightarrow$ `Offer / Archived`.
  * Visual timestamp markers for each milestone.
* **FR-JS-05 (In-App Direct Chat & Native Scheduling):**
  * Real-time 1-on-1 messaging channel unlocked once a recruiter transitions the candidate to `Shortlisted`.
  * Recruiter sends interactive meeting slot chips. Candidate taps a slot to automatically book and create an event on the device's native calendar (via Android `CalendarContract`).

### 3.2 Job Provider Flow (Recruiter / Hiring Manager Experience)
* **FR-REC-01 (3-Minute Structured Job Builder):**
  * Stepper form enforcing strict input bounds: Role Title $\rightarrow$ Salary Min/Max $\rightarrow$ Work Mode $\rightarrow$ 3 Required Skills $\rightarrow$ 3 Knockout Questions.
* **FR-REC-02 (Standardized Candidate Review Queue):**
  * Unified candidate snapshot card view. Fast swipe review actions: Swipe Right (`Shortlist`), Swipe Left (`Decline with Reason`), Swipe Up (`Save to Talent Pool`).
* **FR-REC-03 (Asynchronous 60-Second Video/Audio Introductions - Pro):**
  * Candidate records an optional 60-second video or audio response to a predefined employer prompt.
  * Native video player with playback speed toggles (1.0x, 1.25x, 1.5x) for rapid screening.

---

## 4. Technical Guardrails & Non-Functional Requirements (NFR)

### 4.1 Performance & UX Metrics
* **NFR-PERF-01 (Frame Budget):** 60 FPS minimum (120 FPS on supported refresh rate displays) across all swipe and transition animations in Jetpack Compose.
* **NFR-PERF-02 (Latency SLA):** Feed card fetch latency $< 200\text{ms}$ over 4G/5G connections; local cache queries $< 15\text{ms}$.
* **NFR-PERF-03 (Offline First):** The app must pre-cache the next 25 job cards locally using Room Database. Swipe interactions made offline must be queued via `WorkManager` and synchronized when network connectivity is re-established.

### 4.2 Security, Privacy & Integrity Guardrails
* **NFR-SEC-01 (Credential Storage):** User authentication tokens (JWTs) must be stored exclusively in `EncryptedSharedPreferences` backed by the Android Keystore System.
* **NFR-SEC-02 (Transport Security):** Strict HTTPS/TLS 1.3 encryption for all REST and WebSocket connections. Certificate pinning implemented on sensitive authentication endpoints.
* **NFR-SEC-03 (Zero PII Leakage):** Candidate phone numbers and personal email addresses are masked during initial screening; direct communication occurs exclusively through the sandboxed in-app chat until mutual acceptance.

---

## 5. System Entity Relationship Model (ERD)

```
┌────────────────────────┐         ┌────────────────────────┐
│         USERS          │         │       COMPANIES        │
├────────────────────────┤         ├────────────────────────┤
│ id: UUID (PK)          │         │ id: UUID (PK)          │
│ email: String          │         │ name: String           │
│ role: Enum(Seeker,Rec) │         │ domain: String         │
│ incognito_domains: List│         │ fast_responder_sla: Bool│
└───────────┬────────────┘         └───────────┬────────────┘
            │                                  │
            ▼                                  ▼
┌────────────────────────┐         ┌────────────────────────┐
│   SEEKER_PROFILES      │         │       JOB_POSTS        │
├────────────────────────┤         ├────────────────────────┤
│ user_id: UUID (FK)     │         │ id: UUID (PK)          │
│ target_title: String   │         │ company_id: UUID (FK)  │
│ salary_floor: Int      │         │ salary_min: Int        │
│ notice_period: Enum    │         │ salary_max: Int        │
│ top_skills: Array[6]   │         │ work_mode: Enum        │
│ highlights: Array[3]   │         │ core_skills: Array[3]  │
└───────────┬────────────┘         │ status: Enum           │
            │                      └───────────┬────────────┘
            │                                  │
            └───────────────┬──────────────────┘
                            ▼
               ┌────────────────────────┐
               │      APPLICATIONS      │
               ├────────────────────────┤
               │ id: UUID (PK)          │
               │ job_id: UUID (FK)      │
               │ seeker_id: UUID (FK)   │
               │ status: Enum           │
               │ pitch_note: String(140)│
               │ decline_reason: Enum   │
               │ last_activity_at: Time │
               └────────────────────────┘
```