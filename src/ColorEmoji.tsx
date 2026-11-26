import React from'react';
export const colorEmojiURL=(emoji:string)=>import.meta.env.BASE_URL+'emoji/'+Array.from(emoji).filter(c=>c.codePointAt(0)!==0xfe0f).map(c=>c.codePointAt(0)!.toString(16)).join('-')+'.png';
export function ColorEmoji({emoji}:{emoji:string}){return <img className="dd-color-emoji" src={colorEmojiURL(emoji)} alt={emoji} draggable={false}/>;}
export const STORY_STICKERS=['❤️','✨','🥰','🌸','🦋','🔥','🎂','☀️','🌙','💫','🧸','🌈','💋','🎉','💕','🥹'];
