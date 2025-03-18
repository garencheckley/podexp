import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PodcastList from './components/PodcastList';
import PodcastDetail from './components/PodcastDetail';
import CreatePodcastForm from './components/CreatePodcastForm';
import './App.css';

function App() {
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
    <Router>
      <div className="app">
        <header className="app-header">
          <h1>Garen's Podcast Generator</h1>
        </header>
        <main className="app-content">
          <Routes>
            <Route path="/" element={<PodcastList />} />
            <Route path="/podcasts/:podcastId" element={<PodcastDetail />} />
            <Route path="/create-podcast" element={<CreatePodcastForm />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
