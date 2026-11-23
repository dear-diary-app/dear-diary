import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth, useStore } from "./store";
import { personById, otherId, todayKey, PersonId } from "./model";
import { Avatar, TopBar, useNow } from "./ui";
import { ProfileSongReactions } from "./ProfileSongReactions";
import { ProfilePhoto } from "./ProfilePhoto";
import { ProfileCrop } from "./ProfileCrop";
import { ProfileStreak, useProfileStreaks } from "./ProfileStreak";
import { supabase } from "./lib/supabase";
import { Song, SongPicker, SongPill, cleanSong } from "./Song";
import { ChevronRight } from "./icons";
const MOODS = ["", "😊", "💛", "🌧️", "🌙", "📚", "☕", "🎵", "🌿"];
export function ProfilePage() {
  const { me } = useAuth(),
    { person } = useParams();
  const who: PersonId =
    person === "joydeep" || person === "aruba" ? person : me!;
  return <ProfileBody key={who} who={who} />;
}
function ProfileBody({ who }: { who: PersonId }) {
  const { me, session } = useAuth(),
    store = useStore();
  const own = who === me,
    p = personById(who),
    partner = personById(otherId(me!));
  const [bio, setBio] = useState(""),
    [mood, setMood] = useState(""),
    [saved, setSaved] = useState({ bio: "", mood: "" }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false),
    [note, setNote] = useState(""),
    [retry, setRetry] = useState(0),
    [songRetry, setSongRetry] = useState(0),
    [profileUID, setProfileUID] = useState(""),
    [song, setSong] = useState<Song | null>(null),
    [songDraft, setSongDraft] = useState<Song | null>(null),
    [expires, setExpires] = useState(""),
    [songLoading, setSongLoading] = useState(true),
    [songError, setSongError] = useState(""),
    [songBusy, setSongBusy] = useState(false),
    [songNote, setSongNote] = useState(""),
    [crop, setCrop] = useState<File | null>(null);
  const file = useRef<HTMLInputElement>(null),
    seq = useRef(0);
  const now = useNow(30000),
    streak = useProfileStreaks(todayKey(now), JSON.stringify(store.saveState));
  useEffect(() => {
    const request = ++seq.current;
    setLoading(true);
    setError("");
    setNote("");
    setBio("");
    setMood("");
    setSaved({ bio: "", mood: "" });
    let live = true;
    void (async () => {
      try {
        const pr = await supabase
          .from("profiles")
          .select("id")
          .eq("username", who)
          .single();
        if (pr.error || !pr.data) throw new Error("Profile unavailable.");
        if (!live) return;
        setProfileUID(pr.data.id);
        const r = await supabase
          .from("profile_details")
          .select("bio,mood")
          .eq("user_id", pr.data.id)
          .maybeSingle();
        if (r.error) throw r.error;
        if (!live || seq.current !== request) return;
        const v = { bio: r.data?.bio ?? "", mood: r.data?.mood ?? "" };
        setBio(v.bio);
        setMood(v.mood);
        setSaved(v);
      } catch {
        if (live) setError("Could not load this profile. Please try again.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [who, retry]);
  const songDirty = JSON.stringify(songDraft) !== JSON.stringify(song);
  const dirty = bio !== saved.bio || mood !== saved.mood || songDirty;
  useEffect(() => {
    if (!profileUID) return;
    let live = true;
    const load = async () => {
      setSongLoading(true);
      const r = await supabase
        .from("profile_songs")
        .select("song,expires_at")
        .eq("user_id", profileUID)
        .maybeSingle();
      if (!live) return;
      setSongLoading(false);
      if (r.error) {
        setSongError("Could not load the song.");
        return;
      }
      setSongError("");
      const v =
        r.data && new Date(r.data.expires_at).getTime() > Date.now()
          ? cleanSong(r.data.song)
          : null;
      setSong(v);
      setSongDraft(v);
      setExpires(r.data?.expires_at || "");
    };
    void load();
    const focus = () => {
      if (
        document.visibilityState === "visible" &&
        !document.querySelector('[data-profile-dirty="true"]')
      )
        void load();
    };
    document.addEventListener("visibilitychange", focus);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", focus);
    };
  }, [profileUID, songRetry]);
  const expired = !!expires && new Date(expires).getTime() <= now.getTime();
  useEffect(() => {
    if (!expires) return;
    const expire = () => {
      setSong(null);
      setSongDraft(null);
      setExpires("");
      setSongNote(
        own ? "Your previous song has expired." : "This song has expired.",
      );
    };
    const delay = new Date(expires).getTime() - Date.now();
    if (delay <= 0) {
      expire();
      return;
    }
    const timer = window.setTimeout(expire, delay);
    return () => window.clearTimeout(timer);
  }, [expires, own]);
  const saveSong = async () => {
    if (!own || songBusy) return;
    setSongBusy(true);
    setSongNote("");
    const r = await supabase.rpc("set_profile_song", { value: songDraft });
    setSongBusy(false);
    if (r.error) {
      setSongNote(
        "Could not save the song. Your selection is still here. Try again.",
      );
      return;
    }
    setSong(songDraft);
    setExpires(r.data || "");
    setSongNote(songDraft ? "Song shared for 24 hours." : "Song removed.");
  };

  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      if (
        (e.target as Element)?.closest("a[href]") &&
        !window.confirm("Discard your unsaved profile changes?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", guard);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", guard);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  const save = async () => {
    if (!own || !session || busy || loading || error) return;
    setBusy(true);
    setNote("");
    const clean = { bio: bio.trim(), mood };
    const r = await supabase
      .from("profile_details")
      .upsert(
        { user_id: session.user.id, ...clean },
        { onConflict: "user_id" },
      );
    if (r.error)
      setNote("Could not save. Your edits are still here. Try again.");
    else {
      setBio(clean.bio);
      setSaved(clean);
      setNote("Profile saved.");
      setEditing(false);
    }
    setBusy(false);
  };
  return (
    <main
      className="dd-shell dd-shell-narrow dd-profile-page"
      data-profile-dirty={dirty || busy || songBusy ? "true" : undefined}
    >
      <TopBar />
      <header className="dd-profile-title">
        <div>
          <h1 className="dd-title">
            {own ? "Your profile" : `${p.name}'s profile`}
          </h1>
          <p className="dd-sub">A little about {own ? "you" : p.name}</p>
        </div>
        <Link
          className="dd-chip"
          to={own ? `/profile/${partner.id}` : "/profile"}
        >
          {own ? `View ${partner.name}` : "Your profile"}
          <ChevronRight size={16} />
        </Link>
      </header>
      <section className="dd-card dd-profile-hero">
        <ProfilePhoto person={p} />
        <h2>
          {p.name}{" "}
          {saved.mood && <span aria-label="Current mood">{saved.mood}</span>}
        </h2>
        <p className="dd-card-sub">
          {own ? "Visible to you and your friend" : "Your friend"}
        </p>
        {saved.bio ? (
          <p className="dd-profile-bio">{saved.bio}</p>
        ) : (
          !loading &&
          !error && (
            <p className="dd-card-sub">
              {own ? "Your story, in a few words." : "No bio yet."}
            </p>
          )
        )}
        {own && !editing && (
          <button
            className="dd-btn dd-btn-primary"
            disabled={loading || !!error}
            onClick={() => setEditing(true)}
          >
            Edit profile
          </button>
        )}
        <ProfileStreak
          streak={streak.streaks[who]}
          failed={streak.failed}
          retry={streak.retry}
          own={own}
        />
      </section>
      {loading ? (
        <section className="dd-card" role="status">
          Loading profile...
        </section>
      ) : error ? (
        <section className="dd-card" role="alert">
          <p>{error}</p>
          <button className="dd-btn" onClick={() => setRetry((x) => x + 1)}>
            Retry
          </button>
        </section>
      ) : own && editing ? (
        <section className="dd-card">
          <h2 className="dd-card-title">Edit profile</h2>
          {editing && (
            <div className="dd-profile-upload">
              <button
                className="dd-btn dd-btn-primary"
                onClick={() => file.current?.click()}
              >
                Update profile picture
              </button>
              <input
                ref={file}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      f.type,
                    ) ||
                    f.size > 10 * 1024 * 1024
                  ) {
                    setNote("Choose a JPG, PNG or WebP photo up to 10 MB.");
                    return;
                  }
                  setCrop(f);
                }}
              />
              <p className="dd-card-sub">JPG, PNG or WebP · Up to 10 MB</p>
            </div>
          )}

          <label className="dd-field dd-profile-field">
            <span>Bio</span>
            <textarea
              maxLength={160}
              rows={3}
              value={bio}
              disabled={busy}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A few words about you"
            />
          </label>
          <p className="dd-card-sub">
            {Array.from(bio).length}/160 · Shared with your friend
          </p>
          <fieldset className="dd-mood">
            <legend>Mood</legend>
            <div>
              {MOODS.map((v, i) => (
                <button
                  key={i}
                  type="button"
                  className="dd-emoji"
                  aria-label={v ? `Mood ${v}` : "No mood"}
                  aria-pressed={mood === v}
                  disabled={busy}
                  onClick={() => setMood(v)}
                >
                  {v || "None"}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="dd-profile-save">
            <button
              className="dd-btn dd-btn-primary"
              disabled={(bio === saved.bio && mood === saved.mood) || busy}
              onClick={save}
            >
              {busy ? "Saving..." : "Save profile"}
            </button>
            <button
              className="dd-btn dd-btn-ghost"
              disabled={busy}
              onClick={() => {
                setBio(saved.bio);
                setMood(saved.mood);
                setEditing(false);
                setNote("");
              }}
            >
              Cancel
            </button>
          </div>
          {(bio !== saved.bio || mood !== saved.mood) && (
            <p className="dd-card-sub">Unsaved changes</p>
          )}
        </section>
      ) : null}
      <section className="dd-card">
        <h2 className="dd-card-title">
          {own ? "Your song" : "Song of the day"}
        </h2>
        {songLoading ? (
          <p role="status">Loading song...</p>
        ) : songError ? (
          <p role="alert">
            {songError}{" "}
            <button
              className="dd-btn"
              onClick={() => setSongRetry((x) => x + 1)}
            >
              Retry song
            </button>
          </p>
        ) : own ? (
          <>
            <fieldset
              disabled={songBusy}
              style={{ border: 0, padding: 0, margin: 0 }}
            >
              <SongPicker song={songDraft} onChange={setSongDraft} compact />
            </fieldset>
            {songDirty && (
              <div className="dd-profile-save">
                <button
                  className="dd-btn dd-btn-primary"
                  disabled={songBusy}
                  onClick={saveSong}
                >
                  {songBusy
                    ? "Sharing..."
                    : songDraft
                      ? "Share for 24 hours"
                      : "Remove song"}
                </button>
                <button
                  className="dd-btn dd-btn-ghost"
                  disabled={songBusy}
                  onClick={() => setSongDraft(song)}
                >
                  Cancel
                </button>
              </div>
            )}
            {!songDirty && song && !expired && (
              <button
                className="dd-btn dd-btn-ghost"
                disabled={songBusy}
                onClick={() => setSongDraft(null)}
              >
                Remove song
              </button>
            )}
          </>
        ) : song && !expired ? (
          <SongPill song={song} compact />
        ) : (
          <p className="dd-card-sub">No song shared right now.</p>
        )}
        {song && !expired && expires && (
          <p className="dd-card-sub">
            Until{" "}
            {new Date(expires).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            IST
          </p>
        )}
        {song&&!expired&&expires&&profileUID&&!songLoading&&!songError&&!songDirty&&<ProfileSongReactions key={profileUID+expires} owner={profileUID} expires={expires} own={own} friend={partner.name}/> }
        {songNote && <p role="status">{songNote}</p>}
      </section>
      {note && (
        <p className="dd-card" role="status">
          {note}
        </p>
      )}
      {crop && own && (
        <ProfileCrop
          file={crop}
          person={me!}
          onClose={() => setCrop(null)}
          onSaved={() => {
            setCrop(null);
            setNote("Profile picture saved.");
          }}
        />
      )}
    </main>
  );
}
