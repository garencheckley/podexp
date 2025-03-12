import React from 'react';

const Episodes = () => {
  return (
    <div className="container">
      <h2>Timmy the T-Rex and his adventures</h2>
      <div className="episode-list">
        <div className="episode-item">
          <h3 className="episode-title">Episode 1: Making New Friends</h3>
          <p className="episode-description">Timmy meets a young Triceratops named Trina and learns about making friends who are different from him.</p>
          <div className="episode-meta">Published: March 20, 2024</div>
        </div>

        <div className="episode-item">
          <h3 className="episode-title">Episode 2: The Big Storm</h3>
          <p className="episode-description">When a terrible storm hits the valley, Timmy must be brave and help his new friend Trina find shelter.</p>
          <div className="episode-meta">Published: March 21, 2024</div>
        </div>

        <div className="episode-item">
          <h3 className="episode-title">Episode 3: The Sharing Lesson</h3>
          <p className="episode-description">Timmy learns the importance of sharing when food becomes scarce in the valley.</p>
          <div className="episode-meta">Published: March 22, 2024</div>
        </div>
      </div>
    </div>
  );
};

export default Episodes; 