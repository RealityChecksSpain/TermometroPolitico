import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/archivo/index.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);