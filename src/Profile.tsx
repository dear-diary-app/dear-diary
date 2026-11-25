import{ProfileSocialLinks}from'./ProfileSocialLinks';
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth, useStore } from "./store";
import { personById, otherId, todayKey, PersonId } from "./model";
import { useNow } from "./ui";
import { ProfileSongReactions } from "./ProfileSongReactions";
import { ProfilePhoto } from "./ProfilePhoto";
import { ProfileCrop } from "./ProfileCrop";
import { ProfileStreak, useProfileStreaks } from "./ProfileStreak";
import { supabase } from "./lib/supabase";
import { Song, SongPicker, SongPill, cleanSong } from "./Song";
import { Bell, Gear, Lock, ChevronLeft } from "./icons";
import { ProfilePosts } from "./ProfilePosts";
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
  const [socialDirty,setSocialDirty]=useState(false);
  const [tab, setTab] = useState<"posts" | "music" | "about">("posts");
  const [postCount, setPostCount] = useState<number | null>(null);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const countPosts = useCallback((n: number | null) => setPostCount(n), []);
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
  useEffect(() => {
    let active = true;
    void supabase.from("friendship").select("user1_id,user2_id").maybeSingle().then(r => {
      if (active) setFriendCount(r.error ? null : r.data ? 1 : 0);
    });
    return () => { active = false; };
  }, []);
  const songDirty = JSON.stringify(songDraft) !== JSON.stringify(song);
  const dirty = bio !== saved.bio || mood !== saved.mood || songDirty || socialDirty;
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
  useEffect(() => {
    if (tab !== "music") window.dispatchEvent(new Event("dd-page-lock"));
  }, [tab]);
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
      if(!socialDirty)setEditing(false);
    }
    setBusy(false);
  };
  return (
    <main
      className="dd-shell dd-shell-narrow dd-profile-page"
      data-profile-dirty={dirty || busy || songBusy ? "true" : undefined}
    >
      <header className="dd-profile-instabar">
        <div>{!own && <Link to="/profile" aria-label="Back to your profile"><ChevronLeft size={25}/></Link>}<Lock size={17}/><h1>{who}</h1></div>
        <nav aria-label="Profile controls"><Link to="/inbox" aria-label="Notification inbox"><Bell size={24}/></Link><Link to="/settings" aria-label="Profile and settings"><Gear size={24}/></Link></nav>
      </header>
      <section className="dd-profile-identity" aria-label={`${p.name}'s profile`}>
        <div className="dd-profile-overview"><ProfilePhoto person={p}/><div className="dd-profile-stats">
          <button onClick={() => setTab("posts")}><strong>{postCount ?? "···"}</strong><span>posts</span></button>
          <button onClick={() => setTab("about")}><strong>{streak.failed ? "···" : streak.streaks[who]?.current_streak ?? "···"}</strong><span>day streak</span></button>
          <Link to={own ? `/profile/${partner.id}` : "/profile"}><strong>{friendCount ?? "···"}</strong><span>{friendCount === 1 ? "friend" : "friends"}</span></Link>
        </div></div>
        <div className="dd-profile-intro"><h2>{p.name} {saved.mood && <span aria-label="Current mood">{saved.mood}</span>}</h2>
          {saved.bio ? <p className="dd-profile-bio">{saved.bio}</p> : !loading && !error && <p className="dd-profile-muted">{own ? "Your story, in a few words." : "No bio yet."}</p>}
          {song && !expired && <button className="dd-profile-music-link" onClick={() => setTab("music")}><span aria-hidden="true">♫</span><span>{song.name} <small>· {song.artist}</small></span></button>}
          {profileUID&&<ProfileSocialLinks uid={profileUID}/>}
          <p className="dd-profile-private"><Lock size={11}/> Private · Only you two</p>
        </div>
        <div className="dd-profile-actions">
          {own ? <button disabled={loading || !!error} onClick={() => { setEditing(true); setTab("about"); }}>Edit profile</button> : <Link to="/chat">Message</Link>}
          <Link to={own ? `/profile/${partner.id}` : "/profile"}>{own ? `View ${partner.name}` : "Your profile"}</Link>
        </div>
      </section>
      <div className="dd-profile-tabs" role="tablist" aria-label="Profile sections">
        {([ ["posts", "Posts"], ["music", "Music"], ["about", "About"] ] as const).map(([id, label], index) => <button key={id} id={`profile-tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`profile-panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={e => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) { e.preventDefault(); const ids = ["posts", "music", "about"] as const; const next = e.key === "Home" ? 0 : e.key === "End" ? 2 : (index + (e.key === "ArrowRight" ? 1 : 2)) % 3; setTab(ids[next]); document.getElementById(`profile-tab-${ids[next]}`)?.focus(); } }}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{id === "posts" ? <><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></> : id === "music" ? <><path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="17" cy="16" rx="3" ry="2.5"/></> : <><rect x="4" y="4" width="16" height="17" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M7 19c0-6 10-6 10 0M9 4V2h6v2"/></>}</svg><span>{label}</span></button>)}
      </div>
      <section id="profile-panel-posts" role="tabpanel" aria-labelledby="profile-tab-posts" hidden={tab !== "posts"}>
        {profileUID ? <ProfilePosts uid={profileUID} own={own} onCount={countPosts}/> : <div className="dd-profile-state" role={error ? "alert" : "status"}>{error || "Loading posts..."}{error && <button className="dd-btn" onClick={() => setRetry(x => x + 1)}>Retry profile</button>}</div>}
      </section>
      <div id="profile-panel-about" role="tabpanel" aria-labelledby="profile-tab-about" hidden={tab !== "about"} className="dd-profile-content">
      <ProfileStreak streak={streak.streaks[who]} failed={streak.failed} retry={streak.retry} own={own}/>
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
          {profileUID&&<ProfileSocialLinks uid={profileUID} editing onDirty={setSocialDirty}/>}
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
                if(socialDirty&&!window.confirm("Discard unsaved social links?"))return;
                setSocialDirty(false);
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
      </div>
      <section id="profile-panel-music" role="tabpanel" aria-labelledby="profile-tab-music" hidden={tab !== "music"} className="dd-card dd-profile-song-panel">
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
