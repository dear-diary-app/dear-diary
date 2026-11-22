import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { finishLaunch } from './launch';
import './style.css';
import { registerDiaryShell } from './pwa';
import { registerDiaryInstall } from './DiaryInstall';
import { registerPrivacyBlur } from './privacy';
import { registerNoSelect } from './noselect';

// A slow network must fall back to the normal loading/retry screen.
window.setTimeout(finishLaunch, 1400);
registerPrivacyBlur();
registerNoSelect();
registerDiaryInstall();
registerDiaryShell();

createRoot(document.getElementById('root')!).render(
    <HashRouter>
        <App />
    </HashRouter>
);
