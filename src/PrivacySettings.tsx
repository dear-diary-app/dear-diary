import React, { useState } from 'react';
import { useAuth } from './store';
import { ChevronRight } from './icons';
import { Toggle } from './ui';
import { shareTypingEnabled, saveShareTyping } from './typingPreference';
import { privacyBlurEnabled, savePrivacyBlur } from './privacy';
export function PrivacySettings() {
    const uid = useAuth().session!.user.id;
    const [on, setOn] = useState(() => privacyBlurEnabled(uid));
    const [sharingTyping, setSharingTyping] = useState(() => shareTypingEnabled(uid));
    const [message, setMessage] = useState('');
    return <section className="dd-card" aria-labelledby="privacy-heading">
        <details className="dd-settings-fold">
        <summary><span className="dd-settings-fold-label"><h2 id="privacy-heading" className="dd-card-title">Privacy on this device</h2><span className="dd-settings-fold-note">App blur and typing activity</span></span><ChevronRight size={20} /></summary>
        <div className="dd-settings-fold-content">
        <Toggle label="Blur when minimized" hint="Hide app content when you leave. Tap to return when you come back." on={on} onChange={v => {
            try { savePrivacyBlur(uid, v); setOn(v); setMessage('Saved for your account on this device.'); }
            catch { setMessage('Could not save on this device. Your previous choice remains.'); }
        }} />
        <p className="dd-card-note">On by default. Saved only for your account in this browser or installed app. A privacy cover stays until you tap to return. Android controls Recents screenshots, so a website cannot guarantee every app-switcher preview or block screenshots.</p>
        <Toggle label="Share typing activity" hint="Let your partner see typing dots while you write in chat. No draft text is sent." on={sharingTyping} onChange={v => {try {saveShareTyping(uid,v);setSharingTyping(v);setMessage('Saved for your account on this device.');}catch{setMessage('Could not save on this device. Your previous choice remains.');}}}/>
        <p className="dd-card-note">On by default. Typing signals are temporary, stop when you leave or pause, and are not stored. This choice applies only to this account on this device.</p>
        {message && <p className="dd-card-note" role="status">{message}</p>}
        </div></details>
    </section>;
}
