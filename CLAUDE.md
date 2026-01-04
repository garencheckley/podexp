# GCPG - Podcast Generation System

AI-powered podcast generation web app using Google Cloud Platform services.

## Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, Material-UI
- **Backend**: Node.js + Express + TypeScript
- **Database**: Google Cloud Firestore
- **Storage**: Google Cloud Storage
- **AI**: Google Gemini (2.0-flash, 2.5-pro), Perplexity Sonar API
- **TTS**: Google Cloud Text-to-Speech (Neural2 voices)
- **Hosting**: Firebase Hosting (frontend) + Cloud Run (backend, us-west1)

## Project Structure
```
├── backend/           # Express API server
│   ├── src/
│   │   ├── routes/    # API endpoints (podcasts, auth, admin)
│   │   └── services/  # Core logic (database, audio, AI services)
├── frontend/          # React SPA
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── contexts/    # Auth context
│   │   └── services/    # API client
```

## Common Commands
```bash
# Development
npm run install:all     # Install all dependencies
npm run dev             # Run both frontend & backend
npm run dev:backend     # Backend only (port 8080)
npm run dev:frontend    # Frontend only (port 5173)

# Build
cd backend && npm run build
cd frontend && npm run build

# Lint
cd frontend && npm run lint
```

## Key Services (backend/src/services/)
- `database.ts` - Firestore CRUD operations
- `audio.ts` - Google Cloud TTS integration
- `hybridTopicService.ts` - Dual AI topic generation (Gemini + Perplexity)
- `searchOrchestrator.ts` - Content research orchestration
- `deepDiveResearch.ts` - In-depth topic research
- `contentFormatter.ts` - Format content for TTS output

## API Endpoints
- `POST /api/auth/login-request` - Request magic link email
- `GET /api/podcasts` - List podcasts
- `POST /api/podcasts/:id/generate-episode` - Generate new episode
- `POST /api/podcasts/:id/get-topic-options` - Get topic choices

## Environment Variables (backend/.env)
```
PORT=8080
GEMINI_API_KEY=
GOOGLE_CLOUD_PROJECT=gcpg-452703
PERPLEXITY_API_KEY=
SENDGRID_API_KEY=
FRONTEND_URL=
```

## Deployment

**Automatic (via GitHub Actions):**
Push to `main` branch triggers auto-deployment:
- Frontend changes → Firebase Hosting
- Backend changes → Cloud Run

**Manual (if needed):**
```bash
# Frontend to Firebase
cd frontend && npm run build && firebase deploy --only hosting

# Backend to Cloud Run
gcloud builds submit --tag gcr.io/gcpg-452703/podcast-backend backend
gcloud run deploy podcast-backend --image gcr.io/gcpg-452703/podcast-backend:latest --region us-west1
```

## URLs
- **Frontend**: https://gcpg-452703.web.app
- **Backend**: https://podcast-backend-827681017824.us-west1.run.app

## Architecture Notes
- Hybrid magic link auth (HTTP-only cookies + localStorage fallback)
- Multi-stage content generation: topic discovery → research → synthesis → TTS
- Interactive topic selection with 90-second timeout
- Episode generation logs viewable in UI for debugging

## GitHub
https://github.com/garencheckley/podexp
