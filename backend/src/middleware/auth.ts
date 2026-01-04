import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

// Extend the Express Request interface to include our custom user property
declare global {
  namespace Express {
    interface Request {
      userId?: string; // Will hold the user's email address
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  // Log relevant headers for debugging
  console.log('Auth middleware - Headers:', {
    origin: req.headers.origin,
    authorization: req.headers.authorization ? 'Bearer [token]' : undefined,
  });

  // Get the Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Authentication failed: No Bearer token found');
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userEmail = decodedToken.email;

    if (!userEmail) {
      console.log('Authentication failed: No email in token');
      return res.status(401).json({ error: 'Invalid token: no email found.' });
    }

    // Attach email to request object as userId
    req.userId = userEmail;
    console.log(`User authenticated with email: ${userEmail} (via Firebase token)`);

    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
};

// Optional version: Tries to authenticate, sets req.userId if successful, but calls next() regardless.
export const authenticateTokenOptional = async (req: Request, res: Response, next: NextFunction) => {
  // Log relevant headers for debugging
  console.log('Optional Auth middleware - Headers:', {
    origin: req.headers.origin,
    authorization: req.headers.authorization ? 'Bearer [token]' : undefined,
  });

  // Get the Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Optional Auth: No Bearer token found. Proceeding as anonymous.');
    return next();
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userEmail = decodedToken.email;

    if (userEmail) {
      req.userId = userEmail;
      console.log(`Optional Auth: User authenticated with email: ${userEmail} (via Firebase token)`);
    }
  } catch (error) {
    console.log('Optional Auth: Token verification failed, proceeding as anonymous:', error);
  }

  // Always proceed to the next middleware or route handler
  next();
};
