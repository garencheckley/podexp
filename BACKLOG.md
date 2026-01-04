# GCPG Backlog

## 🚧 IN PROGRESS: Firebase Migration & OAuth Refactor
**Started:** 2026-01-03
**Status:** Planning

### Goal
Migrate from Cloud Run frontend + magic link auth to Firebase Hosting + Firebase OAuth authentication.

### Key Requirement: CI/CD via GitHub
**All deployments must happen via GitHub Actions** - no local deploy commands needed.
Push to `main` branch should automatically:
- Build frontend
- Deploy to Firebase Hosting
- (Backend already deploys to Cloud Run via existing workflow)

### Firebase Config
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAvdyEVGOQJc68Nx3fcDuoWxDtSD0Hba-k",
  authDomain: "gcpg-452703.firebaseapp.com",
  projectId: "gcpg-452703",
  storageBucket: "gcpg-452703.firebasestorage.app",
  messagingSenderId: "827681017824",
  appId: "1:827681017824:web:2d9eb4d5109d1c40162585",
  measurementId: "G-2K8JWJZZMV"
};
```

### Migration Tasks

#### Phase 1: Firebase Auth Setup
- [x] Install Firebase SDK in frontend (`firebase`)
- [x] Create Firebase config file (`src/firebase.ts`)
- [x] Set up Firebase Auth context to replace current auth context
- [x] Implement Google OAuth sign-in (primary provider)
- [ ] Optional: Add other OAuth providers (GitHub, etc.)

#### Phase 2: Backend Auth Changes
- [x] Update backend to verify Firebase ID tokens instead of magic link tokens
- [x] `firebase-admin` SDK already installed in backend
- [x] Firebase Admin already initialized in database.ts
- [x] Update auth middleware to validate Firebase tokens
- [ ] Remove SendGrid/magic link dependencies (cleanup later)

#### Phase 3: Frontend Auth UI
- [x] Replace magic link login form with OAuth buttons
- [x] Update AuthContext to use Firebase Auth state
- [x] Handle auth state persistence (Firebase handles this)
- [x] Update protected routes (loading state added)

#### Phase 4: Firebase Hosting Deployment
- [x] Configure `firebase.json` for SPA routing
- [x] Update `.firebaserc` with project ID
- [x] Update CORS in backend for Firebase Hosting URLs
- [ ] Test deployment
- [ ] Verify OAuth works in production

#### Phase 5: CI/CD & Cleanup
- [x] GitHub Actions already configured for Firebase deployment
- [ ] Remove old Cloud Run frontend deployment
- [ ] Remove magic link auth code (SendGrid)
- [ ] Update documentation

### Required GitHub Secrets

The following secrets must be configured in GitHub repo settings (Settings > Secrets > Actions):

1. **FIREBASE_SERVICE_ACCOUNT** (required for frontend deploy)
   - Go to Firebase Console > Project Settings > Service Accounts
   - Click "Generate new private key"
   - Copy the entire JSON content as the secret value

2. **GCP_SA_KEY** (already configured for backend deploy)
   - Used for Cloud Run backend deployment

### Required Firebase Console Setup

1. **Enable Google Auth Provider**
   - Go to Firebase Console > Authentication > Sign-in method
   - Enable "Google" provider
   - Configure OAuth consent screen if prompted

### Current URLs
- **Backend (Cloud Run):** https://podcast-backend-827681017824.us-west1.run.app
- **Frontend (target):** https://gcpg-452703.web.app

### Notes
- Backend stays on Cloud Run (no change)
- Only frontend hosting and auth method changing
- Existing Firestore data structure should remain compatible

---

## Completed

### ✅ Prompt Logging Feature (2025-06)
- Raw LLM prompt logging for Gemini/Perplexity
- UI display in generation log viewer

### ✅ Glassmorphism UI Redesign (2025-06)
- Dark theme with frosted glass cards
- Updated buttons and typography
