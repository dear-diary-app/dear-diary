export function languageTags(title:string):string[]{
 const t=title.toLowerCase();const tags:string[]=[];
 if(/\bhindi\b|हिन्दी|हिंदी/.test(t)&&/dub|डब/.test(t))tags.push('Hindi dub');
 if(/\b(english|eng)\b/.test(t)&&/dub/.test(t))tags.push('English dub');
 if(/\b(japanese|jpn|jp)\b.*\bdub\b|\b(?:japanese|jpn|jp)[ -]?(?:audio|version)\b|日本語/.test(t))tags.push('Japanese audio');
 if(/\b(subbed|subtitles?|(?:en|eng|english)[ -]?sub|multi[ -]?sub)\b|字幕/.test(t))tags.push('Subbed');
 return tags.length?tags:['Language not specified'];
}
export function playlistKind(title:string):'movies'|'series'|'extras'{
 if(/trailer|teaser|pv\b|promo|opening|ending|clips?|behind.the.scenes|interview/i.test(title))return'extras';
 if(/\bmovies?\b|\bfilms?\b|劇場版/i.test(title))return'movies';return'series';
}
export interface Channel{id:string;name:string;url:string;note:string;sources:string[]}
export interface Playlist{id:string;title:string;description?:string;thumbnail?:string;count:number|null;channel:string;tags:string[];kind:'movies'|'series'|'extras'}
export interface Episode{id:string;title:string;thumbnail?:string;channel:string;tags:string[];position:number;available:boolean;availability?:'unknown';reason?:string;duration?:string}

// Title evidence only. Never infer an audio language from a subtitle language.
export function preferredAudio(title:string):boolean{
 const t=title.toLowerCase();
 const unsupported=/\b(?:bengali|bangla|tamil|telugu|kannada|malayalam|marathi|gujarati|punjabi|odia|thai|indonesian|vietnamese|mandarin|cantonese|chinese|korean|spanish|portuguese|french|german|arabic|russian)\b(?:[ -]*(?:dub(?:bed)?|audio|version))?/g;
 if(!unsupported.test(t))return true;
 // Mixed-language offerings or explicitly Japanese audio with other subtitles stay.
 return /\b(?:hindi|english|eng|japanese|jp|jpn)[ -]*(?:dub(?:bed)?|audio|version)\b|日本語/.test(t);
}
