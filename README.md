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

## Deployment

### Backend Deployment
```bash
cd /Users/garen/Desktop/GCPG/backend && gcloud builds submit --tag gcr.io/gcpg-452703/podcast-backend && gcloud run deploy podcast-backend --image gcr.io/gcpg-452703/podcast-backend --platform managed --region us-west1 --allow-unauthenticated
```

### Frontend Deployment
```bash
cd /Users/garen/Desktop/GCPG/frontend && gcloud builds submit --tag gcr.io/gcpg-452703/podcast-frontend && gcloud run deploy podcast-frontend --image gcr.io/gcpg-452703/podcast-frontend --platform managed --region us-west1 --allow-unauthenticated
```

## Service URLs
- Frontend: https://podcast-frontend-827681017824.us-west1.run.app
- Backend: https://podcast-backend-827681017824.us-west1.run.app

## Development Phases

### Phase 1 (Completed)
- Basic webapp with hardcoded podcast and episodes
- "Timmy the T-Rex and his adventures" as demo podcast
- Text-only episodes, no audio playback

### Phase 2 (Completed)
- Integration with Gemini API for generating additional episodes
- Using prior episodes as context for future episodes
- Episodes remain text-only

### Phase 3 (Completed)
- Allow creation of new podcasts by users
- Allow custom prompting for podcast generation
- No authentication or login required

### Phase 4 (Completed)
- Introduce audio playback using Google Text-to-Speech API
- Display audio URLs for direct access
- Implement custom audio player component
- Optimize voice configuration using Chirp3 HD voice for natural-sounding narration
- Enhance Gemini prompts for better audio content generation

### Phase 5 (Completed)
- Integrate web search functionality using Gemini API's grounding capability
- Add toggle for enabling/disabling web search at podcast creation
- Implement intelligent three-stage search process for relevant information retrieval
- Display and attribution of sources for web search enabled episodes
- Enhanced prompt engineering for integrating search results into episode content

### Phase 6 (Planned)
- Introduce user authentication using Google Account login
- Restrict podcast visibility to creators
- Complete user flow: Authentication → Podcasts List → Episodes
- Add support for custom voice selection
- Implement batch processing for audio generation

## Configuration

### Environment Variables
The backend requires the following environment variables:
- `PORT`: Server port (default: 8080)
- `GOOGLE_CLOUD_PROJECT`: Google Cloud project ID
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account key file
- `GEMINI_API_KEY`: API key for Google Gemini

### Service Account
The application uses a service account with the following permissions:
- Firestore: Read/Write
- Cloud Storage: Admin
- Text-to-Speech: Client

## Technical Implementation Details

### Text-to-Speech Implementation
```typescript
// Configure the request
const request = {
  input: { text },
  voice: {
    languageCode: 'en-US',
    name: 'en-US-Chirp3-HD-Leda', // Using the newest Chirp3 HD Leda voice for even more natural sound
  },
  audioConfig: { 
    audioEncoding: 'MP3',
    speakingRate: 1.0, // Natural speaking rate
    pitch: 0.0,        // Default pitch
    volumeGainDb: 0,    // Default volume
    effectsProfileId: ['headphone-class-device'], // Optimize for headphones
  },
};
```

### Gemini Prompt Optimization
The system uses an optimized prompt for the Gemini LLM to generate content specifically designed for audio narration. Key features:

- Generates content with natural pacing and rhythm suitable for spoken delivery
- Creates short, simple sentences that are easy to follow when listened to
- Maintains continuity with previous episodes for a coherent listening experience
- Optimizes for child-friendly content with appropriate vocabulary and themes
- Structures content with clear beginnings and endings for better audio flow
- Strategic use of punctuation (periods, ellipses, commas, and hyphens) to enhance dramatic effect and create natural pauses

### Docker Configuration
The application uses multi-stage Docker builds for both frontend and backend to minimize image size and improve security.

#### Backend Dockerfile
- Build stage: Compiles TypeScript to JavaScript
- Production stage: Runs the compiled JavaScript with minimal dependencies
- Includes service account key for authentication

#### Frontend Dockerfile
- Build stage: Builds the React application with Vite
- Production stage: Serves the static files using Nginx
- Custom Nginx configuration for SPA routing

## Known Issues and Limitations

