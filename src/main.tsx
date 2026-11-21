import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import './style.css';
import { registerDiaryShell } from './pwa';
import { registerDiaryInstall } from './DiaryInstall';

registerDiaryInstall();
registerDiaryShell();

createRoot(document.getElementById('root')!).render(
    <HashRouter>
        <App />
    </HashRouter>
);
