const key=(uid:string)=>`dd_share_typing_${uid}`;
export function shareTypingEnabled(uid:string){try{return localStorage.getItem(key(uid))!=='off';}catch{return true;}}
export function saveShareTyping(uid:string,on:boolean){localStorage.setItem(key(uid),on?'on':'off');window.dispatchEvent(new Event('dd-typing-preference'));}
