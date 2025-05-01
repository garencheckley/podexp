# Authentication Implementation Plan

**Goal:** Implement user authentication using Google Accounts, allowing users to log in, own their podcasts, and manage access.

**Phase 1: Backend Setup & Basic Protection**

1.  **Choose Provider:** Use Firebase Authentication for easier integration with Google Sign-In and backend verification.
2.  **Firebase Project Setup:**
    *   Ensure the existing Google Cloud Project is linked to a Firebase project.
    *   Enable Google Sign-In as the **only** authentication method in the Firebase console.
3.  **Backend Middleware:**
    *   Add Firebase Admin SDK to the backend (`backend/package.json`).
    *   Create authentication middleware (`backend/src/middleware/auth.ts`) that:
        *   Expects an `Authorization: Bearer <ID_TOKEN>` header in requests.
        *   Uses `admin.auth().verifyIdToken(idToken)` to verify the token sent from the frontend.
        *   Extracts the user's `uid` (Firebase User ID) from the verified token.
        *   Attaches the `uid` to the request object (e.g., `req.userId`) for downstream route handlers.
4.  **Protect Endpoints:**
    *   Apply the authentication middleware to all routes *except* potentially public ones (if any are needed later). Initially, protect:
        *   `POST /api/podcasts`
        *   `DELETE /api/podcasts/:podcastId`
        *   `POST /api/podcasts/:podcastId/episodes`
        *   `POST /api/podcasts/:podcastId/generate-episode`
        *   `DELETE /api/podcasts/:podcastId/episodes/:episodeId`
        *   `POST /api/podcasts/:podcastId/generate-bullet-points`
    *   Modify GET endpoints (`/api/podcasts`, `/api/podcasts/:id`, `/api/podcasts/:podcastId/episodes`) to filter by `userId` later (Phase 2).
5.  **Database Schema Update:**
    *   Modify the Firestore data model (conceptually, code changes follow). Add a `userId` field (string) to the `Podcast` interface/schema. Episodes will be implicitly owned via their `podcastId`.
    *   Update Firestore security rules to allow users to read/write only their own data (e.g., `allow read, write: if request.auth.uid == resource.data.userId;`).
6.  **Data Migration (One-time Task):**
    *   Determine the Firebase `uid` corresponding to the `garencheckley@gmail.com` Google account after the first sign-in.
    *   Create a script (or perform manually via Firebase console/script) to iterate through all existing `Podcast` documents in Firestore.
    *   For each existing podcast, add the `userId` field and set its value to the determined `uid` for `garencheckley@gmail.com`.
7.  **Update Create Operations:**
    *   Modify the `POST /api/podcasts` route handler to associate the authenticated `req.userId` with the new podcast document being created.
8.  **Update Read/Delete Operations:**
    *   Modify `GET /api/podcasts` to query only podcasts matching the `req.userId`.
    *   Modify `GET /api/podcasts/:id`, `DELETE /api/podcasts/:podcastId`, and all episode-related routes to first fetch the podcast, verify the `podcast.userId` matches `req.userId`, and deny access if they don't match.

**Phase 2: Frontend Integration**

1.  **Add Firebase SDK:** Add Firebase client SDKs (`firebase/app`, `firebase/auth`) to the frontend (`frontend/package.json`).
2.  **Firebase Configuration:** Initialize Firebase in the frontend with the project's configuration keys (obtained from Firebase console). Store these keys securely (e.g., environment variables).
3.  **Authentication UI:**
    *   Add a "Login with Google" button (as the sole login option).
    *   Implement sign-in logic using `signInWithPopup` or `signInWithRedirect` with the GoogleAuthProvider.
    *   Add a "Logout" button.
    *   Display user information (e.g., name/email) when logged in.
4.  **Auth State Management:**
    *   Use `onAuthStateChanged` listener to track the user's login status globally (e.g., in a React Context).
    *   Conditionally render UI elements based on login state (e.g., show login button vs. logout button and podcast creation forms).
5.  **Authenticated API Calls:**
    *   Create a utility function to get the current user's ID token (`currentUser.getIdToken()`).
    *   Modify existing API call functions (`frontend/src/services/api.ts` or similar) to:
        *   Get the ID token before making a request to a protected endpoint.
        *   Include the token in the `Authorization: Bearer <ID_TOKEN>` header.
    *   Handle potential authentication errors (e.g., expired token, insufficient permissions).
6.  **UI Adaptation:**
    *   Ensure only logged-in users can see options to create/delete podcasts/episodes.
    *   The main podcast list should only show podcasts belonging to the logged-in user.

**Phase 3: Refinement & Testing**

1.  **Error Handling:** Implement robust error handling for authentication failures (invalid token, network issues, permissions denied) on both frontend and backend.
2.  **Testing:** Thoroughly test the login/logout flow, access control for different users, and error scenarios.
3.  **Security Rules:** Test Firestore security rules rigorously using the Firebase emulator or console.
4.  **Documentation:** Update `README.md` with authentication setup and usage. 