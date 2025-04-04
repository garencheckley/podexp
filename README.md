# Podcast Generation System

## System Overview

This project is a podcast generation system built using Google Cloud Platform services. It allows users to create podcasts, generate episodes using AI, and play them with text-to-speech audio. The system is designed to be deployed on Google Cloud Run and uses various Google Cloud services for its functionality.

## Architecture

The system follows a client-server architecture with the following components:

### Frontend
- A React-based single-page application (SPA)
- Deployed on Google Cloud Run
- Communicates with the backend via RESTful API calls

### Backend
- Node.js/Express server
- Deployed on Google Cloud Run
- Interfaces with Google Cloud services (Firestore, Storage, Text-to-Speech)
- Provides RESTful API endpoints for the frontend

### Database
- Google Cloud Firestore for storing podcast and episode data
- NoSQL document database with collections for podcasts and episodes

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
- **Authentication**: (Planned for Phase 5) Google Identity Platform

## Data Model

### Podcast
```typescript
interface Podcast {
  id: string;
  title: string;
  description: string;
  prompt?: string;
  useWebSearch?: boolean;
  created_at: string;
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
}
```

## API Endpoints

### Podcasts
- `GET /api/podcasts` - Get all podcasts
- `GET /api/podcasts/:id` - Get a specific podcast
- `POST /api/podcasts` - Create a new podcast
- `DELETE /api/podcasts/:podcastId` - Delete a podcast and all its episodes and audio files

### Episodes
- `GET /api/podcasts/:podcastId/episodes` - Get all episodes for a podcast
- `POST /api/podcasts/:podcastId/episodes` - Create a new episode
- `POST /api/podcasts/:podcastId/generate-episode` - Generate a new episode using AI
- `DELETE /api/podcasts/:podcastId/episodes/:episodeId` - Delete an episode and its audio file

## Key Components

### Audio Generation
The system uses Google Cloud Text-to-Speech API to convert episode text to audio. The implementation is in `backend/src/services/audio.ts`. Key features:
- Uses Neural2 voice models for high-quality audio
- Stores generated audio in Google Cloud Storage
- Makes audio files publicly accessible via URLs
- Configures audio parameters for optimal podcast listening

### Content Generation
The system uses Google Gemini API to generate podcast episode content. The implementation is in `backend/src/routes/podcasts.ts`. Key features:
- Uses previous episodes as context for generating new episodes
- Maintains consistent characters and themes
- Generates both episode content and metadata (title, description)
- Supports customizable episode length through prompt specification (e.g., "episode length: 3 minutes")
- Default episode length is 2 minutes (approximately 300 words) if not specified

### Web Search Integration
The system uses Gemini API's grounding with Google Search capability to incorporate real-time information from the web. The implementation is in `backend/src/services/search.ts`. Key features:
- Three-stage search process for intelligent information retrieval:
  1. Initial query generation based on podcast prompt
  2. Search execution and relevance evaluation
  3. In-depth research on high-relevance stories
- Optional toggle at podcast creation to enable/disable web search
- Automatic attribution of sources in episode content
- Display of sources with clickable links in the episode transcript
- Particularly useful for news, current events, and informational podcasts

### Audio Player
The frontend includes a custom audio player component (`frontend/src/components/AudioPlayer.tsx`) that provides:
- Play/pause controls
- Progress tracking
- Time display
- Direct URL access to audio files

### TTS Compatibility Improvements
The system now features enhanced compatibility with Text-to-Speech (TTS) technology:

- **Clean Transcript Generation**: Removed speech instructions like "(pause)", "(slightly faster pace)", and "(upbeat intro music)" from generated transcripts, which were causing issues with TTS processing
- **Formatting Removal**: Eliminated formatting markers such as "**Host:**" and other markdown/formatting elements that interfered with natural speech flow
- **Metadata Separation**: Sources are now stored as metadata only and no longer appended to the transcript content, making the audio cleaner and more focused
- **Prompt Engineering**: Updated the Gemini prompts to explicitly instruct the AI to avoid speech directions and formatting, using only standard punctuation
- **Plain Text Emphasis**: The system now generates plain text with standard punctuation only (periods, commas, question marks, etc.) for optimal TTS processing
- **Improved Audio Quality**: These changes result in more natural-sounding podcast audio without artificial pauses or formatting artifacts
- **Enhanced Model**: Upgraded to using gemini-2.5-pro-exp-03-25 model for text generation, providing higher quality content

