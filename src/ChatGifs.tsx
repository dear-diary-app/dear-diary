import React, { useEffect, useRef, useState } from 'react';
import { XIcon } from './icons';
export type Gif = { id: string; title: string; url: string; still: string; page: string; author: string; width: number; height: number };
export const isGifId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9]{1,80}$/.test(id);
const key = import.meta.env.VITE_GIPHY_KEY as string | undefined;
const safeUrl = (s: unknown) => { try { const u = new URL(String(s)); return u.protocol === 'https:' && (u.hostname === 'giphy.com' || u.hostname.endsWith('.giphy.com')) ? u.href : ''; } catch { return ''; } };
function cleanGif(g: any): Gif | null {
    if (!g || !isGifId(g.id) || g.rating !== 'g') return null;
    const im = g.images?.fixed_width ?? g.images?.original;
    const url = safeUrl(im?.webp || im?.url), still = safeUrl(g.images?.fixed_width_still?.url || g.images?.original_still?.url), page = safeUrl(g.url);
    if (!url || !still || !page) return null;
    return { id: g.id, title: String(g.title || 'GIF').slice(0,160), url, still, page, author: String(g.user?.display_name || g.username || g.source_tld || 'GIPHY').slice(0,80), width: Number(im.width) || 200, height: Number(im.height) || 160 };
}
async function request(params: Record<string,string>, signal: AbortSignal, ids = false) {
    if (!key) throw new Error('GIF search is not configured yet.');
    const q = new URLSearchParams({ api_key: key, ...params });
    const controller = new AbortController();
    const stop = () => controller.abort(); signal.addEventListener('abort',stop,{once:true});
    const timeout = window.setTimeout(stop,12000);
    let r: Response;
    try { r = await fetch(`https://api.giphy.com/v1/gifs${ids ? '' : '/search'}?${q}`, { signal:controller.signal, cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer' }); }
    catch (e) { if (signal.aborted) throw e; throw new Error('Could not reach GIPHY. Check your connection and try again.'); }
    finally { window.clearTimeout(timeout); signal.removeEventListener('abort',stop); }
    if (r.status === 429) throw new Error("GIPHY's hourly limit is reached. Please try again later.");
    if (!r.ok) throw new Error('Could not load GIFs. Please try again.');
    const data = await r.json();
    if (!Array.isArray(data.data)) throw new Error('Could not load GIFs. Please try again.');
    return { gifs: data.data.map(cleanGif).filter((g: Gif | null): g is Gif => !!g), next: Number(data.pagination?.offset || 0) + Number(data.pagination?.count || 0), more: Number(data.pagination?.offset || 0) + Number(data.pagination?.count || 0) < Number(data.pagination?.total_count || 0) };
}
export function useChatGifs(ids: string[]) {
    const [items, setItems] = useState<Record<string, Gif | null>>({}), [error,setError] = useState(''), [attempt,retry] = useState(0);
    const seen = useRef(new Set<string>()), saved = useRef<Record<string,Gif | null>>({});
    const signature = [...new Set(ids.filter(isGifId))].sort().join(',');
    useEffect(() => {
        const controller = new AbortController(); let dead = false;
        const wanted = signature.split(',').filter(Boolean), missing = wanted.filter(id => !seen.current.has(id));
        if (!missing.length) return;
        missing.forEach(id => seen.current.add(id));
        void (async () => {
            try {
                for (let i=0;i<missing.length;i+=25) {
                    const batch = missing.slice(i,i+25), r = await request({ids:batch.join(',')},controller.signal,true);
                    if (dead) return;
                    const next = {...saved.current}; batch.forEach(id => {next[id] = r.gifs.find((g: Gif)=>g.id===id) ?? null;});
                    saved.current=next;setItems(next);setError('');
                }
            } catch(e) { if (!dead) { missing.forEach(id=>seen.current.delete(id)); setError((e as Error).message); } }
        })();
        return () => {dead=true;controller.abort();missing.forEach(id=>{if(!(id in saved.current))seen.current.delete(id);});};
    },[signature,attempt]);
    return {items,error,retry:()=>{setError('');retry(n=>n+1);}};
}
export function GifMedia({gif}:{gif:Gif}) {
    const [playing,setPlaying] = useState(()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches),[failed,setFailed]=useState(false);
    return <div className="dd-gif-media"><img src={playing?gif.url:gif.still} alt={gif.title} width={gif.width} height={gif.height} draggable={false} loading="lazy" referrerPolicy="no-referrer" onLoad={e=>{setFailed(false);e.currentTarget.classList.add('dd-media-ready');}} onError={()=>setFailed(true)} />
        <button type="button" className="dd-gif-play" aria-label={playing?'Pause GIF':'Play GIF'} onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setPlaying(v=>!v);}}>{playing?'Pause':'Play'} GIF</button>
        {failed&&<span className="dd-gif-failed">GIF could not load</span>}
    </div>;
}
export function GifCredit({gif}:{gif:Gif}) { return <a className="dd-gif-credit" href={gif.page} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>{gif.author} · GIPHY</a>; }
export function GifPicker({onSend,onClose,height}:{onSend:(id:string)=>void;onClose:()=>void;height:number}) {
    const [query,setQuery]=useState(''),[results,setResults]=useState<Gif[]>([]),[chosen,setChosen]=useState<Gif|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(false),[searched,setSearched]=useState('');
    const [next,setNext] = useState(0);
    const abort=useRef<AbortController>();const grid=useRef<HTMLDivElement>(null);
    useEffect(()=>()=>abort.current?.abort(),[]);
    const search=async(append=false)=>{const q=append?searched:query.trim();if(!q)return;abort.current?.abort();const c=new AbortController();abort.current=c;setBusy(true);setError('');setChosen(null);if(!append){setResults([]);setMore(false);setSearched(q);}try{const r=await request({q,limit:'12',offset:append?String(next):'0',rating:'g',lang:'en'},c.signal);if(c.signal.aborted)return;setResults(old=>append?[...old,...r.gifs.filter((g:Gif)=>!old.some(x=>x.id===g.id))]:r.gifs);setSearched(q);setMore(r.more);setNext(r.next);if(!append)grid.current?.scrollTo({top:0});}catch(e){if(!c.signal.aborted)setError((e as Error).message);}finally{if(!c.signal.aborted)setBusy(false);}};
    return <section className="dd-gif-picker" style={{height}} aria-label="GIF search" onKeyDown={e=>{if(e.key==='Escape')onClose();}}>
        <header><strong>Send a GIF</strong><button type="button" aria-label="Close GIF search" onClick={onClose}><XIcon size={18}/></button></header>
        <form className="dd-gif-search" onSubmit={e=>{e.preventDefault();void search();}}><input type="search" aria-label="Search GIFs" placeholder="Search GIPHY" maxLength={50} value={query} onChange={e=>setQuery(e.target.value)}/><button type="submit" disabled={busy||!query.trim()}>Search</button></form>
        <div ref={grid} className="dd-gif-results">{chosen?<div className="dd-gif-preview"><GifMedia gif={chosen}/><GifCredit gif={chosen}/><div><button type="button" onClick={()=>setChosen(null)}>Back to results</button><button type="button" className="dd-btn-primary" onClick={()=>onSend(chosen.id)}>Send GIF</button></div></div>:<>
            {!searched&&!busy&&<p>Search for a feeling, then preview a GIF before sending.</p>}
            <div className="dd-gif-grid">{results.map(g=><button type="button" key={g.id} aria-label={`Preview ${g.title}`} onClick={()=>setChosen(g)}><img src={g.still} alt={g.title} loading="lazy" referrerPolicy="no-referrer"/><span>{g.author}</span></button>)}</div>
            {searched&&!results.length&&!busy&&!error&&<p>No matching GIFs. Try another word.</p>}
            {more&&<button type="button" disabled={busy} className="dd-gif-more" onClick={()=>void search(true)}>Load more GIFs</button>}
        </>}{busy&&<p role="status">Searching GIPHY...</p>}{error&&<p role="alert">{error}</p>}</div>
        <footer><img src={`${import.meta.env.BASE_URL}giphy-powered.png`} alt="Powered by GIPHY"/><span>Searches go to GIPHY. Shared free limit: 100 API calls/hour.</span></footer>
    </section>;
}
