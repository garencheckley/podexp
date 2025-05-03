import { Request, Response, NextFunction } from 'express';

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
    referer: req.headers.referer,
    'user-agent': req.headers['user-agent'],
    'x-user-email': req.headers['x-user-email']
  });
  
  // ONLY check for X-User-Email header
  const userEmailHeader = req.headers['x-user-email'] as string;
  const userEmail = userEmailHeader;
  
  // If no email found in header, user is not authenticated
  if (!userEmail) {
    console.log('Authentication failed: No X-User-Email header found');
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  
  // Attach email to request object as userId
  req.userId = userEmail;
  console.log(`User authenticated with email: ${userEmail} (via header)`);
  
  // Proceed to the next middleware or route handler
  next();
};

// Optional version: Tries to authenticate, sets req.userId if successful, but calls next() regardless.
export const authenticateTokenOptional = async (req: Request, res: Response, next: NextFunction) => {
  // Log relevant headers for debugging
  console.log('Optional Auth middleware - Headers:', {
    origin: req.headers.origin,
    referer: req.headers.referer,
    'user-agent': req.headers['user-agent'],
    'x-user-email': req.headers['x-user-email']
  });

  // ONLY check for X-User-Email header
  const userEmailHeader = req.headers['x-user-email'] as string;
  const userEmail = userEmailHeader;

  // If email is found in header, attach it to the request object
  if (userEmail) {
    req.userId = userEmail;
    console.log(`Optional Auth: User authenticated with email: ${userEmail} (via header)`);
  } else {
    console.log('Optional Auth: No X-User-Email header found. Proceeding as anonymous.');
  }

  // Always proceed to the next middleware or route handler
  next();
}; 