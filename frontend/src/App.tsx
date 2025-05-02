import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import PodcastList from './components/PodcastList';
import PodcastDetail from './components/PodcastDetail';
import CreatePodcastForm from './components/CreatePodcastForm';
import Login from './components/Login';
import VerifyToken from './components/VerifyToken';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

const AppHeader: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  
  return (
    <header className="app-header">
      <h1>Garen's Podcast Generator</h1>
      {isAuthenticated ? (
        <button className="logout-button" onClick={logout}>
          Log Out
        </button>
      ) : (
        <Link to="/login" className="login-button">
          Log In
        </Link>
      )}
    </header>
  );
};

function AppContent() {
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

  return (
    <div className="app">
      <AppHeader />
      <main className="app-content">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/verify" element={<VerifyToken />} />
          {/* Make Podcast List public */}
          <Route path="/" element={<PodcastList />} /> 
          {/* Make Podcast Detail public */}
          <Route path="/podcasts/:podcastId" element={<PodcastDetail />} /> 
          
          {/* Protected Routes */}
          <Route path="/create-podcast" element={
            <ProtectedRoute>
              <CreatePodcastForm />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
