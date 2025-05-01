import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { DecodedIdToken } from 'firebase-admin/auth';

// Extend the Express Request interface to include our custom user property
declare global {
  namespace Express {
    interface Request {
      user?: DecodedIdToken; // This will hold the decoded token payload
      userId?: string;       // Convenience property for the user ID (uid)
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  console.log('Authentication temporarily disabled - bypassing token check');
  
  // Temporarily set a mock userId to bypass ownership checks in routes
  // Using a constant ID that will be consistent across requests
  req.userId = "temp-user-no-auth";
  
  // Always proceed to the next middleware or route handler
  next();
  
  // Original authentication code commented out:
  /*
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    console.log('Authentication failed: No token provided.');
    return res.status(401).json({ error: 'Authentication required: No token provided.' });
  }

  try {
    // Verify the ID token using Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log(`Token verified successfully for user ID: ${decodedToken.uid}`);

    // Attach the decoded token and user ID to the request object
    req.user = decodedToken;
    req.userId = decodedToken.uid;

    // Proceed to the next middleware or route handler
    next();
  } catch (error: any) {
    console.error('Authentication failed: Invalid token.', error);
    // Handle specific errors if needed (e.g., token expired)
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Authentication failed: Token expired.' });
    }
    return res.status(403).json({ error: 'Authentication failed: Invalid token.' });
  }
  */
}; 