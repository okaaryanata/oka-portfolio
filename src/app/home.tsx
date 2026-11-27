import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Home } from '../pages/Home';
import '../shared/styles/base.css';
import { configureOffline } from './offline';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Home />
  </StrictMode>,
);
void configureOffline().catch((error) => console.warn('Offline caching unavailable.', error));
