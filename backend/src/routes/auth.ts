import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import { getDb } from '../services/database';
import { authenticateTokenOptional } from '../middleware/auth';

const router = express.Router();

// Configure nodemailer with SendGrid
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false,
  auth: {
    user: 'apikey',
    pass: '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'
  }
});

// Login request endpoint
router.post('/login-request', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Generate a unique token
    const token = uuidv4();
    
    // Store in Firestore
    await getDb().collection('loginTokens').add({
      token,
      email,
      createdAt: new Date()
    });

    // Create login URL
    const baseUrl = process.env.FRONTEND_URL || 
      (process.env.NODE_ENV === 'production'
        ? 'https://podcast-frontend-827681017824.us-west1.run.app'
        : 'http://localhost:5173');
    
    const loginUrl = `${baseUrl}/auth/verify?token=${token}`;
    
    // Send email using SendGrid
    const mailOptions = {
      from: 'garencheckley@gmail.com', // This should be your verified sender
      to: email,
      subject: 'Your Login Link',
      text: `Click this link to log in: ${loginUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Login to Podcast Generator</h2>
          <p>Click the button below to log in to your account:</p>
          <a href="${loginUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            Log In
          </a>
          <p>Or copy and paste this link in your browser:</p>
          <p>${loginUrl}</p>
          <p>This link will work for 24 hours.</p>
        </div>
      `
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      res.status(200).json({ message: 'Login email sent. Check your inbox.' });
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      res.status(500).json({ error: 'Failed to send login email', details: emailError.message });
    }
  } catch (error) {
    console.error('Login request error:', error);
    res.status(500).json({ error: 'Failed to process login request' });
  }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find the token in Firestore
    const querySnapshot = await getDb()
      .collection('loginTokens')
      .where('token', '==', token)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Get the associated email
    const tokenDoc = querySnapshot.docs[0];
    const { email } = tokenDoc.data();
    
    // Delete the used token
    await tokenDoc.ref.delete();
    
    // Check if the client wants JSON (JavaScript-based auth) or cookie-based auth
    const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
    
    if (acceptsJson) {
      // Return JSON for JavaScript-based authentication
      console.log(`Returning JSON response with email: ${email} for JavaScript-based auth`);
      return res.json({ success: true, email });
    } else {
      // Set the cookie with the email for cookie-based authentication
      console.log(`Setting cookie for email: ${email} with options:`, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        secure: true,
        sameSite: 'none',
        path: '/'
      });
      
      res.cookie('userEmail', email, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: true,
        sameSite: 'none',
        path: '/'
      });

      // Redirect to the frontend
      const baseUrl = process.env.FRONTEND_URL || 
        (process.env.NODE_ENV === 'production'
          ? 'https://podcast-frontend-827681017824.us-west1.run.app'
          : 'http://localhost:5173');
      
      res.redirect(`${baseUrl}/`);
    }
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

// Logout endpoint
router.get('/logout', (req, res) => {
  // Clear the cookie
  res.clearCookie('userEmail', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/'
  });
  
  // Redirect to login page
  const baseUrl = process.env.FRONTEND_URL || 
    (process.env.NODE_ENV === 'production'
      ? 'https://podcast-frontend-827681017824.us-west1.run.app'
      : 'http://localhost:5173');
  
  res.redirect(`${baseUrl}/login`);
});

// Authentication Status Endpoint
router.get('/status', authenticateTokenOptional, (req, res) => {
  // authenticateTokenOptional attempts to set req.userId if a valid token/cookie/header exists
  if (req.userId) {
    console.log('Auth status check: User authenticated with email:', req.userId);
    res.json({ authenticated: true, email: req.userId });
  } else {
    console.log('Auth status check: User not authenticated.');
    res.json({ authenticated: false, email: null });
  }
});

export default router; 