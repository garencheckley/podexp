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
          <h1>Podcast Generator</h1>
        </header>
        <main className="app-content">
          <Routes>
            <Route path="/" element={<PodcastList />} />
            <Route path="/podcasts/:podcastId" element={<PodcastDetail />} />
            <Route path="/create-podcast" element={<CreatePodcastForm />} />
          </Routes>
        </main>
        <footer className="app-footer">
          <p>&copy; {new Date().getFullYear()} Podcast Generator</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
