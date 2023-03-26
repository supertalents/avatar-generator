// src/App.tsx
import React from 'react';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import ImageProcessor from './ImageProcessor';

const App: React.FC = () => {
  return (
    <div className="App">
      <header className="App-header">
        <ImageProcessor />
      </header>
    </div>
  );
};

export default App;
