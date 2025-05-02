# Simplified Email-Based Authentication Plan

**Goal:** Implement the simplest possible email-based authentication system with minimal overhead.

## Phase 1: Backend Implementation

1. **Streamlined Login System:**
   - Create a single `loginTokens` collection in Firestore with schema:
     ```typescript
     interface LoginToken {
       token: string;        // UUID for the login token
       email: string;        // Email address as the user identifier
       createdAt: Timestamp; // When the token was created
     }
     ```
   - No expiration for tokens (simplifies logic)
   - No separate user records (just use email directly)

2. **Login Request Endpoint:**
   - Create `POST /api/auth/login-request` endpoint that:
     - Accepts an email address in the request body
     - Generates a unique login token (UUID v4)
     - Stores token in Firestore with the email
     - Sends an email with a login link: `https://yourapp.com/auth/verify?token=TOKEN`

3. **Email Service:**
   - Use the simplest email sending service available (Nodemailer or SendGrid)
   - Create minimal email template with just the login link

4. **Token Verification Endpoint:**
   - Create `GET /api/auth/verify` endpoint that:
     - Accepts just the `token` query parameter
     - Looks up the token in Firestore to get email
     - Sets a plain cookie with the user's email
     - Redirects to the main application
     - Optionally: Delete the token after use

5. **Simplified Authentication Middleware:**
   - Create lightweight middleware that:
     - Reads the email cookie
     - Attaches the email to the request object (e.g., `req.userId`)
     - No database validation - just trust the cookie

6. **Simplified Logout:**
   - Create `GET /api/auth/logout` endpoint that:
     - Clears the cookie
     - Redirects to login page

7. **Protect Endpoints:**
   - Apply the simple middleware to routes that need protection
   - Update query filters to use email as userId

## Phase 2: Frontend Implementation

1. **Simple Login Form:**
   - Single input field for email
   - Submit to `/api/auth/login-request`
   - Show "Check your email" message

2. **Verification Handling:**
   - No special handling needed - backend handles verification and sets cookie

3. **Basic Session Check:**
   - On app load, check if email cookie exists
   - If it exists, user is logged in
   - Display UI based on this simple check

4. **Logout Link:**
   - Simple link to `/api/auth/logout` (no form submission needed)

## Phase 3: Database Updates

1. **Podcast Ownership and Visibility:**
   - Update Podcast schema:
     ```typescript
     interface Podcast {
       // existing fields...
       ownerEmail: string;       // Email of the podcast creator
       visibility: "public" | "private"; // Default to "private"
     }
     ```
   - All new podcasts are created as "private" by default
   - Private podcasts are only visible to the owner
   - Public podcasts are visible to any logged-in user

2. **Migration:**
   - Simple script to add default owner email and visibility to existing podcasts

3. **Access Control Logic:**
   - Modify podcast listing endpoint to include:
     - All podcasts where `ownerEmail` matches the user's email
     - All podcasts where `visibility` is "public"
   - For podcast operations (create, update, delete):
     - Only allow if the user's email matches `ownerEmail`
   - For visibility changes:
     - Only the owner can toggle a podcast between private/public
     - Verify `ownerEmail` matches user's email before allowing visibility changes
   - For viewing a specific podcast:
     - Allow if the user's email matches `ownerEmail`
     - Allow if the podcast's `visibility` is "public"

4. **Visibility Toggle:**
   - Add a simple toggle in the podcast edit UI to switch between public/private
   - Toggle only appears for the podcast owner
   - Add endpoint to update visibility setting with owner verification

## Implementation Notes

1. **Extreme Simplifications:**
   - No password or account management
   - No token expiration
   - Email-in-cookie approach (simple but functional)
   - No session tracking or user records
   - GET request for logout (just a simple link)

2. **Security Considerations:**
   - This approach prioritizes simplicity over security
   - Cookie can be tampered with (but low risk for this application)
   - No CSRF protection (not needed for this use case)
   - No rate limiting (could be added if abuse becomes a problem)

3. **Multiple Device Support:**
   - Each device maintains its own cookie
   - No centralized session management
   - Login state persists until user clears cookies or logs out

4. **Visibility Model:**
   - Binary visibility option (private/public) for simplicity
   - New podcasts are private by default
   - Only the owner can change visibility settings
   - Owner always has full access to their podcasts
   - All authenticated users can see public podcasts
   - No anonymous access - must be logged in to see even public podcasts

This simplified approach eliminates unnecessary complexity while still achieving the core goals of user authentication and content visibility control. 

---

## Implementation Update: Hybrid Authentication

We've successfully implemented the email-based authentication system with several enhancements to ensure it works reliably across different environments.

### Key Accomplishments

1. **Backend Implementation**
   - Created email-based authentication endpoints `/api/auth/login-request` and `/api/auth/verify`
   - Implemented token generation and verification using Firestore
   - Set up email sending using Nodemailer with SendGrid
   - Added middleware for authenticating requests based on cookies or headers
   - Modified podcast queries to respect ownership and visibility settings

2. **Frontend Implementation**
   - Built login page with email input form
   - Created token verification page
   - Implemented authentication context to manage auth state
   - Added protected routes for securing content
   - Updated API client to support hybrid authentication

3. **Hybrid Authentication Approach**
   - Identified issues with HTTP-only cookies not working consistently across environments
   - Implemented a dual approach that tries both:
     - **Primary**: HTTP-only cookies for best security
     - **Fallback**: JavaScript-based authentication with localStorage + headers
   - Modified token verification to optionally return JSON instead of setting cookies
   - Updated API client to automatically append authentication headers when cookies aren't available

4. **CORS and Cookie Configuration**
   - Enhanced CORS settings to allow cookies and necessary headers
   - Configured cookies with appropriate security settings:
     - `secure: true` for HTTPS-only
     - `sameSite: 'none'` to work across domains
     - `path: '/'` for site-wide access
   - Added comprehensive logging for debugging authentication issues

5. **Database Updates**
   - Added `ownerEmail` and `visibility` fields to Podcast schema
   - Created a migration script and updated existing podcasts
   - Implemented visibility toggle component
   - Updated podcast listing to show only owned or public podcasts

### Benefits

The hybrid authentication approach provides several advantages:
- Works reliably across different environments and browsers
- Maintains good security with HTTP-only cookies when supported
- Falls back to header-based auth when cookies don't work
- Provides a seamless user experience without complexity of password management

This implementation successfully meets our requirements for simple user authentication while ensuring the system works consistently across different deployment environments. 