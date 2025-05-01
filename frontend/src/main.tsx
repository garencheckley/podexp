import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Firebase Imports
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// Removed getAnalytics as it's not immediately needed for auth

// Your web app's Firebase configuration (Provided by user)
const firebaseConfig = {
  apiKey: "AIzaSyAvdyEVGOQJc68Nx3fcDuoWxDtSD0Hba-k",
  authDomain: "gcpg-452703.firebaseapp.com",
  projectId: "gcpg-452703",
  storageBucket: "gcpg-452703.firebasestorage.app", // Corrected bucket name
  messagingSenderId: "827681017824",
  appId: "1:827681017824:web:2d9eb4d5109d1c40162585",
  measurementId: "G-2K8JWJZZMV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app); // Export auth instance for use in components

// Initialize Analytics (Optional - Keep if needed, otherwise remove)
// import { getAnalytics } from "firebase/analytics";
// const analytics = getAnalytics(app);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