These improvements significantly enhance the listening experience by ensuring that the Text-to-Speech engine receives clean, properly formatted text that can be converted accurately to speech without unexpected artifacts or interruptions.

### Advanced Search Orchestration with Episode Planning

The system now implements a sophisticated multi-stage process for episode generation, combining advanced search orchestration with intelligent episode planning. This implementation follows a five-step workflow:

#### 1. Episode Analysis
- **Comprehensive Content Review**: Automatically analyzes previous episodes to identify topics, themes, and content patterns
- **Topic Frequency Analysis**: Tracks which topics have been covered and how frequently
- **Theme Identification**: Extracts recurring themes to avoid repetition
- **Source Tracking**: Maintains a database of previously used sources
- **Smart AI Analysis**: Uses Gemini to perform semantic analysis of episode content

#### 2. Initial Exploratory Search
- **Differentiated Query Generation**: Creates search queries specifically designed to find content not covered in previous episodes
- **Recency-Aware Queries**: Includes time markers in queries to prioritize recent information
- **Topic Identification**: Analyzes search results to identify potential new topics
- **Relevance Scoring**: Rates potential topics based on relevance to podcast theme
- **Query Suggestion**: Automatically suggests follow-up queries for deeper research

#### 3. Intelligent Episode Planning
- **Editorial Decision Making**: AI selects the most appropriate topics for the episode
- **Depth Assignment**: Determines ideal coverage depth for each topic (deep, medium, or overview)
- **Angle Identification**: Specifies the angles or perspectives to explore for each topic
- **Further Research Planning**: Creates specific research queries for deeper investigation
- **Differentiation Strategy**: Develops a strategy to ensure the episode differs from previous ones

#### 4. Deep Research with Contrasting Viewpoints
- **Targeted Research**: Conducts deep research on selected topics
- **Contrasting Viewpoint Search**: Specifically seeks alternative perspectives on each topic
- **Multi-Query Execution**: Runs multiple parallel searches to gather comprehensive information
- **Topic Synthesis**: Combines research into coherent topic summaries
- **Source Collection**: Gathers diverse sources for attribution

#### 5. Content Differentiation Validation
- **Similarity Analysis**: Compares generated content against previous episodes
- **Redundancy Detection**: Identifies redundant elements that might duplicate previous content
- **Automated Improvement**: When necessary, automatically rewrites content to increase differentiation
- **Quality Metrics**: Provides similarity scores and differentiation assessments
- **Content Optimization**: Fine-tunes content to ensure uniqueness while maintaining quality

#### Advanced Search Architecture
The implementation consists of three primary services:

1. **episodeAnalyzer**: Analyzes existing episodes to understand previously covered content
2. **searchOrchestrator**: Coordinates the multi-phase search process and topic selection
3. **contentDifferentiator**: Ensures new content is sufficiently differentiated from previous episodes

This approach delivers the following benefits:

- **Reduced Repetition**: Each episode contains significantly less repeated information from previous episodes
- **Increased Depth**: Topics are covered more thoroughly with deeper insights
- **Multiple Perspectives**: Content now includes contrasting viewpoints for more balanced coverage
- **Progressive Knowledge Building**: Episodes build upon previous knowledge rather than repeating basics
- **Enhanced Differentiation**: Each episode provides unique value not found in previous episodes

The Advanced Search Orchestration with Episode Planning implementation is particularly valuable for news-type podcasts where maintaining fresh, non-repetitive content is essential.

### Deep Dive Research Framework

