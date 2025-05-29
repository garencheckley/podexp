# Podcast Generation System

## System Overview

This project is a podcast generation system built using Google Cloud Platform services. It allows users to create podcasts, generate episodes using AI, and play them with text-to-speech audio. The system is designed to be deployed on Google Cloud Run and uses various Google Cloud services for its functionality.

## Architecture

The system follows a client-server architecture with the following components:

### Frontend
- A React-based single-page application (SPA)
- Deployed on Google Cloud Run
- Communicates with the backend via RESTful API calls
- Features a custom audio player component for episode playback
- Implements hybrid authentication with secure cookies and localStorage fallback
- **Flat, mobile-friendly UI:** The interface uses a flat design with divider lines (no card backgrounds or shadows), optimized for both mobile and desktop. All interactive elements have improved contrast for accessibility. The UI is dark mode only.

### Backend
- Node.js/Express server
- Deployed on Google Cloud Run
- Interfaces with Google Cloud services (Firestore, Storage, Text-to-Speech)
- Provides RESTful API endpoints for the frontend, protected by the email authentication system
- Implements sophisticated content generation and analysis pipelines

### Database
- Google Cloud Firestore for storing podcast and episode data
- NoSQL document database with collections for podcasts and episodes
- **Required Indexes**: Custom composite indexes for query performance
  - See `firestore.indexes.json` for required index definitions
  - Deploy indexes using `./deploy-indexes.sh` script
  - Essential for queries combining filters with sorting

### Storage
- Google Cloud Storage for storing generated audio files
- Public bucket for serving audio files directly to clients

### AI Services
- Google Gemini API for generating podcast episode content
- Google Cloud Text-to-Speech API for converting episode text to audio

## Technology Stack

### Frontend
- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **Styling**: CSS
- **HTTP Client**: Native Fetch API
- **Deployment**: Docker + Google Cloud Run
- **Web Server**: Nginx (in production)

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database SDK**: Firebase Admin SDK (for Firestore)
- **Storage SDK**: Google Cloud Storage Node.js Client
- **AI SDKs**:
  - Google Generative AI SDK for Gemini
  - Google Cloud Text-to-Speech Node.js Client
- **Deployment**: Docker + Google Cloud Run

### Infrastructure
- **Containerization**: Docker
- **CI/CD**: Google Cloud Build
- **Hosting**: Google Cloud Run (serverless containers)
- **Database**: Google Cloud Firestore
- **Storage**: Google Cloud Storage

## Data Model

### Podcast
```typescript
interface Podcast {
  id: string;
  title: string;
  description: string;
  prompt?: string;
  podcastType: string; // Always set to 'news'
  created_at: string;
  sources?: PodcastSource[];
  ownerEmail: string;       // Email of the podcast creator
  visibility: "public" | "private"; // Default to "private"
}
```

### Episode
```typescript
interface Episode {
  id: string;
  podcastId: string;
  title: string;
  description: string;
  content: string;
  audioUrl?: string;
  sources?: string[];
  created_at: string;
  bulletPoints?: string[]; // 3-5 concise summaries of key content
}
```

## Key Features

### Hybrid Authentication System
The system implements a secure, email-based authentication system with the following features:
- Magic link authentication via email
- Secure HTTP-only cookies with localStorage fallback
- Cross-domain compatibility
- Automatic token verification and session management
- Protected API endpoints with proper authorization checks

### Content Generation Pipeline
The system uses a multi-stage process for generating high-quality podcast content:

1. **Episode Analysis**
   - Consolidated analysis of previous episodes
   - Bullet point summaries for efficient content tracking
   - Pattern recognition across episodes
   - Topic frequency analysis

2. **Topic Generation & Selection**
   - 14-day recency window for up-to-date content
   - Podcast-specific reference websites integration
   - Enhanced relevance scoring and filtering
   - **Interactive topic selection process:**
     - System analyzes and presents multiple topic options to the user
     - 90-second selection window with auto-selection fallback
     - Topics ranked by relevance and recency
     - User can select preferred topic or let system auto-select
   - Comprehensive logging for debugging

3. **Deep Research**
   - Multi-layer research strategy
   - Contrasting viewpoints integration
   - Expert analysis incorporation
   - Source attribution and verification

4. **Content Synthesis**
   - Clean transcript generation
   - TTS-optimized formatting
   - Analytical depth enhancement
   - Narrative structure optimization

