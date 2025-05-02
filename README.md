# Podcast Generation System

> **Authentication Update**: A hybrid email-based authentication system (magic links via email) is now fully implemented. It uses secure HTTP-only cookies when possible, with a JavaScript localStorage/header fallback for broader compatibility. See `AUTH_README.md` for details.

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
- Provides RESTful API endpoints for the frontend, protected by the email authentication system.

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
- **Authentication**: (Planned for Phase 5) Google Identity Platform

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
  bulletPoints?: string[];
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
- `POST /api/podcasts/:podcastId/generate-bullet-points` - Generate bullet points for an episode

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
- Web search is always enabled for all podcasts to provide current, fact-based content
- Automatic attribution of sources in episode content
- Display of sources with clickable links in the episode transcript
- Particularly valuable for news, current events, and informational podcasts

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
- **Enhanced History**: Analyzes the last 15 episodes (increased from 5) for better detection of long-term repetition.
- **Automated Improvement**: When necessary, automatically rewrites content to increase differentiation.
  - **Refined Prompting**: The rewrite prompt now explicitly instructs the AI to change the *analytical frame* or *perspective*, rather than just swapping facts, to ensure meaningful differentiation.
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

### Pre-Analysis Clustering for Enhanced Topic Focus

The system now implements an intelligent pre-analysis clustering algorithm that groups similar search results before performing deep dive research. This approach dramatically improves the focus and efficiency of the research process.

#### Key Components

##### 1. Content Embedding Generation
- **Vector Representation**: Uses Google's Vertex AI text-embedding-004 model to generate high-dimensional vector representations of search results
- **Semantic Understanding**: Captures the meaning and context of each potential topic, not just keywords
- **Batch Processing**: Efficiently processes multiple search results in optimal batch sizes
- **Custom Configuration**: Configurable project ID and region for deployment flexibility

##### 2. K-Means Clustering Algorithm
- **Automatic Cluster Detection**: Intelligently determines the appropriate number of clusters based on content volume
- **Seed Consistency**: Uses consistent random seeds for reproducible clustering
- **Noise Filtering**: Identifies and handles outlier content that doesn't fit well into clusters
- **Parallel Processing**: Performs clustering efficiently even on large volumes of search results

##### 3. AI-Powered Cluster Summarization
- **Theme Extraction**: Identifies the central theme that ties together topics within each cluster
- **Concise Titling**: Generates concise, accurate titles that represent the core concept of each cluster
- **Relevance Context**: Incorporates original relevance scores when summarizing to maintain priority information
- **Fast Model Integration**: Uses efficient models for summarization to minimize latency

##### 4. Prioritization Integration
- **Cluster-Based Prioritization**: Shifts the focus from individual topics to thematic clusters
- **Original Context Preservation**: Maintains links to original topics for traceability
- **Cross-Topic Analysis**: Enables analysis across related topics within the same cluster
- **Smart Resource Allocation**: Focuses computational resources on truly distinct content areas

#### Benefits

- **Reduced Redundancy**: Eliminates duplicate research effort on highly similar topics
- **Thematic Coherence**: Creates more coherent episode segments focused on distinct themes
- **Research Efficiency**: Significantly improves research efficiency by consolidating similar content
- **Broader Perspective**: Enables exploring diverse aspects of a theme rather than repetitive variants
- **Resource Optimization**: Concentrates computational resources on truly unique content areas

The Pre-Analysis Clustering implementation draws inspiration from techniques used in production news systems to handle high volumes of similar content, ensuring that podcast episodes maintain focus on distinct, valuable themes rather than variations of the same stories.

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

### Enhanced Research & Synthesis Strategy

The system now implements an optimized research and synthesis strategy that significantly improves information preservation throughout the content generation pipeline:

#### Core Improvements
- **Complete Context Preservation**: Removed character limits when passing research content between processing steps, allowing complete information to flow through the entire pipeline
- **Model-Task Optimization**: Uses powerful models (gemini-2.5-pro) for all complex analytical tasks including insight extraction, deep dive query generation, and content synthesis
- **Enhanced Contrasting Viewpoints**: Improved identification of alternative perspectives by using more sophisticated query generation and passing more complete context
- **Layered Research Integrity**: Preserves complete information from each research layer, ensuring the synthesis process has access to all discovered insights and nuances

