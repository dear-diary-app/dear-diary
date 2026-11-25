// Merge independent video/image slots by posting time, never by media kind.
export function orderStories<T extends {created_at:string;user_id:string;kind?:string}>(items:T[]):T[]{
 return [...items].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||a.user_id.localeCompare(b.user_id)||(a.kind||'').localeCompare(b.kind||''));
}
