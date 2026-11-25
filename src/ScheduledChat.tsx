import React, { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import { XIcon } from "./icons";
import {cleanEffect,emojiTokens,effectName,type MessageEffect} from "./ChatEffects";
import{cleanVoice,uploadVoice,voiceExt,type Voice}from'./chatAudio';
import{VoicePlayer}from'./VoiceNote';
export type VoiceDraft={blob:Blob;duration:number;mime:string;peaks:number[];reply?:string|null};
type Item = { id: string; body: string; send_at: string; state: string; effect: MessageEffect|null;audio?:Voice|null;reply_to?:string|null };
const localIST = (time: number) =>
  new Date(time + 330 * 60000).toISOString().slice(0, 16);
export function ScheduledChat({
  voiceDraft,hideList=false,
  initialEffect,
  draft,
  blocked,
  request,
  onSaved,
}: {
  voiceDraft?:VoiceDraft;hideList?:boolean;
  initialEffect?: MessageEffect|null;
  draft: string;
  blocked: boolean;
  request: number;
  onSaved: () => void;
}) {
  const[voice,setVoice]=useState<Voice|null>(null),[reply,setReply]=useState<string|null>(null);const uploaded=useRef(false);
  const [effect,setEffect]=useState<MessageEffect|null>(null);
  const [items, setItems] = useState<Item[]>([]),
    [open, setOpen] = useState(false),
    [body, setBody] = useState(""),
    [at, setAt] = useState(""),
    [id, setId] = useState(""),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null),
    last = useRef(0);
  const refresh = async () => {
    const r = await supabase
      .from("chat_scheduled")
      .select("id,body,send_at,state,effect,audio,reply_to")
      .in("state", ["pending", "failed"])
      .order("send_at");
    if (r.error) setLoadError("Scheduled messages could not load.");
    else {
      setItems(r.data || []);
      setLoadError("");
    }
  };
  useEffect(() => {
    if(hideList)return;void refresh();window.addEventListener('dd-scheduled-changed',refresh);
    const t = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener('dd-scheduled-changed',refresh);clearInterval(t);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [retry]);
  useEffect(() => {
    if (!request || request === last.current) return;
    last.current = request;
    setError("");
    if (blocked) {
      setError(
        "Schedule plain text only. Remove the reply or photos, or finish editing first.",
      );
      return;
    }
    if (!draft.trim()&&!voiceDraft) return;
    const nextId=crypto.randomUUID();setId(nextId);uploaded.current=false;setVoice(null);setReply(voiceDraft?.reply||null);if(voiceDraft)void supabase.auth.getSession().then(({data})=>{if(data.session?.user)setVoice(cleanVoice({path:`${data.session.user.id}/${nextId}.${voiceExt(voiceDraft.mime)}`,duration:voiceDraft.duration,mime:voiceDraft.mime,peaks:voiceDraft.peaks}));});
    setEditing(false);
    setBody(draft.trim());
    setEffect(cleanEffect(initialEffect));
    setAt(localIST(Date.now() + 5 * 60000));
    setOpen(true);
  }, [request]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  const save = async () => {
    const time = new Date(at + "+05:30");
    if (
      !Number.isFinite(time.getTime()) ||
      time.getTime() < Date.now() + 60000 ||
      time.getTime() > Date.now() + 30 * 86400000
    ) {
      setError("Choose a time at least one minute ahead, within 30 days.");
      return;
    }
    if(voiceDraft&&!voice){setError("Sign in again before scheduling this voice note.");return;}
    setBusy(true);
    setError("");
    let r:{error:unknown};try{if(voice){if(!editing&&!uploaded.current){if(!voiceDraft||!await uploadVoice(voice,voiceDraft.blob))throw Error();uploaded.current=true;}r=await supabase.rpc('chat_schedule_voice',{p_id:id,p_audio:voice,p_at:time.toISOString(),p_reply:reply});}else{r=await supabase.rpc("chat_schedule",{p_id:id,p_body:body,p_at:time.toISOString(),p_effect:effect});}}catch{r={error:true};}
    setBusy(false);
    if (r.error) {
      setError(
        "Could not schedule. Check the time and connection, then try again. Your draft is still here.",
      );
      return;
    }
    setOpen(false);
    if (!editing) onSaved();
    window.dispatchEvent(new Event('dd-scheduled-changed'));if(!hideList)void refresh();
  };
  const cancel = async (item: Item) => {
    setBusy(true);
    const r = await supabase.rpc("chat_cancel_schedule", { p_id: item.id });
    setBusy(false);
    if (r.error) setError("Could not cancel. Try again.");
    else if (!r.data) setError("This message has already sent or changed.");
    void refresh();
  };
  return (
    <>
      {!hideList&&(items.length > 0 || loadError) && (
        <details className="dd-scheduled-list">
          <summary>Scheduled · {items.length}</summary>
          <p>Only you can see these before delivery.</p>
          {loadError && (
            <p role="alert">
              {loadError}
              <button onClick={() => setRetry((x) => x + 1)}>
                Retry scheduled
              </button>
            </p>
          )}
          {items.map((v) => (
            <article key={v.id}>
              <strong>
                {v.state === "failed" ? "Delivery failed" : "Scheduled"} ·{" "}
                {new Date(v.send_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                IST
              </strong>
              {v.audio?<><p>Voice note · {Math.round(v.audio.duration)} sec</p><VoicePlayer voice={v.audio}/></>:<p>{v.body}{v.effect?` · ${effectName(v.effect)}`:""}</p>}
              <div>
                <button
                  disabled={busy}
                  onClick={() => {
                    setId(v.id);setVoice(cleanVoice(v.audio));setReply(v.reply_to||null);
                    setBody(v.body);
                    setEffect(cleanEffect(v.effect));
                    setAt(
                      localIST(
                        Math.max(Date.parse(v.send_at), Date.now() + 5 * 60000),
                      ),
                    );
                    setEditing(true);
                    setError("");
                    setOpen(true);
                  }}
                >
                  {v.state === "failed" ? "Retry delivery" : "Change time"}
                </button>
                <button disabled={busy} onClick={() => void cancel(v)}>
                  Cancel scheduled
                </button>
              </div>
            </article>
          ))}
        </details>
      )}
      {error && !open && (
        <p className="dd-chat-note" role="alert">
          {error}
        </p>
      )}
      <dialog
        ref={dialog}
        className="dd-availability-dialog dd-schedule-dialog"
        aria-labelledby="schedule-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setOpen(false);
        }}
        onClose={() => setOpen(false)}
      >
        <section>
          <header>
            <h2 id="schedule-title">{voiceDraft||voice?"Schedule voice note":"Schedule message"}</h2>
            <button
              className="dd-iconbtn"
              aria-label="Close schedule"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              <XIcon />
            </button>
          </header>
          <p>
            Time is in IST. Delivery runs on the server about once a minute,
            even when the app is closed. It can be delayed if the service is
            unavailable.
          </p>
          <p className="dd-schedule-text">{voice?`Voice note · ${Math.round(voice.duration)} sec`:body}</p>
          {!voice&&!voiceDraft&&<label className="dd-field"><span>Message effect</span><select aria-label="Scheduled message effect" value={effect||''} disabled={busy} onChange={e=>setEffect(cleanEffect(e.target.value))}><option value="">None</option><option value="blur">Blur</option><option value="bubbles" disabled={!emojiTokens(body).length}>Bubbles</option></select></label>}
          {effect==='bubbles'&&<p>Bubbles will play when your friend first views this delivered message. Replay stays available.</p>}
          <label className="dd-field">
            <span>Send at (IST)</span>
            <input
              type="datetime-local"
              value={at}
              onChange={(e) => setAt(e.target.value)}
              disabled={busy}
            />
          </label>
          <p>
            Your friend sees nothing before delivery. The delivered message is
            marked Scheduled. A sent confirmation uses your existing app notifications, if enabled.
          </p>
          {error && <p role="alert">{error}</p>}
          <footer>
            <button
              className="dd-btn dd-btn-ghost"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Not now
            </button>
            <button
              className="dd-btn dd-btn-primary"
              disabled={busy}
              onClick={save}
            >
              {busy ? "Scheduling..." : voiceDraft||voice?"Schedule voice note":"Schedule message"}
            </button>
          </footer>
        </section>
      </dialog>
    </>
  );
}
