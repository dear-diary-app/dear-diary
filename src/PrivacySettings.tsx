import React, { useState } from 'react';
import { useAuth } from './store';
import { Toggle } from './ui';
import { privacyBlurEnabled, savePrivacyBlur } from './privacy';
export function PrivacySettings() {
    const uid = useAuth().session!.user.id;
    const [on, setOn] = useState(() => privacyBlurEnabled(uid));
    const [message, setMessage] = useState('');
    return <section className="dd-card" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="dd-card-title">Privacy on this device</h2>
        <Toggle label="Blur when minimized" hint="Blur the app when you switch apps or leave it." on={on} onChange={v => {
            try { savePrivacyBlur(uid, v); setOn(v); setMessage('Saved for your account on this device.'); }
            catch { setMessage('Could not save on this device. Your previous choice remains.'); }
        }} />
        <p className="dd-card-note">On by default. Saved only for your account in this browser or installed app. This cannot prevent screenshots or guarantee that your phone hides every app-switcher preview.</p>
        {message && <p className="dd-card-note" role="status">{message}</p>}
    </section>;
}
