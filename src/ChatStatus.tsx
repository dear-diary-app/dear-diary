import React, { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import { useAuth } from "./store";
import {Avatar} from "./ui";
import {personById} from "./model";
import type { Person } from "./model";
import { XIcon } from "./icons";
const choices = [
  "Free",
  "Studying",
  "Busy",
  "Working",
  "Can't talk right now",
  "Prefer not to say",
];
export function ChatStatus({
  partner,
  online,
  inbox=false,
  inboxHeader=false,
}: {
  partner: Person;
  online: boolean;
  inbox?: boolean;
  inboxHeader?: boolean;
}) {
  const { session,me } = useAuth(),
    uid = session?.user.id;
  const [own, setOwn] = useState(""),
    [other, setOther] = useState(""),
    [draft, setDraft] = useState(""),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0),
    [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    ownRef = useRef("");
  useEffect(() => {
    if (!uid) return;
    let alive = true,
      version = 0;
    const load = async () => {
      const current = ++version;
      const r = await supabase.from("chat_status").select("user_id,status");
      if (!alive || current !== version) return;
      if (r.error) {
        setError("Status unavailable. Please try again.");
        return;
      }
      setError("");
      setLoaded(true);
      const mine = r.data?.find((v) => v.user_id === uid)?.status || "",
        theirs = r.data?.find((v) => v.user_id !== uid)?.status || "";
      ownRef.current = mine;
      setOwn(mine);
      setOther(theirs);
    };
    void load();
    const ch = supabase
      .channel(`dd-chat-status-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_status" },
        () => void load(),
      )
      .subscribe();
    const visible = () => {
      if (!document.hidden) void load();
    };
    const timer = window.setInterval(visible, 30000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      version++;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      void supabase.removeChannel(ch);
    };
  }, [uid, retry]);
  useEffect(() => {
    if (open) {
      setDraft(ownRef.current);
      dialog.current?.showModal();
    } else if (dialog.current?.open) dialog.current.close();
  }, [open]);
  const close = () => {
    if (busy) return;
    setOpen(false);
    trigger.current?.focus();
  };
  const save = async () => {
    if (!uid || busy || !loaded) return;
    setBusy(true);
    setError("");
    const value = draft.trim();
    const r = await supabase
      .from("chat_status")
      .upsert({ user_id: uid, status: value }, { onConflict: "user_id" });
    setBusy(false);
    if (r.error) {
      setError("Could not save your status. Try again.");
      return;
    }
    ownRef.current = value;
    setOwn(value);
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <>
      {inboxHeader?<button ref={trigger} className="dd-dm-header-status" aria-label="Set your chat status" aria-haspopup="dialog" onClick={()=>setOpen(true)}><span className="dd-dm-status-dot" aria-hidden="true"/><span>{own||"Set status"}</span></button>:inbox?<div className="dd-dm-notes"><button ref={trigger} className="dd-dm-note" onClick={()=>setOpen(true)} aria-label="Set your note or status"><span className="dd-dm-note-bubble">{own||"Share a thought..."}</span><Avatar person={personById(me!)}/><small>Your note</small><i aria-hidden="true">+</i></button><button className="dd-dm-note" onClick={()=>setOpen(true)} aria-label={`${partner.name} note: ${other||"No note shared"}`}><span className="dd-dm-note-bubble">{other||"No note yet"}</span><Avatar person={partner}/><small>{partner.name}</small></button></div>:<button
        ref={trigger}
        className="dd-availability-pill"
        aria-label={`Chat status: ${partner.name}${other ? `, ${other}` : online ? ", Online" : ", no status"}. Set your status`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span className="dd-availability-partner">
          {other || (online ? "Online" : "Status")}
          {other && online && <i aria-label="Online" />}
        </span>
        <small>{own ? `You: ${own}` : "Set yours"}</small>
      </button>}
      <dialog
        ref={dialog}
        className="dd-availability-dialog"
        aria-labelledby="chat-status-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <section>
          <header>
            <h2 id="chat-status-title">Chat status</h2>
            <button
              className="dd-iconbtn"
              aria-label="Close status"
              disabled={busy}
              onClick={close}
            >
              <XIcon />
            </button>
          </header>
          <div className="dd-availability-current">
            <strong>{partner.name}</strong>
            <span>
              {other || "No status shared"}
              {online ? " · Online" : ""}
            </span>
          </div>
          <p>
            Choose what your friend sees. {inbox?"Your note uses your existing chat status and stays until you change or clear it. It does not expire automatically.":"Your status stays until you change or clear it."} Online is automatic and separate.
          </p>
          <p className="dd-card-note">Changing any status to Free can notify your friend if they turn on Friend is free in Settings → Notifications. Saving Free again does not send another alert.</p>
          <label className="dd-field">
            <span>Your status</span>
            <input
              value={draft}
              onChange={(e) =>
                setDraft(e.target.value.replace(/[\r\n\t]/g, " "))
              }
              maxLength={60}
              disabled={busy || !loaded}
              placeholder="Add a short status"
            />
          </label>
          <small>{Array.from(draft).length}/60</small>
          <div className="dd-availability-choices">
            {choices.map((v) => (
              <button
                key={v}
                type="button"
                className="dd-btn dd-btn-ghost"
                aria-pressed={draft === v}
                disabled={busy || !loaded}
                onClick={() => setDraft(v)}
              >
                {v}
              </button>
            ))}
          </div>
          {error && (
            <p role="alert">
              {error}{" "}
              {!loaded && (
                <button
                  className="dd-btn"
                  onClick={() => setRetry((x) => x + 1)}
                >
                  Retry status
                </button>
              )}
            </p>
          )}
          {!loaded && !error && <p role="status">Loading status...</p>}
          <footer>
            <button
              className="dd-btn dd-btn-ghost"
              disabled={busy || !loaded}
              onClick={() => setDraft("")}
            >
              Clear
            </button>
            <button
              className="dd-btn dd-btn-primary"
              disabled={busy || !loaded}
              onClick={save}
            >
              {busy ? "Saving..." : "Save status"}
            </button>
          </footer>
        </section>
      </dialog>
    </>
  );
}
