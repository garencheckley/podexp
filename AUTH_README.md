# Authentication System README

This document details the email-based hybrid authentication system implemented in the Podcast Generator.

## Overview

The system uses a "magic link" approach for passwordless authentication:
1.  User enters their email address on the frontend login page.
2.  Frontend calls backend `/api/auth/login-request` with the email.
3.  Backend generates a unique, short-lived token, stores it in Firestore (`loginTokens` collection) associated with the email.
4.  Backend sends an email (via SendGrid) to the user containing a verification link like `[FRONTEND_URL]/auth/verify?token=[TOKEN]`.
5.  User clicks the link in their email.
6.  Frontend `/auth/verify` page loads.
7.  **Hybrid Verification:**
    *   The frontend `VerifyToken` component *first* attempts to verify the token directly with the backend by making a `fetch` request to `/api/auth/verify?token=[TOKEN]` with an `Accept: application/json` header.
    *   If this succeeds (backend finds token, deletes it, returns JSON `{ success: true, email: ... }`), the frontend stores the user's email in `localStorage`.
    *   If the direct fetch fails *or* if JavaScript is disabled/fails, the user is effectively relying on the original redirect behavior.
8.  **Backend Verification (Cookie Attempt):** The backend `/api/auth/verify` endpoint receives the token:
    *   Finds the token in Firestore, retrieves the email, deletes the token.
    *   **If called without `Accept: application/json` (direct link click):** Sets a secure, HTTP-only cookie named `userEmail` containing the user's email.
    *   Redirects the user back to the frontend homepage (`/`).
9.  **Subsequent Requests:**
    *   The frontend API service (`api.ts`) automatically includes credentials (`credentials: 'include'`) for all requests, attempting to send the `userEmail` cookie.
    *   As a fallback, it also checks `localStorage` for the email and adds it as an `X-User-Email` header to all requests.
10. **Backend Middleware (`authenticateToken`):**
    *   Checks for the presence of `req.cookies.userEmail`.
    *   If not found, checks for the presence of `req.headers['x-user-email']`.
    *   If either is found, extracts the email and attaches it to `req.userId`.
    *   If neither is found, rejects the request with a 401/403 error.

## Rationale for Hybrid Approach

Initial implementation relied solely on HTTP-only cookies (`Secure`, `SameSite=None`). However, consistent delivery and usage of cross-domain cookies proved unreliable across different browsers and potential network configurations between the frontend (`podcast-frontend-*.run.app`) and backend (`podcast-backend-*.run.app`) services hosted on Cloud Run.

The hybrid approach was adopted:
-   **Security Priority:** It *attempts* to use secure, HTTP-only cookies first, which is the most secure method against XSS attacks.
-   **Reliability Fallback:** If cookies fail to be set or sent back by the browser, the JavaScript-based mechanism (localStorage + `X-User-Email` header) acts as a fallback, ensuring the user can still be authenticated.
-   **Simplicity:** Avoids complex session management or JWTs, keeping the system relatively simple.

## Key Components

-   **Backend:**
    -   `backend/src/routes/auth.ts`: Handles `/login-request`, `/verify`, `/logout`.
    -   `backend/src/middleware/auth.ts`: `authenticateToken` middleware checks cookie/header.
    -   `backend/src/services/database.ts`: Stores/retrieves `loginTokens`.
    -   Nodemailer + SendGrid: Used for sending emails (configured in `auth.ts`).
-   **Frontend:**
    -   `frontend/src/components/Login.tsx`: Email input form.
    -   `frontend/src/components/VerifyToken.tsx`: Handles the verification flow after link click, attempts JSON verification.
    -   `frontend/src/services/api.ts`: Contains `requestLogin`, `verifyToken`, `logout`, `checkAuthentication`, and helper `addAuthHeaders` to include cookie/header.
    -   `frontend/src/contexts/AuthContext.tsx`: Manages authentication state (`isAuthenticated`).
    -   `frontend/src/components/ProtectedRoute.tsx`: Protects routes based on `isAuthenticated` state.

## Configuration

-   **CORS (`backend/src/server.ts`):** Configured to allow requests from the frontend origin (`process.env.FRONTEND_URL` or default), allow credentials (`credentials: true`), and specific methods/headers (including `Cookie`, `X-User-Email`).
-   **Cookies (`backend/src/routes/auth.ts`):**
    -   `httpOnly: true`: Prevents JavaScript access.
    -   `secure: true`: Sent only over HTTPS.
    -   `sameSite: 'none'`: Required for cross-domain usage (needs `secure: true`).
    -   `maxAge`: Set for session duration (e.g., 30 days).
    -   `path: '/'`: Accessible site-wide.
-   **localStorage (`frontend/src/services/api.ts`):** Uses key `userEmail`.
-   **Header (`frontend/src/services/api.ts` & `backend/src/middleware/auth.ts`):** Uses `X-User-Email`.

## Troubleshooting

1.  **Login email not received:**
    *   Check SendGrid activity logs.
    *   Verify SendGrid API key in `backend/src/routes/auth.ts` is correct and active.
    *   Check backend logs (`stderr`) for errors during the `/login-request` call.
2.  **Verification link fails (Invalid Token):**
    *   Check `loginTokens` collection in Firestore. Was the token created? Has it already been used/deleted?
    *   Check backend logs (`stderr`) for errors during the `/verify` call.
3.  **Login successful, but subsequent requests fail (401/403):**
    *   Check browser developer tools (Application tab) to see if `userEmail` cookie was set.
    *   Check browser developer tools (Local Storage) to see if `userEmail` was stored.
    *   Check backend `authenticateToken` middleware logs (Cloud Logging `stdout`). Is it receiving the cookie or the `X-User-Email` header? Is the email value correct?
4.  **Requests fail (500 Internal Server Error):**
    *   Check backend logs (Cloud Logging `stderr`) for the specific route that failed. Look for detailed error messages (e.g., Firestore errors, type errors).
    *   Pay special attention to `FAILED_PRECONDITION` errors from Firestore, which indicate a missing index.
5.  **Requests fail (404 Not Found for specific items after login):**
    *   Verify the authorization logic within the specific backend route handler (e.g., `GET /api/podcasts/:id`, `GET /api/podcasts/:podcastId/episodes`). Ensure it's correctly calling the database function (`getPodcast`) with the `req.userId` and handling the potential `null` return value (which signifies not found OR access denied). 