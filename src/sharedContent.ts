export type SharedMessage = {id:string;sender_id:string;recipient_id:string;created_at:string;body:string;images:string[];gif_id:string|null};
export function sharedLinks(text:string):string[]{
    const out=new Set<string>();
    for(const match of text.matchAll(/(?:https?:\/\/|www\.)[^\s<>"`]+/gi))for(const candidate of match[0].split(/,(?=https?:\/\/|www\.)/i)){
        let s=candidate.replace(/[.,!?;:'\u2019\u201d\u0964]+$/u,'');
        for(const [open,close] of [['(',')'],['[',']'],['{','}']])while(s.endsWith(close)&&s.split(close).length>s.split(open).length)s=s.slice(0,-1);
        if(s.length>2048)continue;
        try{const u=new URL(/^www\./i.test(s)?`https://${s}`:s);if(!['http:','https:'].includes(u.protocol)||!u.hostname||u.username||u.password)continue;out.add(u.href);}catch{/* Not a web link. */}
    }
    return [...out];
}
export function hasSharedContent(m:SharedMessage){return !m.gif_id&&(m.images.length>0||sharedLinks(m.body).length>0);}