1. The service account key is included in the Docker image, which is not ideal for production security. In a more secure setup, it would use Google Cloud Run's built-in service account integration.

2. There's no rate limiting or quota management for the AI generation features, which could lead to excessive API usage.

3. The audio generation process happens synchronously, which can cause timeouts for long episodes. A future improvement would be to implement asynchronous processing with webhooks.

4. The frontend doesn't implement caching for API responses, which could improve performance.

## Future Enhancements (Beyond Phase 5)

1. Implement podcast RSS feed generation for compatibility with podcast platforms
2. Add support for custom voice selection
3. Implement batch processing for audio generation
4. Add analytics for tracking podcast and episode popularity
5. Implement social sharing features
6. Add support for podcast artwork/images
7. Implement premium features with payment integration

## Recent Improvements

### Audio Quality Enhancements
The system has been upgraded to use Google's newest Chirp3 HD Leda voice model (en-US-Chirp3-HD-Leda), which provides significantly improved audio quality compared to the previous voice model. Key improvements include:

- More natural-sounding narration with better intonation and rhythm
- Higher definition audio quality for improved listening experience
- Optimized speaking rate for better comprehension
- Better handling of pauses and emphasis in the generated content
- Enhanced clarity and expressiveness for a more engaging listening experience

### Content Generation Optimization
The Gemini prompt has been refined to generate content that is specifically optimized for audio narration:

- Content is now structured with shorter, simpler sentences that are easier to follow when listened to
- The prompt emphasizes natural pacing and rhythm suitable for spoken delivery
- Generated content maintains better continuity with previous episodes
- Enhanced use of punctuation for dramatic storytelling effects:
  - Strategic use of periods (.) for definitive stops that create impact
  - Use of ellipses (...) for suspense, trailing thoughts, or to indicate pauses
  - Proper use of commas (,) to control pacing and create natural speech rhythms
  - Use of hyphens (-) to indicate interruptions or sudden changes
- The system now produces more child-friendly content with appropriate vocabulary
- Episode structure includes clear beginnings and endings for better audio flow

### Delete Functionality
The system now includes the ability to delete podcasts and episodes:

- **Podcast Deletion**: Users can delete entire podcasts, which automatically removes all associated episodes and audio files from both the database and storage.
- **Episode Deletion**: Individual episodes can be deleted, removing both the database entry and the associated audio file.
- **User Interface**: Delete buttons are provided in both the podcast list and episode views, with confirmation dialogs to prevent accidental deletion.
- **Cascading Deletes**: When a podcast is deleted, all its episodes and audio files are automatically removed to prevent orphaned data.

These improvements provide users with complete control over their content, allowing them to manage their podcasts more effectively.

### Episode Length Customization
The system now supports customizable episode lengths:

- **Prompt-Based Configuration**: Users can specify the desired episode length in the podcast prompt using phrases like "episode length: 3 minutes" or "episode duration: 300 words"
- **Default Length**: If no length is specified, episodes default to 2 minutes (approximately 300 words)
- **Word-Based Measurement**: The system now focuses on word count rather than character count for more natural-sounding episodes
- **Flexible Options**: Supports both minute-based and word-based specifications
- **User Guidance**: The podcast creation form includes tips on how to specify episode length

This feature gives users more control over their podcast content, allowing them to create episodes that match their specific needs and preferences.

### Audio Processing for Longer Content
The system now supports longer podcast episodes through intelligent text chunking:

- **Smart Audio Chunking**: Automatically splits long text content that exceeds the Text-to-Speech API's 5000-byte limit into manageable chunks
- **Sentence-Aware Splitting**: Preserves sentence integrity when splitting content to maintain natural flow
- **Seamless Audio Stitching**: Combines generated audio chunks into a single cohesive MP3 file
- **Optimized Chunk Size**: Uses a conservative 4500-byte limit per chunk to ensure reliability
- **Transparent Processing**: Logs detailed information about chunk sizes and processing for troubleshooting

This improvement allows for creation of longer episodes (such as 10-minute podcasts) without audio generation failures.

### Regenerate Audio Capability
A new feature has been added to regenerate audio for existing episodes:

- **On-Demand Audio Regeneration**: Users can regenerate audio for any episode via a menu option
- **Error Recovery**: Provides a solution for episodes where audio generation initially failed
- **Voice Model Updates**: Allows updating existing episodes with improved voice models as they become available
- **Audio Quality Improvements**: Episodes can be refreshed with the latest audio generation settings
- **User Interface Integration**: Accessible directly from the episode menu with clear status indicators

