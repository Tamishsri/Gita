import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { registerServiceWorker, captureInstallPrompt } from './pwa/registerServiceWorker';
import { unlockAudioOnFirstGesture } from './lib/audio';

import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/shell.css';
import './styles/sanctuary.css';
import './styles/panels.css';
import './styles/practices.css';

// Listen for the install prompt before React mounts so it is never missed.
captureInstallPrompt();
unlockAudioOnFirstGesture();
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
