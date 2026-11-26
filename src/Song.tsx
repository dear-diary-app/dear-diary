import React, { useEffect, useRef, useState } from "react";
import { Check, Search, XIcon } from "./icons";
import {useAuth} from "./store";
import {supabase} from "./lib/supabase";
import {cleanArtists} from "./ArtistSearch";

// Store metadata only. Audio streams from the provider and is capped at 30 seconds.
export interface Song {
  id: number;
  name: string;
  artist: string;
  art: string;
  url: string;
  store?: string;
}
const storeURL = (u: unknown): u is string =>
  typeof u === "string" &&
  /^https:\/\/(music|itunes)\.apple\.com\//i.test(u) &&
  u.length < 400;
const trusted = (u: unknown): u is string =>
  typeof u === "string" &&
  /^https:\/\/[a-z0-9.-]+\.(mzstatic|apple)\.com\//i.test(u) &&
  u.length < 400;
export function cleanSong(v: unknown): Song | null {
  const s = v as Partial<Song> | null;
  if (
    !s ||
    typeof s !== "object" ||
    !Number.isFinite(s.id) ||
    typeof s.name !== "string" ||
    typeof s.artist !== "string" ||
    !trusted(s.art) ||
    !trusted(s.url)
  )
    return null;
  return {
    id: Number(s.id),
    name: s.name.slice(0, 120),
    artist: s.artist.slice(0, 120),
    art: s.art,
    url: s.url,
    ...(storeURL(s.store) ? { store: s.store } : {}),
  };
}

const Play = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
  </svg>
);
const Pause = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <rect x="6" y="5" width="4.5" height="14" rx="1.2" />
    <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" />
  </svg>
);
const Note = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      d="M9 17.5V6.3a1 1 0 0 1 .76-.97l9-2.25A1 1 0 0 1 20 4.05V15.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="6.5" cy="17.5" r="3" />
    <circle cx="17.5" cy="15.5" r="3" />
  </svg>
);

// One song at a time, and it stops when the app is hidden.
let active: { audio: HTMLAudioElement; stop: () => void } | null = null;
if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) active?.stop();
  });
if(typeof window!=='undefined'){window.addEventListener('dd-song-play',e=>{if((e as CustomEvent).detail!==active?.audio)active?.stop();});window.addEventListener('dd-voice-play',()=>active?.stop());window.addEventListener('dd-voice-record',()=>active?.stop());window.addEventListener('dd-page-lock',()=>active?.stop());}
export function usePreview(url: string) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<number>();
  const stop = () => {
    window.clearTimeout(timer.current);
    audio.current?.pause();
    setPlaying(false);
  };
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      audio.current?.pause();
      if (active?.audio === audio.current) active = null;
    },
    [],
  );
  useEffect(() => {
    audio.current?.pause();
    audio.current = null;
    setPlaying(false);
    setProgress(0);
    setFailed(false);
  }, [url]);
  const toggle = () => {
    if (!audio.current) {
      const a = new Audio(url);
      a.preload = "none";
      a.ontimeupdate = () => {
        if (a.currentTime >= 30) {
          stop();
          a.currentTime = 0;
          setProgress(0);
        } else setProgress(a.currentTime / Math.min(a.duration || 30, 30));
      };
      a.onplaying = () => {
        setPlaying(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(
          () => {
            stop();
            a.currentTime = 0;
            setProgress(0);
          },
          Math.max(0, (30 - a.currentTime) * 1000),
        );
      };
      a.onpause = () => {
        window.clearTimeout(timer.current);
        setPlaying(false);
      };
      a.onended = () => {
        stop();
        a.currentTime = 0;
        setProgress(0);
      };
      a.onerror = () => {
        stop();
        setFailed(true);
      };
      audio.current = a;
    }
    const a = audio.current;
    if (!a.paused) {
      stop();
      return;
    }
    if (active && active.audio !== a) active.stop();
    active = { audio: a, stop };
    window.dispatchEvent(new CustomEvent('dd-song-play',{detail:a}));
    setFailed(false);
    if (a.currentTime >= 30 || a.ended) a.currentTime = 0;
    a.play().catch(() => {
      setPlaying(false);
      setFailed(true);
    });
  };
  return { playing, progress, failed, toggle, stop };
}

