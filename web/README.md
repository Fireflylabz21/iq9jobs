# iq9 Jobs Web

This is a standalone, responsive React version of the currently implemented Android seeker experience. It does not modify or share build files with the Android app.

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Set the Firebase web app configuration and Supabase project URL plus anon key.
3. Install dependencies with `npm install`.
4. Start the app with `npm run dev`.

The Firebase web app must have Email/Password and Google providers enabled and an authorized web domain. Firestore rules must allow the signed-in user to access their own `users/{uid}` document. Supabase must permit the configured anon role to read active `jobs` and to perform the app's `subscribers` and `applications` operations under its Row Level Security policies.

No backend credentials are committed. If either backend is not configured, the app displays a setup error instead of silently substituting demo data.

## Included flows

- Email/password sign-in, account creation, Google sign-in, password reset, and session restoration through Firebase Auth.
- Profile onboarding and editing, stored using the existing Firestore `users/{uid}` document shape; onboarding also submits the existing `subscribers` record.
- Active job feed from Supabase, role details, save/unsave, skip, and application-link tracking.
- Saved and applied job lists, profile preferences, password change/reset, About, and sign out.

## Responsive behavior

The role feed uses a single-column mobile layout and expands into a browse layout on larger screens. Navigation, forms, cards, and dialogs adapt to narrow viewports and support keyboard interaction.
