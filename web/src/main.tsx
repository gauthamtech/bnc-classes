import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.tsx';
import { installShellAuthBridge } from './lib/shell';

// Registered before React mounts. The Android shell can deliver a sign-in
// callback the moment the page finishes loading, and a missing bridge at that
// instant would drop the session silently.
installShellAuthBridge();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