The system now implements a sophisticated Deep Dive Research Framework that enables podcasts to cover fewer topics with much greater depth, resulting in more substantial and valuable content. This multi-layered approach to research ensures comprehensive coverage of selected topics.

#### Core Components

##### 1. Topic Prioritization Algorithm
- **Importance & Newsworthiness Scoring**: Ranks potential topics based on multiple factors including relevance, newsworthiness, and depth potential
- **Optimal Topic Selection**: Intelligently selects fewer topics (typically 1-3) based on episode length
- **Key Question Identification**: Generates specific questions that the research should answer
- **Previous Coverage Analysis**: Considers topics covered in previous episodes to avoid repetition

##### 2. Multi-Layer Research Strategy
- **Surface Layer (Level 1)**: Gathers foundational factual information and key definitions
- **Intermediate Layer (Level 2)**: Explores context, background, and supporting details
- **Deep Layer (Level 3)**: Analyzes expert opinions, implications, historical context, and future prospects
- **Progressive Query Generation**: Each layer informs the queries for subsequent layers

##### 3. Depth Metrics System
- **Factual Density**: Measures the concentration of specific facts, figures, and concrete information
- **Insight Score**: Evaluates the quality of analysis beyond just presenting facts
- **Contextual Depth**: Assesses how well the content provides historical context and broader implications
- **Overall Depth Assessment**: Combines metrics to evaluate comprehensive depth quality

##### 4. Research Synthesis Engine
- **Cross-Layer Integration**: Combines insights from all research layers into a cohesive narrative
- **Question-Targeted Content**: Ensures key questions identified during prioritization are answered
- **Depth-Appropriate Structure**: Organizes content to progressively build understanding from basic facts to deeper analysis
- **Content Distribution**: Allocates content based on topic importance and depth potential

#### Benefits

- **Substantive Coverage**: Episodes provide significantly more detailed information on key topics
- **Enhanced Understanding**: Listeners gain deeper insights rather than surface-level overviews
- **Contextual Richness**: Topics are presented with historical background and broader implications
- **Expert-Level Analysis**: Content includes the type of analysis typically found in expert commentary
- **Educational Value**: Podcasts become more valuable knowledge resources on specific topics

This implementation is ideal for educational and informational podcasts where listeners are seeking in-depth understanding rather than broad coverage of many topics.

### Hybrid AI Model Strategy

To address quality concerns such as lack of depth, repetition, and "fluff" (as outlined in Backlog Item 1.1), the system now employs a hybrid AI model strategy. This involves:

- **Powerful Model (`gemini-2.5-pro-exp-03-25`)**: Used for complex tasks requiring deep reasoning, nuanced analysis, and high-quality generation. This includes topic prioritization, research synthesis, content differentiation analysis, narrative planning, and final script generation.
- **Fast Model (`gemini-2.0-flash`)**: Used for simpler, speed-sensitive tasks where cost-effectiveness is also important. This includes initial search query generation, preliminary topic identification from search results, and executing grounded web searches.

This approach matches AI model capabilities to task complexity, aiming to improve the overall quality, depth, and analytical rigor of the generated podcast content while managing computational resources effectively.

### Improved Source Attribution Display
The system now features an enhanced display for source attribution in news-based podcasts:

- **User-Friendly References**: API search URLs are now displayed as "Reference 1", "Reference 2", etc. instead of raw URLs
- **Enhanced Visual Design**: Sources section uses a cleaner, more attractive styling with bullet points and subtle hover effects
- **Flexible URL Handling**: System intelligently detects and formats different types of source URLs
- **Error Handling**: Robust error handling for malformed or unexpected URL formats
- **Mobile Responsive**: Source attribution section is fully responsive for all screen sizes

This improvement makes the source attribution section more readable and professional, enhancing the overall user experience while maintaining the important credibility that source attribution provides to news-based podcasts.

### Enhanced User Interface Features

The system now includes several UI enhancements to improve the user experience:

