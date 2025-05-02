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
  // Log all cookies and headers for debugging
  console.log('Auth middleware - All cookies:', req.cookies);
  console.log('Auth middleware - Headers:', {
    origin: req.headers.origin,
    referer: req.headers.referer,
    'user-agent': req.headers['user-agent'],
    cookie: req.headers.cookie,
    'x-user-email': req.headers['x-user-email']
  });
  
  // Try to get email from either cookie or header
  const userEmailCookie = req.cookies?.userEmail;
  const userEmailHeader = req.headers['x-user-email'] as string;
  const userEmail = userEmailCookie || userEmailHeader;
  
  // If no email found, user is not authenticated
  if (!userEmail) {
    console.log('Authentication failed: No email cookie or header found');
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  
  // Attach email to request object as userId
  req.userId = userEmail;
  console.log(`User authenticated with email: ${userEmail} (via ${userEmailCookie ? 'cookie' : 'header'})`);
  
  // Proceed to the next middleware or route handler
  next();
};

// Optional version: Tries to authenticate, sets req.userId if successful, but calls next() regardless.
export const authenticateTokenOptional = async (req: Request, res: Response, next: NextFunction) => {
  // Log all cookies and headers for debugging
  console.log('Optional Auth middleware - All cookies:', req.cookies);
  console.log('Optional Auth middleware - Headers:', {
    origin: req.headers.origin,
    referer: req.headers.referer,
    'user-agent': req.headers['user-agent'],
    cookie: req.headers.cookie,
    'x-user-email': req.headers['x-user-email']
  });

  // Try to get email from either cookie or header
  const userEmailCookie = req.cookies?.userEmail;
  const userEmailHeader = req.headers['x-user-email'] as string;
  const userEmail = userEmailCookie || userEmailHeader;

  // If email is found, attach it to the request object
  if (userEmail) {
    req.userId = userEmail;
    console.log(`Optional Auth: User authenticated with email: ${userEmail} (via ${userEmailCookie ? 'cookie' : 'header'})`);
  } else {
    console.log('Optional Auth: No email cookie or header found. Proceeding as anonymous.');
  }

  // Always proceed to the next middleware or route handler
  next();
}; 