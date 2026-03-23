import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AppMain from './AppMain.tsx';
import './index.css';
import './i18n/config';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppMain />
  </StrictMode>,
);
