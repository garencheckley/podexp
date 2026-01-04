import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAvdyEVGOQJc68Nx3fcDuoWxDtSD0Hba-k",
  authDomain: "gcpg-452703.firebaseapp.com",
  projectId: "gcpg-452703",
  storageBucket: "gcpg-452703.firebasestorage.app",
  messagingSenderId: "827681017824",
  appId: "1:827681017824:web:2d9eb4d5109d1c40162585",
  measurementId: "G-2K8JWJZZMV"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
