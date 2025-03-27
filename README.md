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

### Improved Source Attribution Display
The system now features an enhanced display for source attribution in news-based podcasts:

- **User-Friendly References**: API search URLs are now displayed as "Reference 1", "Reference 2", etc. instead of raw URLs
- **Enhanced Visual Design**: Sources section uses a cleaner, more attractive styling with bullet points and subtle hover effects
- **Flexible URL Handling**: System intelligently detects and formats different types of source URLs
- **Error Handling**: Robust error handling for malformed or unexpected URL formats
- **Mobile Responsive**: Source attribution section is fully responsive for all screen sizes

This improvement makes the source attribution section more readable and professional, enhancing the overall user experience while maintaining the important credibility that source attribution provides to news-based podcasts.

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

The deployment process involves building and deploying both the backend and frontend services to Google Cloud Run. The process is as follows:

1. **Backend Deployment**:
   - The backend code is packaged into a Docker container
   - The container is pushed to Google Container Registry
   - The container is deployed to Google Cloud Run
   - Environment variables are configured for the service

2. **Frontend Deployment**:
   - The frontend code is built using Vite
   - The built files are packaged into a Docker container with Nginx
   - The container is pushed to Google Container Registry
   - The container is deployed to Google Cloud Run

3. **Configuration Updates**:
   - The frontend is configured to use the production backend URL
   - The backend is configured with the correct environment variables
   - The backend uses the correct Google Cloud Project ID for storage buckets

4. **Troubleshooting**:
   - Logs can be viewed in Google Cloud Console
   - The backend logs show details about audio generation and API calls
   - The frontend logs show details about user interactions

### Recent Updates
- Updated the Text-to-Speech voice model from `en-US-Chirp3-HD-Orus` to `en-US-Chirp3-HD-Leda` for improved audio quality
- Fixed an issue with the Google Cloud Storage bucket naming
- Updated the frontend to use the production backend URL
- Improved error handling for API calls 
- Enhanced source display with better formatting and user-friendly references 