import React,{useEffect,useRef,useState}from'react';
import type{WeatherKind}from'./Weather';

// Original procedural artwork. No images, video, remote textures or third-party shaders.
export function skyPalette(kind:WeatherKind,day:boolean){
 const night={top:'#101b30',mid:'#283c55',bottom:'#536275',glass:'25, 38, 57'};
 if(!day||kind==='clear-night')return kind==='storm'?{top:'#101622',mid:'#283142',bottom:'#48505e',glass:'25, 32, 45'}:night;
 return ({sun:{top:'#6497bf',mid:'#b2cddd',bottom:'#f4dec1',glass:'232, 241, 246'},cloud:{top:'#617486',mid:'#9caab4',bottom:'#c9d0d3',glass:'233, 238, 240'},rain:{top:'#465d72',mid:'#8399ab',bottom:'#b8c4cc',glass:'229, 236, 241'},wind:{top:'#64889e',mid:'#a5bfca',bottom:'#d6dfd9',glass:'231, 239, 238'},storm:{top:'#303b4a',mid:'#596979',bottom:'#8c9ca7',glass:'224, 231, 235'},snow:{top:'#8097af',mid:'#bdcfdd',bottom:'#e2e9ee',glass:'238, 243, 248'},'clear-night':night})[kind];
}
function random(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
function cloudTexture(seed:number){
 const w=512,h=256,rnd=random(seed),grid=Array.from({length:5},(_,o)=>{const size=4<<o;return{size,data:Float32Array.from({length:size*size},rnd)};});
 const noise=(x:number,y:number)=>{let sum=0,amp=.54;for(const g of grid){const fx=x*g.size,fy=y*g.size,ix=Math.floor(fx),iy=Math.floor(fy),a=fx-ix,b=fy-iy,u=a*a*(3-2*a),v=b*b*(3-2*b),at=(dx:number,dy:number)=>g.data[((iy+dy)%g.size)*g.size+(ix+dx)%g.size];sum+=((at(0,0)*(1-u)+at(1,0)*u)*(1-v)+(at(0,1)*(1-u)+at(1,1)*u)*v)*amp;amp*=.5;}return sum;};
 const field=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)field[y*w+x]=noise(x/w,y/h);
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d')!;const image=ctx.createImageData(w,h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,n=field[i],slope=(field[y*w+(x+3)%w]-n)*4+(field[((y+2)%h)*w+x]-n)*3;const light=Math.max(0,Math.min(1,.58+slope)),j=i*4;image.data[j]=150+light*100;image.data[j+1]=160+light*90;image.data[j+2]=173+light*77;const edge=Math.min(1,y/(h*.22),(h-1-y)/(h*.25));image.data[j+3]=Math.max(0,Math.min(255,(n-.34)*700))*Math.max(0,edge*edge*(3-2*edge));}
 ctx.putImageData(image,0,0);return canvas;
}
let textures:HTMLCanvasElement[]|null=null;
export function SkyCanvas({kind,day,animate}:{kind:WeatherKind;day:boolean;animate:boolean}){
 const time=useRef(0),ref=useRef<HTMLCanvasElement>(null),last=useRef({kind,day}),[fallback,setFallback]=useState(false);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx){setFallback(true);window.dispatchEvent(new Event('dd-sky-still'));return;}
  let alive=true,frame=0,lastPaint=0,elapsed=time.current,previous=performance.now(),transition=last.current.kind===kind&&last.current.day===day?1:0,slow=0,still=false,quality=0,scrolling=false;delete canvas.dataset.power;let w=0,h=0;const rng=random(422),particles=Array.from({length:kind==='snow'?65:110},()=>({x:rng(),y:rng(),z:.3+rng()*.7})),stars=Array.from({length:70},()=>({x:rng(),y:rng()*.7,z:rng()}));
  const resize=()=>{w=canvas.clientWidth;h=canvas.clientHeight;const scale=Math.min(1,(quality===0?640:quality===1?420:280)/Math.max(w,1));canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));w=canvas.width;h=canvas.height;};
  resize();const observer=new ResizeObserver(()=>{resize();paint(elapsed,1);});observer.observe(canvas);
  if(!textures)textures=[cloudTexture(71),cloudTexture(208)];
  const old=last.current;last.current={kind,day};
  function scene(k:WeatherKind,d:boolean,t:number){
   if(!ctx||!textures)return;const p=skyPalette(k,d),gradient=ctx.createLinearGradient(0,0,0,h);gradient.addColorStop(0,p.top);gradient.addColorStop(.58,p.mid);gradient.addColorStop(1,p.bottom);ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
   const clear=k==='sun'||k==='clear-night',night=!d||k==='clear-night';
   if(night){for(const s of stars){ctx.globalAlpha=(clear?.65:.12)*s.z;ctx.fillStyle='#e9f1ff';ctx.beginPath();ctx.arc(s.x*w,s.y*h,.4+s.z*.7,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
   if(clear||k==='wind'){
    const x=w*.78,y=h*.16,r=w*(night?.047:.08),glow=ctx.createRadialGradient(x,y,0,x,y,r*6);glow.addColorStop(0,night?'#dbe7ff50':'#fff4d7c0');glow.addColorStop(.15,night?'#e1eaff28':'#ffeccc66');glow.addColorStop(1,'#ffe9bd00');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    const disc=ctx.createRadialGradient(x,y,0,x,y,r*1.15);disc.addColorStop(0,night?'#e2e9f3':'#fff8e7');disc.addColorStop(.82,night?'#e2e9f3':'#fff5da');disc.addColorStop(1,night?'#e2e9f300':'#fff5da00');ctx.fillStyle=disc;ctx.fillRect(x-r*1.15,y-r*1.15,r*2.3,r*2.3);
    if(night){ctx.globalAlpha=.12;for(let i=0;i<7;i++){ctx.fillStyle='#75859b';ctx.beginPath();ctx.arc(x+(rngFixed(i)-.5)*r,y+(rngFixed(i+9)-.5)*r,r*(.08+rngFixed(i+18)*.14),0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
   }
   const dense=['cloud','rain','storm','snow'].includes(k);for(let layer=0;layer<(quality===2?2:3);layer++){
    const tw=w*(layer===0?2.8:layer===1?2.1:1.7),th=h*(dense?.84:.5),speed=k==='wind'?18:layer===0?2.8:4.6+layer*2,offset=((t*speed+layer*w*.49)%tw+tw)%tw;
    ctx.globalAlpha=(dense?.68:.20)*(night?.72:1)*(layer===2?.65:1);ctx.filter=k==='storm'?'brightness(.52) contrast(1.25)':night?'brightness(.68) saturate(.65)':'none';
    for(let copy=-1;copy<2;copy++)ctx.drawImage(textures[layer%2],copy*tw-offset,-th*.18+layer*h*.16,tw,th);
   }ctx.filter='none';ctx.globalAlpha=1;
   if(k==='rain'||k==='storm'){
    for(const v of particles){const z=v.z,x=((v.x-t*.032*z)%1+1)%1*w,y=(v.y+t*(.38+z*.48))%1*h;ctx.strokeStyle=night?`rgba(183,208,230,${.12+z*.2})`:`rgba(223,238,248,${.2+z*.38})`;ctx.lineWidth=.35+z*.95;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-3*z,y+15*z);ctx.stroke();
     if(v.z>.75){const cycle=(t*.8+v.y)%1;ctx.globalAlpha=(1-cycle)*.12;ctx.strokeStyle='#dbeaf4';ctx.beginPath();ctx.ellipse(v.x*w,h*(.8+v.y*.2),cycle*8*z,cycle*2*z,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    }
    const mist=ctx.createLinearGradient(0,h*.5,0,h);mist.addColorStop(0,'#9baebb00');mist.addColorStop(1,night?'#71839825':'#e4edf33d');ctx.fillStyle=mist;ctx.fillRect(0,h*.5,w,h*.5);
   }
   if(k==='snow')for(const v of particles){ctx.globalAlpha=.3+v.z*.6;ctx.fillStyle='#f4f8ff';ctx.beginPath();ctx.arc(((v.x+Math.sin(t*.25+v.y*10)*.025+t*.004)%1)*w,((v.y+t*(.015+v.z*.035))%1)*h,.6+v.z*2.1,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
   // Slow cloud brightening, never lightning or a full-screen flash.
   if(k==='storm'){ctx.globalAlpha=.025+.015*Math.sin(t*.22);ctx.fillStyle='#e5eaf5';ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;}
   const topBlend=ctx.createLinearGradient(0,0,0,h*.1);topBlend.addColorStop(0,p.top);topBlend.addColorStop(1,p.top+'00');ctx.fillStyle=topBlend;ctx.fillRect(0,0,w,h*.1);
  }
  const oldCanvas=document.createElement('canvas');oldCanvas.width=w;oldCanvas.height=h;scene(old.kind,old.day,0);oldCanvas.getContext('2d')?.drawImage(canvas,0,0);
  function paint(t:number,mix:number){if(!ctx)return;scene(kind,day,t);if(mix<1){ctx.globalAlpha=1-mix;ctx.drawImage(oldCanvas,0,0,w,h);ctx.globalAlpha=1;}}
  const tick=(now:number)=>{if(!alive)return;frame=requestAnimationFrame(tick);if(document.hidden){cancelAnimationFrame(frame);frame=0;previous=now;return;}const fps=scrolling?6:quality===0?24:quality===1?16:10;if(now-lastPaint<1000/fps)return;const start=performance.now(),dt=Math.max(0,Math.min(.1,(now-previous)/1000));previous=now;lastPaint=now-(now-lastPaint)%(1000/fps);if(animate&&!still)elapsed+=dt;time.current=elapsed;transition=Math.min(1,transition+dt/1.4);paint(elapsed,animate?transition:1);const cost=performance.now()-start;slow=cost>(quality===2?50:22)?slow+1:Math.max(0,slow-1);if(slow>24){slow=0;if(quality<2){quality++;canvas.dataset.power=quality===1?'adaptive-light':'adaptive-low';resize();}else{still=true;canvas.dataset.power='adaptive-still';window.dispatchEvent(new Event('dd-sky-still'));}}if((!animate||still)&&transition>=1){cancelAnimationFrame(frame);frame=0;}};
  paint(elapsed,animate?transition:1);if(animate)frame=requestAnimationFrame(tick);const visibility=()=>{previous=performance.now();if(animate&&!document.hidden&&!frame)frame=requestAnimationFrame(tick);};document.addEventListener('visibilitychange',visibility);const scrollState=(e:Event)=>{scrolling=!!(e as CustomEvent).detail;};window.addEventListener('dd-chat-scroll',scrollState);
  return()=>{alive=false;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('dd-chat-scroll',scrollState);};
 },[kind,day,animate]);
 return <canvas ref={ref} className={`dd-sky-canvas${fallback?' is-fallback':''}`} data-renderer={fallback?'css':'canvas2d'} aria-hidden="true"/>;
}
function rngFixed(i:number){return(Math.sin(i*127.1+311.7)*43758.5453)%1*.5+.5;}