### Audio Generation
The system uses Google Cloud Text-to-Speech API to convert episode text to audio:
- Neural2 voice models for high-quality audio
- TTS-optimized content formatting
- Public audio file hosting
- Custom audio player integration

### Episode Management
- Automatic bullet point generation
- Source tracking and attribution
- Visibility controls (public/private)
- Owner-based access control

## Recent Major Enhancements

### Perplexity Sonar Pro Integration (December 2024)
Enhanced episode research with real-time data and expert insights:
- **5 Specialized Research Areas**: Recent developments, expert quotes, statistical data, competitive analysis, future predictions
- **Real-time Data**: 7-day breaking news focus with authoritative source citations
- **Expert Attribution**: Direct quotes from industry leaders with proper attribution
- **Market Intelligence**: Competitive insights and quantitative metrics
- **Enhanced Content Quality**: Data-rich episodes with specific statistics and expert predictions

### Hybrid Topic Discovery System
Combines multiple AI APIs for superior topic selection:
- **Dual API Architecture**: Gemini + Perplexity APIs running in parallel
- **Smart Prompting**: Optimized prompts for each API's strengths (analytical depth vs. real-time data)
- **Intelligent Ranking**: Multi-factor scoring based on relevance, recency, sources, and depth
- **Graceful Fallbacks**: Robust system continues working even if individual APIs fail

### Interactive Topic Selection
User-driven episode topic selection with intelligent fallbacks:
- **Topic Options Display**: System presents 6 curated topic options with metadata
- **90-Second Selection Window**: Users can choose preferred topics or auto-select most relevant
- **Enhanced User Control**: Balance between automation and user preference
- **Backward Compatibility**: Maintains existing automatic generation flow

### Enhanced UI/UX Features
Recent improvements to user experience:
- **Clickable Navigation**: Main title links to homepage for better navigation
- **RSS Feed Access**: Re-enabled RSS feed option in podcast settings menu
- **Login Improvements**: Added spam folder notice for email authentication
- **Content Readability**: Liberal paragraph breaks in episode transcripts for better readability

## Current Deployment Status

### Production URLs
- **Frontend**: https://podcast-frontend-827681017824.us-west1.run.app
- **Backend**: https://podcast-backend-827681017824.us-west1.run.app

### Environment Configuration
- **Project ID**: gcpg-452703
- **Region**: us-west1
- **APIs Enabled**: Gemini AI, Perplexity Sonar Pro, Google Cloud TTS
- **Latest Deployment**: May 29, 2025 (both services health-checked ✅)

### Known Development Issues
- **Local Development**: TypeScript compilation errors in `deepDiveResearch.ts` (production deployment unaffected)
- **Port Conflicts**: Local server startup may require killing existing processes on port 8080

## API Endpoints

### Authentication
- `POST /api/auth/login-request` - Request login link
- `GET /api/auth/verify` - Verify login token
- `GET /api/auth/logout` - Logout user

### Podcasts
- `GET /api/podcasts` - Get all podcasts
- `GET /api/podcasts/:id` - Get a specific podcast
- `POST /api/podcasts` - Create a new podcast
- `DELETE /api/podcasts/:podcastId` - Delete a podcast and all its episodes and audio files

### Episodes
- `GET /api/podcasts/:podcastId/episodes` - Get all episodes for a podcast
- `POST /api/podcasts/:podcastId/episodes` - Create a new episode
- `POST /api/podcasts/:podcastId/get-topic-options` - Get potential topics for episode generation
- `POST /api/podcasts/:podcastId/generate-episode` - Generate a new episode using AI (accepts optional selectedTopic parameter)
- `DELETE /api/podcasts/:podcastId/episodes/:episodeId` - Delete an episode and its audio file
- `POST /api/podcasts/:podcastId/generate-bullet-points` - Generate bullet points for an episode

## Deployment URLs

**IMPORTANT:** The only correct frontend URL is:

- https://podcast-frontend-827681017824.us-west1.run.app

