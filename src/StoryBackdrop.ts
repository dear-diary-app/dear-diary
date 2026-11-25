import {useEffect,type RefObject} from 'react';
// Sample the existing player. No second video, extra audio or separate download.
export function useStoryBackdrop(dialog:RefObject<HTMLDialogElement>,canvas:RefObject<HTMLCanvasElement>,url:string,image:boolean){
 useEffect(()=>{const c=canvas.current,media=dialog.current?.querySelector<HTMLVideoElement|HTMLImageElement>('[data-story-media]');if(!c||!media)return;const ctx=c.getContext('2d',{alpha:false});if(!ctx)return;
 let frame=0,last=0,disposed=false;const draw=(time=0)=>{if(disposed)return;const w=media instanceof HTMLVideoElement?media.videoWidth:media.naturalWidth,h=media instanceof HTMLVideoElement?media.videoHeight:media.naturalHeight;
 if(w&&h&&!document.hidden&&(image||time-last>=120)){const scale=240/Math.max(w,h);c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));try{ctx.drawImage(media,0,0,c.width,c.height);c.style.opacity='1';}catch{}last=time;}
 if(!image)frame=requestAnimationFrame(draw);};
 const ready=()=>{if(image)draw();};media.addEventListener(image?'load':'loadeddata',ready);draw();return()=>{disposed=true;cancelAnimationFrame(frame);media.removeEventListener(image?'load':'loadeddata',ready);};
 },[url,image]);
}