#### Technical Implementation
- **Full Information Flow**: Research content is now passed in its entirety between pipeline stages rather than being truncated
- **Deeper Insight Extraction**: Using the more capable model for insight extraction provides higher quality analysis of research findings
- **Sophisticated Search Query Generation**: Intelligent, AI-generated queries specifically designed to find expert analysis and contrasting viewpoints
- **Comprehensive Synthesis**: Final content generation receives the full research context, enabling deeper and more nuanced analysis

#### Benefits
- **Preservation of Details**: Critical details and nuances are no longer lost in summarization
- **Deeper Analysis**: More complete context enables the generation of richer, more substantive analysis
- **Better Contrasting Viewpoints**: Improved ability to find and incorporate alternative perspectives
- **Enhanced Content Quality**: The end result is podcast content with greater depth, analytical rigor, and balanced perspectives

This enhancement directly addresses the issue of information loss that previously occurred when passing only small summaries between stages of the content generation pipeline. By ensuring that the full context and details are preserved throughout, the system now produces more insightful, comprehensive, and valuable podcast content.

### Episode Generation Logging and Dashboard

The system now features comprehensive logging and visualization of the episode generation process, providing unprecedented transparency into how AI creates podcast content:

#### Key Features

##### 1. Detailed Generation Logs
- **Multi-Stage Tracking**: Captures detailed information at each stage of the generation process:
  - Episode Analysis: Previous topics and themes analyzed
  - Initial Search: Search queries used and topics discovered
  - Topic Clustering: How similar topics are grouped into thematic clusters
  - Topic Prioritization: Decision process for selecting topics to focus on
  - Deep Research: Layered research from surface to in-depth analysis
  - Content Generation: How the final script is created and structured
  - Audio Generation: Conversion of text to natural-sounding speech
- **Decision Documentation**: Records specific decisions made at key points with reasoning
- **Performance Metrics**: Tracks processing time for each stage to identify bottlenecks
- **Source Attribution**: Clearly documents which sources influenced which content sections

##### 2. Interactive Timeline Dashboard
- **Visual Process Map**: Presents the generation process as an interactive timeline
- **Stage-by-Stage Breakdown**: Expandable sections for each generation stage
- **Time Distribution**: Visual representation of time spent in each stage
- **Decision Points**: Highlights key decisions made during generation

##### 3. Detailed Stage Views
- **Topic Selection Insights**: Shows which topics were considered, selected, and why
- **Clustering Visualization**: Displays how related topics were grouped
- **Prioritization Reasoning**: Explains why certain topics received deeper coverage
- **Research Path**: Shows the progression from initial to deep research
- **Content Creation Logic**: Explains how the script was structured and composed

##### 4. Implementation Details
- **Structured Logging**: Comprehensive `EpisodeGenerationLog` data structure captures all aspects of generation
- **Tabbed Interface**: Easy access to logs via a tabbed interface in the episode view
- **Persistent Storage**: Generation logs stored alongside episodes for future reference
- **Responsive Design**: Dashboard adapts to different screen sizes for mobile and desktop viewing

#### Benefits
- **Transparency**: Clear visibility into the AI's decision-making process
- **Debugging**: Easier identification of issues in topic selection or research
- **Trust**: Better understanding of how content is generated and sourced
- **Learning**: Insights into how content evolves through the generation pipeline
- **Quality Improvements**: Better ability to diagnose and address content quality issues

This feature provides podcast creators with unprecedented insight into the AI generation process, helping them understand how topics are selected, researched, and developed into podcast episodes. It transforms the "black box" of AI content generation into a transparent, explainable process that builds trust and enables continuous improvement.

### Core Generation Prompts Refinement

The system now implements sophisticated prompt engineering to enhance podcast content quality and reduce filler material. This improvement addresses the core issues of "fluff" content and insufficient analytical depth.

#### Key Improvements

##### 1. Anti-Fluff Constraints
- **Explicit Prohibition**: Added specific instructions against common filler phrases like "it's important to note", "as we know", etc.
- **Evidence Requirements**: Prompts now require supporting analytical points with specific evidence
- **Redundancy Detection**: Added guidelines to avoid repetitive information and redundant statements
- **Content Focus**: Enhanced focus on substantive information over general statements

