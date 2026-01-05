# GCPG Backlog

## Current

*No active tasks*

---

## Ideas / Future Work

- [ ] Add other OAuth providers (GitHub, Apple, etc.)
- [ ] Remove old Cloud Run frontend deployment (cost cleanup)
- [ ] Code-split frontend bundle (currently 668kb)

---

## Completed

### Firebase Migration & OAuth Refactor (2026-01-03 to 2026-01-04)
- Migrated frontend from Cloud Run to Firebase Hosting
- Replaced magic link auth with Google OAuth via Firebase Auth
- Backend now verifies Firebase ID tokens
- GitHub Actions auto-deploy on push to main
- Removed SendGrid/nodemailer dependencies
- **URLs:**
  - Frontend: https://gcpg-452703.web.app
  - Backend: https://podcast-backend-827681017824.us-west1.run.app

### Prompt Logging Feature (2025-06)
- Raw LLM prompt logging for Gemini/Perplexity
- UI display in generation log viewer

### Glassmorphism UI Redesign (2025-06)
- Dark theme with frosted glass cards
- Updated buttons and typography