Do NOT use or deploy to any other frontend service (such as https://frontend-827681017824.us-west1.run.app). All deployments and testing should use the `podcast-frontend` service and URL.

## Deployment Process

When deploying the frontend, always use the following command:

```
gcloud run deploy podcast-frontend --source=./frontend --region=us-west1 --platform=managed --allow-unauthenticated
```

Do NOT deploy to a service named `frontend`. If you see multiple frontend services, delete the incorrect one to avoid confusion.

The deployment process involves building and deploying both the backend and frontend services to Google Cloud Run. There are two main approaches to deployment: using local Docker or using Google Cloud Build directly.

### Prerequisites
- Google Cloud SDK installed and configured
- Docker installed
- `gcloud` CLI authenticated with your Google Cloud account
- Project ID configured in `gcloud` (or replace `PROJECT_ID` placeholder manually)
- Firestore indexes deployed (see `deploy-indexes.sh`)

### Backend Deployment

1.  **Create a `.env` file in the `backend` directory (if it doesn't exist):**
    This file is crucial for storing your `GEMINI_API_KEY` and should NOT be committed to git (ensure it's in your `.gitignore` file).
    ```
    backend/.env
    ```
    Add your Gemini API key to this file:
    ```env
    GEMINI_API_KEY=AIzaSyYOUR_ACTUAL_GEMINI_API_KEY_HERE
    ```

2.  **Navigate to the `backend` directory:**
    ```bash
    cd backend
    ```

3.  **Build the container using Google Cloud Build:**
    Replace `PROJECT_ID` with your actual Google Cloud Project ID if not configured in `gcloud`.
    ```bash
    gcloud builds submit --tag gcr.io/PROJECT_ID/podcast-backend
    ```

4.  **Deploy to Cloud Run:**
    Replace `PROJECT_ID` and `YOUR_REGION` (e.g., `us-west1`). This command sources the `GEMINI_API_KEY` from your `backend/.env` file.
    ```bash
    # Ensure backend/.env exists and GEMINI_API_KEY is set within it.
    # This command extracts the key from .env and passes it to Cloud Run.
    gcloud run deploy podcast-backend \
      --image gcr.io/PROJECT_ID/podcast-backend:latest \
      --region YOUR_REGION \
      --platform managed \
      --allow-unauthenticated \
      --set-env-vars="GEMINI_API_KEY=$(grep GEMINI_API_KEY .env | cut -d '=' -f2-)"
    ```
    **Note:** If your `GEMINI_API_KEY` might contain special characters that could interfere with the command, ensure it's properly quoted within the `.env` file or consider alternative methods for securely passing secrets in more complex CI/CD pipelines (like Secret Manager). For direct CLI deployment, this approach is generally effective.

### Frontend Deployment

The frontend deployment follows a similar process:

1. **Build and Push the Container**:
   ```bash
   # Navigate to the frontend directory
   cd /path/to/project/frontend
   
   # Build the container using Google Cloud Build
   gcloud builds submit --tag gcr.io/PROJECT_ID/podcast-frontend
   ```

2. **Deploy to Cloud Run**:
   ```bash
   # Deploy the container to Cloud Run
   gcloud run deploy podcast-frontend \
     --image gcr.io/PROJECT_ID/podcast-frontend:latest \
     --region us-west1 \
     --platform managed \
     --allow-unauthenticated
   ```

   **NOTE**: Always use the `us-west1` region for consistency with the backend.

### Common Deployment Issues and Solutions

1. **Deployment Timeout**: 
   - If the deployment process seems to hang, try adding `--no-traffic --tag=new-version` to your deployment command
   - This will deploy a new revision without routing traffic to it immediately
   - You can then migrate traffic gradually using the Cloud Console

2. **Environment Variables**:
   - Critical environment variables include `GEMINI_API_KEY`, `GOOGLE_CLOUD_PROJECT`, and `NODE_ENV`
   - To update environment variables without redeploying, use:
     ```bash
     gcloud run services update podcast-backend --set-env-vars=KEY=VALUE
     ```

3. **Service Account Permissions**:
   - Ensure the service account has proper permissions for Firestore, Storage, etc.
   - Check permissions in Google Cloud Console under IAM & Admin

4. **Debugging Deployed Services**:
   - Use Cloud Logging to view logs: `gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=podcast-backend"`
   - Set up Error Reporting in Google Cloud Console

5. **Firestore Query Errors**:
   - If you see "FAILED_PRECONDITION: The query requires an index" errors:
   - Ensure all required indexes are deployed using `./deploy-indexes.sh`
   - Check the Firebase console to verify index creation is complete
   - Index creation may take several minutes to complete

### Configuration Updates

After deployment, additional configuration may be needed:

1. **Frontend Backend URL**:
   - The frontend needs to know the backend URL
   - This is typically set in the frontend's environment configuration

2. **Backend Configuration**:
   - The backend needs Google Cloud credentials
   - Configure the project ID for storage buckets
   - Set up API keys for external services

3. **Cloud Run Service Configuration**:
   - Memory allocation: Increase if needed for larger models
   - CPU allocation: Can be adjusted based on traffic
   - Concurrency: Adjust based on your application's needs

### Rollback Procedure

If a deployment causes issues:

1. **Identify Last Working Revision**:
   ```bash
   gcloud run revisions list --service=podcast-backend
   ```

2. **Rollback to Previous Revision**:
   ```bash
   gcloud run services update-traffic podcast-backend --to-revisions=REVISION_NAME=100
   ```

### Recent Updates
- **Authorization Logic Fixes**: Corrected authorization checks in backend routes for updating podcast details (`PATCH /api/podcasts/:id`), deleting episodes (`DELETE /api/podcasts/:podcastId/episodes/:episodeId`), and deleting podcasts (`DELETE /api/podcasts/:podcastId`) to ensure proper owner verification using `ownerEmail` and correct handling of private resources.
- **Stable Hybrid Email Authentication**: Finalized and stabilized the hybrid authentication system. It uses secure cookies with a JavaScript (localStorage/header) fallback, resolving cross-domain issues and ensuring reliable login across different environments. See `AUTH_README.md` for full details.
- **User Authentication**: Implemented user authentication using Firebase Authentication and Google Sign-In. Protected relevant backend endpoints and filtered data based on user ownership. Added login/logout functionality to the frontend.
- **Core Generation Prompts Refinement**: Added explicit constraints against filler phrases, specified desired types of analysis (causal, comparative, etc.), consistently reinforced host persona, and rewrote integration prompts to focus on insightful analytical content
- **Enhanced Research & Synthesis Strategy**: Minimized summarization by removing character limits when passing research content between steps, improved contrasting viewpoints generation using stronger models, and enhanced synthesis prompts for deeper analysis
- Implemented Enhanced Research & Synthesis Strategy to preserve complete information throughout the content generation pipeline and improve the quality of analysis
- Upgraded insight extraction and deep dive query generation to use more powerful AI models for better analytical quality
- Removed character limitations between processing stages to maintain full context and detail
- Implemented Hybrid AI Model Strategy using powerful models (gemini-2.5-pro-exp-03-25) for complex tasks and fast models (gemini-2.0-flash) for simpler operations
- Updated the Gemini model from `gemini-2.5-pro-exp-03-25` to `gemini-2.0-flash` to avoid rate limit issues
- Updated the Text-to-Speech voice model from `en-US-Chirp3-HD-Orus` to `en-US-Chirp3-HD-Leda` for improved audio quality
- Fixed an issue with the Google Cloud Storage bucket naming
- Updated the frontend to use the production backend URL
- Improved error handling for API calls
- Enhanced podcast source management with the implementation of source discovery and source-guided search
- Improved audio player with automatic playback when clicking "Play Episode" button
- Enhanced episode creation date display to show both relative time (e.g., "2 mins ago") and full date-time information
- Improved episode analysis with consolidated approach: replaced multiple individual Gemini API calls with a single consolidated call for better reliability and cross-episode insights
- Added bullet point summaries for episodes: each episode now stores 3-5 concise bullet points summarizing key content, optimizing subsequent episode analysis
- Added migration endpoint to generate bullet points for existing episodes: `POST /api/podcasts/:podcastId/generate-bullet-points`
- **Data-Focused Content Generation**: Enhanced content generation prompts to produce more data-centric, analytical content with specific statistics, quantitative metrics, and expert market insights.
  - Updated the content formatter to emphasize data and statistics in podcast scripts
  - Improved narrative planning to prioritize quantitative analysis
  - Implemented dedicated deep dive research function for comprehensive market analysis
- **Modern Dark UI Theme**: Updated the frontend to a sleek, modern, flat dark theme. Reduced borders and fills, increased whitespace, and made buttons more minimal and sleek. No changes to functionality. Main changes in `frontend/src/index.css` and `frontend/src/App.css`.
 