##### 2. Analytical Type Specification
- **Detailed Analysis Types**: Explicitly specified different types of analysis required:
  - Causal Analysis: Explaining causes and effects
  - Comparative Analysis: Contrasting different viewpoints or approaches
  - Contextual Analysis: Providing historical, social or political context
  - Implication Analysis: Discussing consequences and impacts
  - Pattern Identification: Recognizing trends and recurring elements
- **Structured Analytical Frameworks**: Provided clear templates for different analytical approaches

##### 3. Host Persona Enhancement
- **Consistent Character**: Reinforced the desired host personality (knowledgeable, insightful, confident)
- **Analytical Mindset**: Emphasized synthesizing complex information with clear analysis
- **Audience-Focused**: Strengthened focus on helping listeners understand both facts and significance
- **Natural Authority**: Enhanced guidance for authoritative but conversational tone

##### 4. Integration Prompts Revision
- **Insightful Script Focus**: Rewritten integration prompts to focus on creating insightful podcast scripts rather than just combining research
- **Cross-Topic Synthesis**: Added instructions to identify patterns and connections across different topics
- **Analytical Commentary**: Enhanced requirements for providing thoughtful commentary and interpretation
- **Narrative Structure**: Improved guidelines for creating a compelling narrative flow with analytical depth

#### Implementation Details
- Updated three key prompts in the content generation pipeline:
  1. `generateIntegratedContent`: Rewritten to focus on analytical content with specific analysis types
  2. `synthesizeLayeredResearch`: Enhanced to require analytical elements and prohibit filler phrases
  3. `createNarrativeStructure`: Modified to include analytical section types focusing on insights

#### Benefits
- **Higher Content Quality**: More substantive, insightful podcast content
- **Reduced Filler**: Significantly less "fluff" and more valuable information
- **Enhanced Depth**: Deeper exploration of topics with meaningful analysis
- **Improved Listening Experience**: More engaging, educational content for audience

These improvements directly address user-reported issues with content quality, particularly focusing on reducing filler material and enhancing analytical depth in generated podcast episodes.

### Episode Analysis Optimization

The system now implements a more efficient and insightful approach to analyzing previous podcast episodes, providing better content differentiation for new episodes.

#### Consolidated Episode Analysis

Previous versions of the system analyzed each episode individually with separate Gemini API calls, which could lead to:
- Multiple potential failure points
- Inconsistent analysis between episodes
- An inability to detect patterns across episodes

The new consolidated approach:
- Analyzes all episodes together in a single Gemini API call
- Provides better cross-episode pattern recognition
- Significantly reduces API call failures
- Identifies topic frequencies more accurately across all content

#### Bullet Point Summaries

Each episode now includes 3-5 concise bullet points that summarize its key content:

- **Automatic Generation**: Bullet points are automatically created when episodes are generated
- **Content Optimization**: This approach significantly reduces the token count needed for analysis
- **Efficiency**: Episodes with bullet points use these summaries for analysis instead of full content
- **Migration**: Existing episodes can be updated with bullet points using a dedicated endpoint

#### Implementation Details

- **Episode Interface**: Added `bulletPoints?: string[]` field to the Episode interface
- **Bullet Point Generation**: New function generates 3-5 concise summaries per episode
- **Analysis Flexibility**: Episode analyzer accepts episodes with either content or bullet points
- **Migration Endpoint**: Added `POST /api/podcasts/:podcastId/generate-bullet-points` to handle existing episodes

#### Benefits

- **Improved Reliability**: More robust episode analysis with fewer API failures
- **Better Insights**: Improved ability to identify patterns and themes across episodes
- **Enhanced Differentiation**: New episodes are more effectively differentiated from previous content
- **Resource Efficiency**: Reduced token usage and API costs through bullet point optimization
- **Faster Analysis**: More efficient processing of previous episode content

This feature enhances the core episode generation process by making the analysis of previous episodes more reliable, efficient, and insightful, leading to better differentiated content in new episodes.

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
     --region us-west1 \
     --platform managed \
     --allow-unauthenticated
   ```

   **IMPORTANT**: Always deploy to the `us-west1` region for consistency. Do not use other regions.

3. **Firestore Indexes**: 
   - Before the first deployment, ensure Firestore indexes are created:
   ```
   # Deploy required Firestore indexes
   ./deploy-indexes.sh
   ```
   - Indexes are critical for queries that combine filtering and ordering
   - Without proper indexes, certain queries will fail with FAILED_PRECONDITION errors

4. **Environment Variables**: 
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