// A compact profile-header player, using the same preview rules as the song card.
export function ProfileSongInline({song,onDetails}:{song:Song;onDetails:()=>void}) {
 const p=usePreview(song.url);
 return <div className="dd-profile-song-inline"><div className="dd-profile-song-row"><button type="button" className="dd-profile-song-toggle" aria-label={`${p.playing?'Pause':'Play'} profile song: ${song.name}`} aria-pressed={p.playing} onClick={p.toggle}><svg className="dd-profile-song-progress" viewBox="0 0 38 38" aria-hidden="true"><circle className="dd-profile-song-progress-track" cx="19" cy="19" r="17"/><circle className="dd-profile-song-progress-value" cx="19" cy="19" r="17" pathLength="100" strokeDasharray="100" strokeDashoffset={100-Math.max(0,Math.min(1,p.progress))*100}/></svg>{p.playing?<Pause/>:<Play/>}</button><button type="button" className="dd-profile-music-link" onClick={onDetails}><span>{song.name} <small>· {song.artist}</small></span></button></div>{p.failed&&<p role="status">Could not play this song. Tap play to retry.</p>}</div>;
}

const links = new Map<number, string>();
function useStoreLink(song: Song) {
  const [url, setURL] = useState(song.store || links.get(song.id));
  useEffect(() => {
    setURL(song.store || links.get(song.id));
    if (song.store || links.has(song.id)) return;
    const ctl = new AbortController();
    fetch(`https://itunes.apple.com/lookup?id=${song.id}&country=IN`, {
      signal: ctl.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        const hit = d.results?.find((v: Hit) => v.trackId === song.id);
        if (storeURL(hit?.trackViewUrl)) {
          links.set(song.id, hit.trackViewUrl);
          setURL(hit.trackViewUrl);
        }
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [song.id, song.store]);
  return url;
}
function Credit({ url }: { url?: string }) {
  return (
    <div className="dd-song-credit">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
        >
          <img
            src={`${import.meta.env.BASE_URL}itunes-store-badge.svg`}
            alt="Get it on iTunes Store"
            height="30"
          />
        </a>
      ) : (
        <span>Store link unavailable. Preview paused.</span>
      )}
      <span>
        Preview provided courtesy of iTunes.
      </span>
    </div>
  );
}

export function SongPill({
  song,
  onRemove,
  compact = false,
}: {
  song: Song;
  onRemove?: () => void;
  compact?: boolean;
}) {
  const store = useStoreLink(song);
  const p = usePreview(song.url);
  return (
    <div className={`dd-song${p.playing ? " is-playing" : ""}`}>
      <button
        type="button"
        className="dd-song-main"
        onClick={p.toggle}
        disabled={!store}
        aria-label={`${p.playing ? "Pause" : "Play"} ${song.name} by ${song.artist}`}
      >
        <img src={song.art} alt="" width="48" height="48" />
        <span className="dd-song-text">
          <strong>{song.name}</strong>
          <small>
            <Note /> {song.artist}
          </small>
        </span>
        <span className="dd-song-play">{p.playing ? <Pause /> : <Play />}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          className="dd-song-remove"
          onClick={onRemove}
          aria-label="Remove song"
        >
          <XIcon size={16} />
        </button>
      )}
      <span className="dd-song-bar" aria-hidden="true">
        <i style={{ width: `${p.progress * 100}%` }} />
      </span>
      {p.failed && (
        <small className="dd-song-error" role="status">
          Could not play this song. Check your connection.
        </small>
      )}
    </div>
  );
}

interface Hit {
  trackTimeMillis?: number;
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  previewUrl?: string;
  trackViewUrl?: string;
}
function Result({
  hit,
  chosen,
  onPick,
  compact = false,
  showDuration = false,
  hideCredit = false,
}: {
  hideCredit?: boolean;
  showDuration?: boolean;
  hit: Hit;
  compact?: boolean;
  chosen: boolean;
  onPick: () => void;
}) {
  const p = usePreview(hit.previewUrl ?? "");
  return (
    <li className="dd-song-hit">
      <button
        type="button"
        className="dd-song-hit-play"
        onClick={p.toggle}
        aria-label={`${p.playing ? "Pause" : "Listen to"} ${hit.trackName}`}
      >
        <img
          src={hit.artworkUrl100}
          alt=""
          width="44"
          height="44"
          loading="lazy"
        />
        <span>{p.playing ? <Pause /> : <Play />}</span>
      </button>
      <span className="dd-song-text">
        <strong>{hit.trackName}</strong>
        <small>{hit.artistName}{showDuration && Number.isFinite(hit.trackTimeMillis) && <> · {Math.floor(hit.trackTimeMillis!/60000)}:{String(Math.floor(hit.trackTimeMillis!/1000)%60).padStart(2,"0")}</>}</small>
      </span>
      <button type="button" className="dd-song-use" onClick={onPick}>
        {chosen ? (
          <>
            <Check size={14} /> Added
          </>
        ) : (
          "Use"
        )}
      </button>
      {!compact && !hideCredit && (
        <Credit
          url={storeURL(hit.trackViewUrl) ? hit.trackViewUrl : undefined}
        />
      )}
    </li>
  );
}

