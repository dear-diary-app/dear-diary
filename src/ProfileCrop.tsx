import React, { useEffect, useRef, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { PersonId } from './model';
import { useStore } from './store';
import { dismissMotion } from './motion';

export function ProfileCrop({ file, person, onClose, onSaved }: {
    file: File; person: PersonId; onClose: () => void; onSaved: () => void;
}) {
    const store = useStore();
    const [url] = useState(() => URL.createObjectURL(file));
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [area, setArea] = useState<Area | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const overlay = useRef<HTMLDivElement>(null);
    const close = () => { setBusy(true); dismissMotion(overlay.current, onClose); };
    const cancel = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        cancel.current?.focus();
        return () => { URL.revokeObjectURL(url); document.body.style.overflow = overflow; previous?.focus(); };
    }, [url]);
    return <div ref={overlay} className="dd-crop-overlay" onKeyDown={e => {
        if (e.key === 'Escape' && !busy) close();
        if (e.key === 'Tab') {
            const controls = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
            const first = controls[0], last = controls[controls.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
            if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
    }}>
        <section className="dd-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-title" aria-describedby="crop-help">
            <h2 className="dd-title" id="crop-title">Adjust your picture</h2>
            <p id="crop-help" className="dd-card-sub">Drag to move. Pinch or use the slider to zoom.</p>
            <div className="dd-crop-frame" aria-busy={busy}>
                <Cropper image={url} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false}
                    maxZoom={3} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)}
                    onMediaLoaded={() => setError('')} mediaProps={{ onError: () => setError('This image could not be opened. Try another photo.') }}
                    keyboardStep={8} />
            </div>
            <label className="dd-crop-zoom">Zoom
                <input aria-label="Photo zoom" type="range" min="1" max="3" step="0.01" value={zoom} disabled={busy}
                    onChange={e => setZoom(Number(e.target.value))} />
            </label>
            {error && <p className="dd-card-body" role="alert">{error}</p>}
            <div className="dd-crop-actions">
                <button ref={cancel} className="dd-btn dd-btn-ghost" disabled={busy} onClick={close}>Cancel</button>
                <button className="dd-btn dd-btn-primary" disabled={busy || !area} onClick={async () => {
                    if (!area || busy) return;
                    setBusy(true); setError('');
                    try { await store.uploadAvatar(person, file, area); dismissMotion(overlay.current, onSaved); }
                    catch (err) { setError(err instanceof Error ? err.message : 'Could not save your picture. Try again.'); setBusy(false); }
                }}>{busy ? 'Saving...' : 'Save picture'}</button>
            </div>
        </section>
    </div>;
}