#### Auto-Play Functionality
- **Automatic Playback**: When clicking the "Play Episode" button, audio now automatically begins playing instead of just loading the player
- **Smooth Transitions**: Audio state is properly reset when switching between episodes
- **Error Handling**: Graceful fallback for browsers with autoplay restrictions
- **Playback Controls**: Maintain all existing controls (play/pause, skip forward/backward, progress tracking)

#### Improved Date and Time Display
- **Relative Time Indicators**: Episode creation dates now show relative time (e.g., "2 mins ago", "3 hours ago", "2 days ago")
- **Detailed Timestamps**: Full date and time information is displayed alongside relative time
- **Format**: "Created: X mins/hours/days ago (MM/DD/YYYY at HH:MM AM/PM)"
- **Dynamic Updates**: Relative time indicators accurately reflect the passage of time
- **Intelligent Formatting**: Automatically uses appropriate singular/plural forms (e.g., "1 minute ago" vs "2 minutes ago")

These UI improvements enhance usability and provide more intuitive information to users, making the podcast experience more engaging and user-friendly.

## Development Workflow

The development process follows these steps:

1. **Code Changes**: Make changes to the codebase on the local development machine
2. **Local Testing**: Test changes using local development servers
3. **Docker Build**: Build Docker containers for the updated services
4. **Cloud Deployment**: Deploy the containers to Google Cloud Run
5. **Verification**: Verify the changes in the production environment
6. **Documentation**: Update the README.md with details of the changes
7. **Version Control**: Commit changes to Git repository

**IMPORTANT**: When implementing new features, always remember to commit and push your changes to the Git repository. This ensures that all changes are properly tracked and that other team members have access to the latest code. Use meaningful commit messages that clearly describe the changes made.

## Deployment Process

The deployment process involves building and deploying both the backend and frontend services to Google Cloud Run. There are two main approaches to deployment: using local Docker or using Google Cloud Build directly.

### Backend Deployment (Recommended Method: Google Cloud Build)

The recommended approach is to use Google Cloud Build, which handles the Docker build process in the cloud:

1. **Build and Push the Container**:
   ```bash
   # Navigate to the backend directory
   cd /path/to/project/backend
   
   # Build the container using Google Cloud Build
   gcloud builds submit --tag gcr.io/PROJECT_ID/podcast-backend
   ```

2. **Deploy to Cloud Run**:
   ```bash
   # Deploy the container to Cloud Run
   gcloud run deploy podcast-backend \
     --image gcr.io/PROJECT_ID/podcast-backend:latest \
     --region REGION \
     --platform managed \
     --allow-unauthenticated
   ```

3. **Environment Variables**: 
   - Key environment variables are set in the Dockerfile and during deployment
   - The service account credentials are included in the build
   - Additional environment variables can be set during deployment with `--set-env-vars`

### Backend Deployment (Alternative: Local Docker)

If you prefer to build locally first (requires Docker installed):

1. **Build the Container Locally**:
   ```bash
   # Navigate to the backend directory
   cd /path/to/project/backend
   
   # Build the Docker image
   docker build -t gcr.io/PROJECT_ID/podcast-backend .
   
   # Push to Google Container Registry
   docker push gcr.io/PROJECT_ID/podcast-backend
   ```

2. **Deploy to Cloud Run**: Same as in the recommended method.

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
     --region REGION \
     --platform managed \
     --allow-unauthenticated
   ```

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
- Updated the Gemini model from `gemini-2.5-pro-exp-03-25` to `gemini-2.0-flash` to avoid rate limit issues
- Updated the Text-to-Speech voice model from `en-US-Chirp3-HD-Orus` to `en-US-Chirp3-HD-Leda` for improved audio quality
- Fixed an issue with the Google Cloud Storage bucket naming
- Updated the frontend to use the production backend URL
- Improved error handling for API calls
- Enhanced podcast source management with the implementation of source discovery and source-guided search
- Improved audio player with automatic playback when clicking "Play Episode" button
- Enhanced episode creation date display to show both relative time (e.g., "2 mins ago") and full date-time information 