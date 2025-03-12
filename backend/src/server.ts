import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { initializeFirebase } from './services/database';
import podcastRoutes from './routes/podcasts';

// Load environment variables
dotenv.config();

console.log('Starting server initialization...');

// Initialize Express app
const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

console.log(`Configured port: ${port}`);
console.log(`Environment: ${process.env.NODE_ENV}`);

// Log startup information
console.log('Starting server with configuration:', {
  PORT: port,
  NODE_ENV: process.env.NODE_ENV,
  // Log environment variables without exposing sensitive values
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Set' : 'Not set',
  GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
});

// Middleware
app.use(express.json());
app.use(cors());

// Initialize Firebase
try {
  console.log('Initializing Firebase...');
  initializeFirebase();
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Health check endpoints
app.get('/_health', (req, res) => {
  console.log('Health check received');
  res.status(200).send('OK');
});

app.get('/', (req, res) => {
  console.log('Root endpoint hit');
  res.status(200).send('Server is running');
});

// Import and use route handlers
app.use('/api/podcasts', podcastRoutes);

// Start server with error handling
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running at http://0.0.0.0:${port}`);
  console.log('Server initialization complete');
}).on('error', (error) => {
  console.error('Server error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Log unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Log uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
}); 