import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from './main';
import PodcastList from './components/PodcastList';
import PodcastDetail from './components/PodcastDetail';
import CreatePodcastForm from './components/CreatePodcastForm';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load Inter font
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Firebase auth state observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('Auth state changed:', currentUser);
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      console.log('Attempting Google Sign-In...');
      const result = await signInWithPopup(auth, provider);
      console.log('Sign-in successful:', result.user);
    } catch (error: any) {
      console.error('Error during Google Sign-In:', error);
      alert(`Login failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleLogout = async () => {
    try {
      console.log('Attempting Sign-Out...');
      await signOut(auth);
      console.log('Sign-out successful.');
    } catch (error: any) {
      console.error('Error during Sign-Out:', error);
      alert(`Logout failed: ${error?.message || 'Unknown error'}`);
    }
  };

  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <h1>Garen's Podcast Generator</h1>
          <div className="auth-controls">
            {loading ? (
              <p>Loading...</p>
            ) : user ? (
              <>
                <span>Welcome, {user.displayName || user.email}!</span>
                <button onClick={handleLogout}>Logout</button>
              </>
            ) : (
              <button onClick={handleGoogleLogin}>Login with Google</button>
            )}
          </div>
        </header>
        <main className="app-content">
          {loading ? (
            <p>Authenticating...</p>
          ) : user ? (
            <Routes>
              <Route path="/" element={<PodcastList />} />
              <Route path="/podcasts/:podcastId" element={<PodcastDetail />} />
              <Route path="/create-podcast" element={<CreatePodcastForm />} />
            </Routes>
          ) : (
            <p>Please log in to view podcasts.</p>
          )}
        </main>
      </div>
    </Router>
  );
}

export default App;
