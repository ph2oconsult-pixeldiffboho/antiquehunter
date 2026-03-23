import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './AppMain.tsx';
import './index.css';
import './i18n/config';

// Force rebuild
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
