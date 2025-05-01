import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Firebase Imports - REMOVED
// import { initializeApp } from "firebase/app";
// import { getAuth } from "firebase/auth";

// Firebase configuration - REMOVED
// const firebaseConfig = { ... };

// Firebase initialization - REMOVED
// const app = initializeApp(firebaseConfig);
// export const auth = getAuth(app);

// Analytics initialization - REMOVED
// import { getAnalytics } from "firebase/analytics";
// const analytics = getAnalytics(app);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
