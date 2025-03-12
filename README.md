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

### Phase 5 (Planned)
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
    name: 'en-US-Chirp3-HD-Orus', // Using Chirp3 HD voice for high-quality, natural-sounding audio
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
The system has been upgraded to use Google's Chirp3 HD voice model, which provides significantly improved audio quality compared to the previous Neural2 voice. Key improvements include:

- More natural-sounding narration with better intonation and rhythm
- Higher definition audio quality for improved listening experience
- Optimized speaking rate for better comprehension
- Removal of unnecessary SSML gender parameter for simplified configuration
- Better handling of pauses and emphasis in the generated content

### Content Generation Optimization
The Gemini prompt has been refined to generate content that is specifically optimized for audio narration:

- Content is now structured with shorter, simpler sentences that are easier to follow when listened to
- The prompt emphasizes natural pacing and rhythm suitable for spoken delivery
- Generated content maintains better continuity with previous episodes
- The system now produces more child-friendly content with appropriate vocabulary
- Episode structure includes clear beginnings and endings for better audio flow

### Delete Functionality
The system now includes the ability to delete podcasts and episodes:

- **Podcast Deletion**: Users can delete entire podcasts, which automatically removes all associated episodes and audio files from both the database and storage.
- **Episode Deletion**: Individual episodes can be deleted, removing both the database entry and the associated audio file.
- **User Interface**: Delete buttons are provided in both the podcast list and episode views, with confirmation dialogs to prevent accidental deletion.
- **Cascading Deletes**: When a podcast is deleted, all its episodes and audio files are automatically removed to prevent orphaned data.

These improvements provide users with complete control over their content, allowing them to manage their podcasts more effectively. 