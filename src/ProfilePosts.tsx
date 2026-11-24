import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { FeedPhoto } from './Feed';
type Tile = { id: string; paths: string[]; created_at: string };
export function ProfilePosts({ uid, own, onCount }: { uid: string; own: boolean; onCount: (n: number | null) => void }) {
  const [posts, setPosts] = useState<Tile[]>([]), [loading, setLoading] = useState(true), [failed, setFailed] = useState(false), [page, setPage] = useState(0), [retry, setRetry] = useState(0), [more, setMore] = useState(false);
  useEffect(() => {
    if (!uid) return;
    let active = true;
    setLoading(true); setFailed(false);
    void (async () => {
      const r = await supabase.from('feed_posts').select('id,paths,created_at', { count: 'exact' }).eq('owner_id', uid).order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * 24, page * 24 + 23);
      if (!active) return;
      setLoading(false);
      if (r.error) { setFailed(true); if (!page) onCount(null); return; }
      onCount(r.count ?? null);
      setPosts(prev => page ? [...prev, ...(r.data || []).filter(p => !prev.some(x => x.id === p.id))] : (r.data || []));
      setMore(r.count != null ? (page + 1) * 24 < r.count : r.data?.length === 24);
    })();
    return () => { active = false; };
  }, [uid, page, retry, onCount]);
  return <>
    {!!posts.length && <div className="dd-profile-grid">{posts.map((p, i) => <Link key={p.id} to={`/?post=${encodeURIComponent(p.id)}`} className="dd-profile-tile" onClick={e => { if ((e.target as Element).closest("button")) e.preventDefault(); }} aria-label={`Open ${own ? 'your' : "friend's"} post ${i + 1}`}><FeedPhoto id={p.id} index={0}/>{p.paths.length > 1 && <span className="dd-profile-multiple" aria-label={`${p.paths.length} photos`}>▣</span>}</Link>)}</div>}
    {loading && <p className="dd-profile-state" role="status">Loading posts...</p>}
    {failed && <div className="dd-profile-state" role="alert"><p>Posts could not load.</p><button className="dd-btn" onClick={() => setRetry(n => n + 1)}>Retry posts</button></div>}
    {!loading && !failed && !posts.length && <div className="dd-profile-empty"><span aria-hidden="true">◎</span><h2>No posts yet</h2><p>{own ? 'The moments you share on Home will appear here.' : 'Shared moments will appear here.'}</p>{own && <Link to="/">Share your first moment</Link>}</div>}
    {!loading && !failed && more && <button className="dd-btn dd-profile-more" onClick={() => setPage(n => n + 1)}>Older posts</button>}
  </>;
}