// Inbox-only recommendations. No preference writes or partner-taste reads.
function InboxSongSuggestions({song,onPick}:{song?:Song|null;onPick:(h:Hit)=>void}){
 const{session}=useAuth(),uid=session?.user.id;const[hits,setHits]=useState<Hit[]>([]),[state,setState]=useState('loading'),[more,setMore]=useState(0),[note,setNote]=useState('');
 useEffect(()=>{if(!uid)return;let alive=true;const ctl=new AbortController();const timeout=window.setTimeout(()=>ctl.abort(),18000);setState('loading');setNote('');const split=(v:unknown)=>typeof v==='string'?v.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean):[];const norm=(v:string)=>v.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 void(async()=>{try{const r=await supabase.from('song_taste').select('genres,languages,moods,artists,artist_selections').eq('user_id',uid).maybeSingle();if(r.error)throw Error('taste');if(!alive)return;const t=r.data;const artists=Array.from(new Set([...cleanArtists(t?.artist_selections).map(a=>a.name),...split(t?.artists)])).slice(0,20),genres=split(t?.genres),languages=split(t?.languages),moods=split(t?.moods);if(!artists.length&&!genres.length&&!languages.length&&!moods.length){setState('empty');return;}const start=(more*4)%Math.max(artists.length,1),rotated=[...artists.slice(start),...artists.slice(0,start)];const context=Array.from(new Set([...[0,1].map(i=>[languages[(more+i)%Math.max(languages.length,1)],genres[(more+i)%Math.max(genres.length,1)],moods[(more+i)%Math.max(moods.length,1)]].filter(Boolean).join(' '))])).filter(v=>v.length>=2);const terms=[...rotated.slice(0,4).map(term=>({term,artist:true})),...context.map(term=>({term,artist:false}))].slice(0,6);let failed=0;const found:Hit[]=[];for(let n=0;n<terms.length;n+=2){const results=await Promise.all(terms.slice(n,n+2).map(async({term,artist})=>{try{const resp=await fetch('https://itunes.apple.com/search?'+new URLSearchParams({term,media:'music',entity:'song',limit:'25',country:'IN'}),{signal:ctl.signal});if(!resp.ok)throw Error();const d=await resp.json();return (d.results||[]).filter((h:Hit)=>h.trackId&&typeof h.trackName==='string'&&typeof h.artistName==='string'&&trusted(h.previewUrl)&&trusted(h.artworkUrl100)&&storeURL(h.trackViewUrl)&&(!artist||norm(h.artistName).includes(norm(term)))) as Hit[];}catch(e){if(ctl.signal.aborted)throw e;failed++;return [];}}));found.push(...results.flat());if(!alive)return;}
 const unique=Array.from(new Map(found.map(h=>[h.trackId,h])).values()).slice(0,60);setHits(old=>more?Array.from(new Map([...old,...unique].map(h=>[h.trackId,h])).values()).slice(0,120):unique);setNote(failed?'Some catalog searches were unavailable. These are the matches that loaded.':'Based on your saved artists, genres, languages and moods. Mood and lyric language are not guaranteed.');setState(unique.length?'ready':failed?'error':'nomatch');}catch{if(alive){setState('error');setNote('Could not load suggestions. Search still works, or retry.');}}})();return()=>{alive=false;window.clearTimeout(timeout);ctl.abort();};},[uid,more]);
 return <div className="dd-inbox-suggestions" aria-label="Song suggestions">{state==='loading'&&<p role="status">Finding songs for you...</p>}{state==='empty'?<p className="dd-song-note">Save artists, genres, languages or moods in Settings → Song taste to get suggestions here. You can still search for any song.</p>:<><p className="dd-inbox-suggestion-note">{note}</p>{state==='nomatch'&&<p>No playable catalog matches found. Try Search or more suggestions.</p>}{state==='error'&&<p role="alert">Suggestions unavailable right now.</p>}<ul className="dd-song-list">{hits.map(h=><Result key={h.trackId} hit={h} chosen={song?.id===h.trackId} onPick={()=>onPick(h)} showDuration hideCredit/>)}</ul><button className="dd-inbox-more-songs" disabled={state==='loading'} onClick={()=>setMore(n=>n+1)}>{state==='error'?'Retry suggestions':'More suggestions'}</button>{hits.length>0&&<small>{hits.length} playable catalog matches</small>}</>}</div>;
}