### Enhanced Web Search Intelligence
The web search-driven podcast generation has been improved to better respect format specifications:

- **Podcast Format Adherence**: Strictly follows format requirements specified in the podcast description (e.g., covering exactly 2-3 topics when specified)
- **Deep Topic Coverage**: Focuses on providing in-depth coverage of fewer topics rather than shallow coverage of many
- **Format Priority**: The system now emphasizes podcast format specifications as the highest priority requirement
- **Flexible Implementation**: Adapts to different podcast formats without hardcoded constraints

### Publication Date Integration
Web search-driven episodes now include temporal context for better relevance:

- **Date-Aware Reporting**: Includes publication dates of sources when reporting information
- **Temporal Markers**: Uses specific dates and relative time references (e.g., "yesterday", "last week") for clarity
- **Date Attribution**: Quotes now include publication dates (e.g., "The Chronicle reported on March 22nd...")
- **Recency Prioritization**: Clearly indicates when information comes from older sources
- **Listener Trust**: Enhances credibility by providing temporal context for all information

These improvements collectively enhance the podcast generation system's ability to create longer, higher-quality, format-respecting content with clear temporal context and reliable audio generation for all episode lengths.

### Adaptive Multi-Stage Research
The system now features an intelligent follow-up search capability that enhances the depth and quality of podcast content:

- **Intelligent Research Analysis**: Automatically analyzes initial search results to identify topics needing deeper investigation
- **Targeted Follow-up Searches**: Conducts specific, focused follow-up searches on identified topics
- **Prioritized Research Topics**: Uses AI to prioritize which aspects of a topic need the most additional context
- **Length-Based Research Scaling**: Automatically adjusts the depth and breadth of research based on podcast length
- **Parallel Processing**: Executes multiple follow-up searches simultaneously for efficiency
- **Comprehensive Consolidation**: Intelligently combines findings from all searches into a cohesive research document
- **Enhanced Source Diversity**: Gathers sources from multiple searches, providing a wider range of references
- **Gap Identification**: Specifically looks for information gaps, outdated data, or areas needing verification
- **Self-Directed Research**: The system determines on its own when and what follow-up searches are necessary

This improvement transforms the podcast generation process from a single-query approach to a multi-stage research project, resulting in significantly more comprehensive, nuanced, and well-sourced podcast episodes. Shorter podcasts (1-2 minutes) receive focused research with fewer follow-up queries, while longer episodes (5-10 minutes) trigger more extensive research with additional follow-up searches to ensure appropriate depth of coverage.

### TTS Compatibility Improvements
The system now features enhanced compatibility with Text-to-Speech (TTS) technology:

- **Clean Transcript Generation**: Removed speech instructions like "(pause)", "(slightly faster pace)", and "(upbeat intro music)" from generated transcripts, which were causing issues with TTS processing
- **Formatting Removal**: Eliminated formatting markers such as "**Host:**" and other markdown/formatting elements that interfered with natural speech flow
- **Metadata Separation**: Sources are now stored as metadata only and no longer appended to the transcript content, making the audio cleaner and more focused
- **Prompt Engineering**: Updated the Gemini prompts to explicitly instruct the AI to avoid speech directions and formatting, using only standard punctuation
- **Plain Text Emphasis**: The system now generates plain text with standard punctuation only (periods, commas, question marks, etc.) for optimal TTS processing
- **Improved Audio Quality**: These changes result in more natural-sounding podcast audio without artificial pauses or formatting artifacts

These improvements significantly enhance the listening experience by ensuring that the Text-to-Speech engine receives clean, properly formatted text that can be converted accurately to speech without unexpected artifacts or interruptions.

## Development Workflow

The development process follows these steps:

1. **Code Changes**: Make changes to the codebase on the local development machine
2. **Local Testing**: Test changes using local development servers
3. **Docker Build**: Build Docker containers for the updated services
4. **Cloud Deployment**: Deploy the containers to Google Cloud Run
5. **Verification**: Verify the changes in the production environment
6. **Documentation**: Update the README.md with details of the changes
7. **Version Control**: Commit changes to Git repository

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