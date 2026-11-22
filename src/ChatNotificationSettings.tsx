import React from 'react';
import { useStore } from './store';
import { Toggle } from './ui';
export function ChatNotificationSettings() {
    const store = useStore();
    return <section className="dd-card" aria-labelledby="chat-notification-heading">
        <h2 id="chat-notification-heading" className="dd-card-title">Chat notification privacy</h2>
        <Toggle label="Show message preview" hint="Show up to 160 characters of text or photo captions in new alerts, including on the lock screen if your phone allows it." disabled={store.loading || store.notifSaving} on={store.notifPrefs.chatPreview === true} onChange={v => store.setNotifPref('chatPreview', v)} />
        <Toggle label="Reply shortcut" hint="Add an Open to reply button. It opens chat to write a reply, it does not send from the notification bar." disabled={store.loading || store.notifSaving} on={store.notifPrefs.chatReply === true} onChange={v => store.setNotifPref('chatReply', v)} />
        <p className="dd-card-note">Both are off by default and save to your account for future alerts on all your devices. With previews off, new pushes contain no message text. Alerts already delivered or queued cannot be recalled.</p>
        <p className="dd-card-note">The Reply button depends on your browser and phone. You may need to expand the notification. Tap the notification itself if no button appears. Your phone may still need a tap in the message box to show its keyboard. An unsaved diary editor stays open.</p>
    </section>;
}
