import React, { useEffect, useRef, useState } from "react";
import { XIcon } from "./icons";
export type Gif = {
  id: string;
  title: string;
  url: string;
  preview?: string;
  still: string;
  page: string;
  author: string;
  width: number;
  height: number;
};
export const isGifId = (id: unknown): id is string =>
  typeof id === "string" && /^[A-Za-z0-9]{1,80}$/.test(id);
const key = import.meta.env.VITE_GIPHY_KEY as string | undefined;
const safeUrl = (s: unknown) => {
  try {
    const u = new URL(String(s));
    return u.protocol === "https:" &&
      (u.hostname === "giphy.com" || u.hostname.endsWith(".giphy.com"))
      ? u.href
      : "";
  } catch {
    return "";
  }
};
function cleanGif(g: any): Gif | null {
  if (!g || !isGifId(g.id) || g.rating !== "g") return null;
  const im = g.images?.fixed_width ?? g.images?.original;
  const url = safeUrl(im?.webp || im?.url),
    still = safeUrl(
      g.images?.fixed_width_still?.url || g.images?.original_still?.url,
    ),
    page = safeUrl(g.url);
  if (!url || !still || !page) return null;
  const small =
    g.images?.fixed_width_downsampled ?? g.images?.fixed_width_small ?? im;
  const preview = safeUrl(small?.webp || small?.url) || url;
  return {
    preview,
    id: g.id,
    title: String(g.title || "GIF").slice(0, 160),
    url,
    still,
    page,
    author: String(
      g.user?.display_name || g.username || g.source_tld || "GIPHY",
    ).slice(0, 80),
    width: Number(im.width) || 200,
    height: Number(im.height) || 160,
  };
}
let limitedUntil = 0;
function reserveCall() {
  if (Date.now() < limitedUntil)
    throw new Error("GIF limit reached. Try again later.");
  try {
    const now = Date.now(),
      times = JSON.parse(
        localStorage.getItem("dd_gif_requests") || "[]",
      ).filter((n: unknown) => typeof n === "number" && n > now - 3600000);
    if (times.length >= 40)
      throw new Error("GIF limit reached. Try again later.");
    times.push(now);
    localStorage.setItem("dd_gif_requests", JSON.stringify(times));
  } catch (e) {
    if ((e as Error).message === "GIF limit reached. Try again later.") throw e;
  }
}
async function request(
  params: Record<string, string>,
  signal: AbortSignal,
  ids = false,
) {
  if (!key) throw new Error("GIF search is not configured yet.");
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  reserveCall();
  const q = new URLSearchParams({ api_key: key, ...params });
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop, { once: true });
  const timeout = window.setTimeout(stop, 12000);
  let r: Response;
  try {
    r = await fetch(
      `https://api.giphy.com/v1/gifs${ids ? "" : "/search"}?${q}`,
      {
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      },
    );
  } catch (e) {
    if (signal.aborted) throw e;
    throw new Error(
      "Could not reach GIPHY. Check your connection and try again.",
    );
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", stop);
  }
  if (r.status === 429) {
    limitedUntil =
      Date.now() +
      Math.max(60, Number(r.headers.get("retry-after")) || 3600) * 1000;
    throw new Error("GIF limit reached. Try again later.");
  }
  if (!r.ok) throw new Error("Could not load GIFs. Please try again.");
  const data = await r.json();
  if (!Array.isArray(data.data))
    throw new Error("Could not load GIFs. Please try again.");
  return {
    gifs: data.data.map(cleanGif).filter((g: Gif | null): g is Gif => !!g),
    next:
      Number(data.pagination?.offset || 0) +
      Number(data.pagination?.count || 0),
    more:
      Number(data.pagination?.offset || 0) +
        Number(data.pagination?.count || 0) <
      Number(data.pagination?.total_count || 0),
  };
}
export function useChatGifs(ids: string[]) {
  const [items, setItems] = useState<Record<string, Gif | null>>({}),
    [error, setError] = useState(""),
    [attempt, retry] = useState(0);
  const seen = useRef(new Set<string>()),
    saved = useRef<Record<string, Gif | null>>({});
  const signature = [...new Set(ids.filter(isGifId))].sort().join(",");
  useEffect(() => {
    const controller = new AbortController();
    let dead = false;
    const wanted = signature.split(",").filter(Boolean),
      missing = wanted.filter((id) => !seen.current.has(id));
    if (!missing.length) return;
    missing.forEach((id) => seen.current.add(id));
    void (async () => {
      try {
        for (let i = 0; i < missing.length; i += 25) {
          const batch = missing.slice(i, i + 25),
            r = await request(
              { ids: batch.join(",") },
              controller.signal,
              true,
            );
          if (dead) return;
          const next = { ...saved.current };
          batch.forEach((id) => {
            next[id] = r.gifs.find((g: Gif) => g.id === id) ?? null;
          });
          saved.current = next;
          setItems(next);
          setError("");
        }
      } catch (e) {
        if (!dead) {
          missing.forEach((id) => seen.current.delete(id));
          setError((e as Error).message);
        }
      }
    })();
    return () => {
      dead = true;
      controller.abort();
      missing.forEach((id) => {
        if (!(id in saved.current)) seen.current.delete(id);
      });
    };
  }, [signature, attempt]);
  return {
    items,
    error,
    retry: () => {
      setError("");
      retry((n) => n + 1);
    },
  };
}
export function GifMedia({ gif }: { gif: Gif }) {
  const [playing, setPlaying] = useState(
      () =>
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
        !(navigator as any).connection?.saveData,
    ),
    [failed, setFailed] = useState(false);
  return (
    <div className="dd-gif-media">
      <img
        src={playing ? gif.url : gif.still}
        alt={gif.title}
        width={gif.width}
        height={gif.height}
        draggable={false}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={(e) => {
          setFailed(false);
          e.currentTarget.classList.add("dd-media-ready");
        }}
        onError={() => setFailed(true)}
      />
      <button
        type="button"
        className="dd-gif-play"
        aria-label={playing ? "Pause GIF" : "Play GIF"}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setPlaying((v) => !v);
        }}
      >
        {playing ? "Pause" : "Play"} GIF
      </button>
      {failed && <span className="dd-gif-failed">GIF could not load</span>}
    </div>
  );
}
export function GifCredit({ gif }: { gif: Gif }) {
  return (
    <a
      className="dd-gif-credit"
      href={gif.page}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      GIPHY
    </a>
  );
}
function GifGridPreview({ gif }: { gif: Gif }) {
  const ref = useRef<HTMLImageElement>(null),
    [visible, setVisible] = useState(false),
    [moving, setMoving] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)"),
      connection = (navigator as any).connection;
    const update = () =>
      setMoving(!mq.matches && !connection?.saveData && !document.hidden);
    update();
    mq.addEventListener("change", update);
    connection?.addEventListener?.("change", update);
    document.addEventListener("visibilitychange", update);
    const observer = new IntersectionObserver(
      (es) => setVisible(es.some((e) => e.isIntersecting)),
      { root: ref.current?.closest(".dd-gif-results") || null },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      mq.removeEventListener("change", update);
      connection?.removeEventListener?.("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <img
      ref={ref}
      src={visible && moving ? gif.preview || gif.url : gif.still}
      alt={gif.title}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
export function GifPicker({
  onSend,
  onClose,
  onBusyChange,
  height,
}: {
  onSend: (id: string, messageId: string, caption: string) => Promise<boolean>;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
  height: number;
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Gif[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [more, setMore] = useState(false),
    [searched, setSearched] = useState("");
  const [next, setNext] = useState(0);
  const[selected,setSelected]=useState<Gif|null>(null),[caption,setCaption]=useState(""),[attempted,setAttempted]=useState(false);const preview=useRef<HTMLDialogElement>(null);useEffect(()=>{if(selected)preview.current?.showModal();else preview.current?.close();},[!!selected]);
  const [sending,setSending]=useState(""),[sendError,setSendError]=useState("");
  const sendingRef=useRef(false), messageIds=useRef(new Map<string,string>());
  const tap=useRef<{x:number;y:number;top:number;moved:boolean}|null>(null);
  const send=async(g:Gif)=>{
    if(sendingRef.current)return;
    sendingRef.current=true;setAttempted(true);onBusyChange(true);setSending(g.id);setSendError("");
    const id=messageIds.current.get(g.id)||crypto.randomUUID();messageIds.current.set(g.id,id);
    try{if(!await onSend(g.id,id,caption.trim()))setSendError("Could not send GIF. Check your connection, then tap Send to retry.");}
    catch{setSendError("Could not send GIF. Check your connection, then tap Send to retry.");}
    finally{sendingRef.current=false;onBusyChange(false);setSending("");}
  };
  const pending = useRef("");
  const searchRef = useRef<(append?: boolean) => Promise<void>>();
  const abort = useRef<AbortController>();
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const search = async (append = false) => {
    const q = append ? searched : query.trim();
    if (q.length < 2) return;
    if (!append && pending.current === q) return;
    if (!append && q === searched && results.length && !error) return;
    pending.current = q;
    abort.current?.abort();
    const c = new AbortController();
    abort.current = c;
    setBusy(true);
    setError("");
    if (!append) {
      setResults([]);
      setMore(false);
      setSearched(q);
    }
    try {
      const r = await request(
        {
          q,
          limit: "12",
          offset: append ? String(next) : "0",
          rating: "g",
          lang: "en",
        },
        c.signal,
      );
      if (c.signal.aborted) return;
      setResults((old) =>
        append
          ? [
              ...old,
              ...r.gifs.filter((g: Gif) => !old.some((x) => x.id === g.id)),
            ]
          : r.gifs,
      );
      setSearched(q);
      setMore(r.more);
      setNext(r.next);
      if (!append) grid.current?.scrollTo({ top: 0 });
    } catch (e) {
      if (!c.signal.aborted) setError((e as Error).message);
    } finally {
      if (abort.current === c) pending.current = "";
      if (!c.signal.aborted) setBusy(false);
    }
  };
  searchRef.current = search;
  useEffect(() => {
    abort.current?.abort();
    pending.current = "";
    setBusy(false);
    setError("");
    if (query.trim().length < 2) {
      setResults([]);
      setMore(false);
      setSearched("");
      return;
    }
    if (query.trim() !== searched) {
      setResults([]);
      setMore(false);
    }
    const timer = window.setTimeout(() => void searchRef.current?.(), 800);
    return () => window.clearTimeout(timer);
  }, [query]);
  return (
    <section
      className="dd-gif-picker"
      style={{ height }}
      aria-label="GIF search"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !sendingRef.current) onClose();
      }}
    >
      <header>
        <strong>Send a GIF</strong>
        <button type="button" aria-label="Close GIF search" disabled={!!sending} onClick={onClose}>
          <XIcon size={18} />
        </button>
      </header>
      <form
        className="dd-gif-search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input
          type="search"
          aria-label="Search GIFs"
          placeholder="Search GIPHY"
          disabled={!!sending}
          maxLength={50}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={busy || !!sending || query.trim().length < 2}>
          Search
        </button>
      </form>
      {sending && <p className="dd-gif-send-state" role="status">Sending GIF...</p>}
      {sendError && <p className="dd-gif-send-state" role="alert">{sendError}</p>}
      <div ref={grid} className="dd-gif-results">
        {!searched && !busy && <p>Type at least 2 characters. Tap a GIF to preview it and add a caption.</p>}
        <div className="dd-gif-grid">
          {results.map(g => <button type="button" key={g.id} aria-label={`Preview ${g.title}`} disabled={!!sending}
            onPointerDown={e=>{tap.current={x:e.clientX,y:e.clientY,top:grid.current?.scrollTop??0,moved:false};}}
            onPointerMove={e=>{if(tap.current&&Math.hypot(e.clientX-tap.current.x,e.clientY-tap.current.y)>10)tap.current.moved=true;}}
            onPointerCancel={()=>{if(tap.current)tap.current.moved=true;}}
            onClick={e=>{const t=tap.current;tap.current=null;if(e.detail!==0&&(!t||t.moved||Math.abs((grid.current?.scrollTop??0)-t.top)>3))return;messageIds.current.delete(g.id);setCaption("");setAttempted(false);setSendError("");setSelected(g);}}>
            <GifGridPreview gif={g}/>
          </button>)}
        </div>
        {searched && !results.length && !busy && !error && <p>No matching GIFs. Try another word.</p>}
        {more && <button type="button" disabled={busy||!!sending} className="dd-gif-more" onClick={()=>void search(true)}>Load more GIFs</button>}
        {busy && <p role="status">Searching...</p>}
        {error && <p role="alert">{error}</p>}
      </div>
      <dialog ref={preview} className="dd-gif-caption-dialog" aria-label="GIF preview" onCancel={e=>{e.preventDefault();if(!sendingRef.current)setSelected(null);}}><header><strong>GIF preview</strong><button type="button" aria-label="Close GIF preview" disabled={!!sending} onClick={()=>setSelected(null)}><XIcon size={18}/></button></header>{selected&&<><div className="dd-gif-caption-media"><GifMedia gif={selected}/><GifCredit gif={selected}/></div><label className="dd-field"><span>Caption <small>optional</small></span><textarea aria-label="GIF caption" rows={2} maxLength={2000} placeholder="Add a caption..." value={caption} disabled={!!sending||attempted} onChange={e=>setCaption(e.target.value)}/></label>{sendError&&<p role="alert">{sendError} Your GIF and caption are kept for retry.</p>}<footer><button type="button" className="dd-btn dd-btn-ghost" disabled={!!sending} onClick={()=>setSelected(null)}>Back</button><button type="button" className="dd-btn dd-btn-primary" disabled={!!sending} onClick={()=>void send(selected)}>{sending?'Sending...':sendError?'Retry send':'Send GIF'}</button></footer></>}</dialog>
      <footer>
        <img
          src={`${import.meta.env.BASE_URL}giphy-powered.png`}
          alt="Powered by GIPHY"
        />
      </footer>
    </section>
  );
}
