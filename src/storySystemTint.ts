import{useLayoutEffect}from'react';
// Temporary browser-chrome suggestion only. Android may apply it to both system bars.
export function useStorySystemTint(){useLayoutEffect(()=>{
 const meta=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');if(!meta)return;
 let previous=meta.getAttribute('content'),away=false,disposed=false,applied=false;
 const observer=new MutationObserver(()=>{if(disposed)return;const current=meta.getAttribute('content');if(!away&&!document.hidden&&current!=='#000000'){previous=current;paint();}});
 const write=(value:string|null)=>{observer.disconnect();if(value===null)meta.removeAttribute('content');else meta.setAttribute('content',value);if(!disposed)observer.observe(meta,{attributes:true,attributeFilter:['content']});};
 const paint=()=>{if(!disposed&&!away&&!document.hidden){applied=true;write('#000000');}};
 const restore=()=>{if(applied){applied=false;write(previous);}};
 const visibility=()=>{if(document.hidden)restore();else{away=false;if(!applied)previous=meta.getAttribute('content');paint();}};
 const hide=()=>{away=true;restore();};const show=()=>{away=false;if(!applied)previous=meta.getAttribute('content');paint();};
 paint();document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);
 return()=>{disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);restore();};
 },[]);}
