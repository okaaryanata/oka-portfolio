import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Projects } from '../pages/Projects';
import '../shared/styles/base.css';
import '../shared/styles/demos.css';
import { configureOffline } from './offline';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Projects />
  </StrictMode>,
);
void configureOffline().catch((error) => console.warn('Offline caching unavailable.', error));
