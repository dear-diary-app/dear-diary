import{useEffect}from'react';
import{useLocation,useNavigate}from'react-router-dom';
import{useAuth}from'./store';
import type{PersonId}from'./model';
export const tabPaths=(me:PersonId)=>['/',`/hub/${me}`,'/chat',`/calendar/${me}`,'/settings'];
const blocked='a,button,input,textarea,select,summary,label,[role="button"],[role="slider"],[role="tab"],[contenteditable]:not([contenteditable="false"]),.dd-chat-msg,.dd-chat-actions,.dd-chat-compose,.dd-chat-profile,.dd-viewer,.dd-shared-viewer,.dd-crop-overlay,dialog,.dd-gif-picker,.dd-emoji-picker,.dd-journal,.dd-photo,.dd-photos,.dd-bottom-nav,[data-no-tab-swipe]';
const overlay='dialog[open],.dd-viewer,.dd-shared-viewer,.dd-crop-overlay,.dd-gif-picker,.dd-chat-profile,.dd-chat-actions,.dd-overlay,.dd-entry-shell';
function selected(){return !!window.getSelection()?.toString();}
function editing(){const draft=document.querySelector<HTMLTextAreaElement>('.dd-chat-compose textarea');if(draft?.value.trim()||document.querySelector('.dd-chat-staged,.dd-chat-replybar'))return true;const e=document.activeElement;return e instanceof HTMLElement&&(e.matches('input,textarea,select')||e.isContentEditable);}
function horizontalControl(target:Element,root:Element){for(let e:Element|null=target;e&&e!==root;e=e.parentElement){const s=getComputedStyle(e);if(/auto|scroll/.test(s.overflowX)&&e.scrollWidth>e.clientWidth+2)return true;if(s.touchAction==='none'||s.touchAction.includes('pan-x'))return true;}return false;}
export function TabSwipe({children}:{children:React.ReactNode}){
 const{me}=useAuth(),location=useLocation(),navigate=useNavigate();
 useEffect(()=>{
  if(!me)return;const paths=tabPaths(me),at=paths.indexOf(location.pathname);if(at<0)return;
  let gesture:{id:number;x:number;y:number;time:number;locked:boolean;dx:number;dy:number;root:Element}|null=null;
  let preserveInteraction=false;
  const pointerStart=(e:PointerEvent)=>{preserveInteraction=selected()||editing();if(e.pointerType==='touch'&&!e.isPrimary)gesture=null;};
  const cancel=()=>{gesture=null;};
  const start=(e:TouchEvent)=>{cancel();if(e.touches.length!==1||preserveInteraction||editing()||selected()||document.querySelector(overlay))return;const t=e.touches[0],target=e.target;if(!(target instanceof Element))return;const root=target.closest('[data-tab-swipe]');if(!root||target.closest(blocked)||horizontalControl(target,root)||t.clientX<32||t.clientX>innerWidth-32||document.documentElement.dataset.pageSlide)return;gesture={id:t.identifier,x:t.clientX,y:t.clientY,time:performance.now(),locked:false,dx:0,dy:0,root};};
  const move=(e:TouchEvent)=>{const g=gesture;if(!g)return;if(e.touches.length!==1||editing()||selected()||document.querySelector(overlay)){cancel();return;}const t=Array.from(e.touches).find(t=>t.identifier===g.id);if(!t){cancel();return;}g.dx=t.clientX-g.x;g.dy=t.clientY-g.y;const x=Math.abs(g.dx),y=Math.abs(g.dy);
   if(!g.locked){if(performance.now()-g.time>=430){cancel();return;}if(y>12&&y>x*.65){cancel();return;}if(x<18)return;if(x<y*1.7){cancel();return;}const next=at+(g.dx<0?1:-1);if(next<0||next>=paths.length){cancel();return;}g.locked=true;}
   if(e.cancelable)e.preventDefault();else cancel();
  };
  const end=(e:TouchEvent)=>{const g=gesture;cancel();if(!g?.locked||e.touches.length||selected()||editing()||document.querySelector(overlay))return;const t=Array.from(e.changedTouches).find(t=>t.identifier===g.id);if(!t)return;const dx=t.clientX-g.x,dy=t.clientY-g.y,time=performance.now()-g.time,x=Math.abs(dx);if(time>1100||x<Math.abs(dy)*1.7||Math.sign(dx)!==Math.sign(g.dx))return;if(x<72&&!(x>=44&&x/Math.max(time,1)>=.5))return;const next=at+(dx<0?1:-1);if(next<0||next>=paths.length)return;navigate(paths[next],{state:{tabSwipe:dx<0?'forward':'back'}});};
  document.addEventListener('pointerdown',pointerStart,true);document.addEventListener('touchstart',start,{passive:true});document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',end,{passive:true});document.addEventListener('touchcancel',cancel,{passive:true});window.addEventListener('blur',cancel);window.addEventListener('pagehide',cancel);
  return()=>{document.removeEventListener('pointerdown',pointerStart,true);document.removeEventListener('touchstart',start);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',end);document.removeEventListener('touchcancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('pagehide',cancel);};
 },[me,location.pathname,navigate]);
 return <div data-tab-swipe="">{children}</div>;
}
