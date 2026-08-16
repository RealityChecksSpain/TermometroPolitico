import React from 'react';
import { createRoot } from 'react-dom/client';
import EspectroPrototipo from './components/EspectroPrototipo.jsx';

document.body.style.margin = '0';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <EspectroPrototipo />
  </React.StrictMode>
);