export function SongPicker({
  song,
  onChange,
  compact = false,
  inboxSheet = false,
  onPicked,
}: {
  inboxSheet?: boolean;
  onPicked?: () => void;
  song?: Song | null;
  compact?: boolean;
  onChange: (s: Song | null) => void;
}) {
  const [open, setOpen] = useState(inboxSheet);
  const [tab,setTab]=useState<"foryou"|"search"|"selected">(inboxSheet?"foryou":"search");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setState("idle");
      return;
    }
    const ctl = new AbortController();
    setState("loading");
    const t = window.setTimeout(() => {
      fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=15&country=IN`,
        { signal: ctl.signal },
      )
        .then((r) => {
          if (!r.ok) throw new Error("search");
          return r.json();
        })
        .then((d: { results?: Hit[] }) => {
          setHits(
            (d.results ?? []).filter(
              (h) =>
                h.previewUrl &&
                h.trackId &&
                trusted(h.previewUrl) &&
                storeURL(h.trackViewUrl),
            ),
          );
          setState("idle");
        })
        .catch((e) => {
          if (e?.name !== "AbortError") setState("error");
        });
    }, 450);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [q]);
  const pick = (h: Hit) => {
    const s = cleanSong({
      id: h.trackId,
      name: h.trackName,
      artist: h.artistName,
      art: h.artworkUrl100.replace("100x100", "200x200"),
      url: h.previewUrl,
      store: h.trackViewUrl,
    });
    if (s) {
      onChange(s);
      setOpen(false);
      setQ("");
      onPicked?.();
    }
  };
  if(inboxSheet)return <section className="dd-inbox-music-picker" aria-label="Choose an inbox song"><label className="dd-inbox-music-search"><Search size={20}/><input type="search" value={q} onChange={e=>{setQ(e.target.value);setTab("search");}} placeholder="Search songs or artists" aria-label="Search for a song"/></label><div className="dd-inbox-music-tabs" role="tablist" aria-label="Music source"><button role="tab" aria-selected={tab==='foryou'} onClick={()=>{setQ("");setTab('foryou');}}>For you</button><button role="tab" aria-selected={tab==='search'} onClick={()=>setTab('search')}>Search</button><button role="tab" aria-selected={tab==='selected'} onClick={()=>setTab('selected')}>Selected</button></div><div hidden={tab!=='foryou'}><InboxSongSuggestions song={song} onPick={pick}/></div>{tab==='foryou'?null:tab==='selected'?song?<SongPill song={song}/>:<p className="dd-song-note">No song selected yet.</p>:<>{state==='loading'&&<p role="status">Searching...</p>}{state==='error'&&<p role="alert">Search did not work. Try a different search or check your connection.</p>}{q.trim().length<2&&<p className="dd-song-note">Find a song you love. Type at least two letters to search the catalog.</p>}{state==='idle'&&q.trim().length>=2&&!hits.length&&<p className="dd-song-note">No songs found. Try the artist name too.</p>}<ul className="dd-song-list">{hits.map(h=><Result key={h.trackId} hit={h} chosen={song?.id===h.trackId} onPick={()=>pick(h)} showDuration hideCredit/>)}</ul></>}<p className="dd-inbox-music-credit">Previews up to 30 seconds, courtesy of iTunes. Times shown are full track lengths, when available.</p></section>;
  return (
    <section className="dd-songbox" aria-label="Song for this page">
      {song ? (
        <SongPill
          song={song}
          onRemove={() => onChange(null)}
          compact={compact}
        />
      ) : (
        <button
          type="button"
          className="dd-song-add"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Note /> {open ? "Close" : "Add a song"}
        </button>
      )}
      {song && (
        <button
          type="button"
          className="dd-song-change"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Close" : "Change song"}
        </button>
      )}
      {open && (
        <div className="dd-song-panel">
          <label className="dd-song-search">
            <Search size={16} />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Song or artist, English or Hindi"
              aria-label="Search for a song"
              autoFocus
            />
          </label>
          {state === "loading" && (
            <p className="dd-song-note" role="status">
              Searching...
            </p>
          )}
          {state === "error" && (
            <p className="dd-song-note" role="status">
              Search did not work. Check your connection and try again.
            </p>
          )}
          {state === "idle" && q.trim().length >= 2 && hits.length === 0 && (
            <p className="dd-song-note">
              No songs found. Try the artist name too.
            </p>
          )}
          {hits.length > 0 && (
            <ul className="dd-song-list">
              {hits.map((h) => (
                <Result
                  compact={compact}
                  key={h.trackId}
                  hit={h}
                  chosen={song?.id === h.trackId}
                  onPick={() => pick(h)}
                />
              ))}
            </ul>
          )}
          {!compact && (
            <p className="dd-song-note">
              Up to 30 seconds, from the provider’s fixed preview. Previews
              provided courtesy of iTunes.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
