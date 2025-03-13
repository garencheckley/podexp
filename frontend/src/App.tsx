import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PodcastList from './components/PodcastList';
import PodcastDetail from './components/PodcastDetail';
import CreatePodcastForm from './components/CreatePodcastForm';
import './App.css';

function App() {
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
