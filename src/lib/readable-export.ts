import pack from '../sticker-pack.json';

interface ExportEntry { entry_date:string; content:string; status:string; stickers?:unknown; photos?:unknown[] }
export interface DiarySnapshot { app:string; exported_at:string; export_date:string; account:{username:string}; entries:ExportEntry[] }

// Raster pages let the browser shape Bengali, mixed scripts and emoji correctly.
// Only text and whitelisted, bundled sticker art are drawn, never entry HTML/URLs.
export async function readableDiaryPdf(data:DiarySnapshot):Promise<Blob>{
 const [{jsPDF}]=await Promise.all([import('jspdf'),(async()=>{
  for(const [family,file] of [['ExportSerif','NotoSerif.woff'],['ExportBengali','NotoSerifBengali.woff'],['ExportEmoji','NotoEmoji.ttf']]){
   if([...document.fonts].some(face=>face.family===family&&face.status==='loaded'))continue;
   const face=new FontFace(family,`url(${import.meta.env.BASE_URL}fonts/${file})`);await face.load();document.fonts.add(face);
  }
 })()]);
 const pdf=new jsPDF({unit:'pt',format:'a4',compress:true});
 pdf.setProperties({title:'Dear Diary',subject:'Your own saved diary, for reading',creator:'Dear Diary'});
 const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser could not prepare the PDF. Try another browser.');
 const art=new Map<string,HTMLImageElement>();let page=0;
 const font=(size:number)=>{ctx.font=`${size}px ExportSerif,ExportBengali,ExportEmoji,serif`;ctx.fillStyle='#5b464a';};
 const text=(s:string,x:number,y:number,size=30)=>{font(size);ctx.fillText(s,x,y);};
 const date=(key:string)=>{const d=new Date(key+'T12:00:00+05:30');return Number.isNaN(+d)?key:new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'}).format(d);};
 const start=(entry?:ExportEntry,part=1)=>{
  ctx.fillStyle='#fffaf2';ctx.fillRect(0,0,1240,1754);ctx.strokeStyle='#ead9d0';ctx.lineWidth=2;ctx.strokeRect(52,52,1136,1650);
  text('DEAR DIARY',110,115,23);text(`${data.account.username}'s diary`,110,183,46);
  ctx.fillStyle='#9e6a76';ctx.fillRect(110,214,80,4);
  text(entry?date(entry.entry_date):'Your pages, kept close',110,275,34);
  text(entry?`${entry.status==='draft'?'Draft · saved copy':'Saved diary entry'}${part>1?` · continued ${part}`:''}`:`${data.entries.length} saved ${data.entries.length===1?'entry':'entries'}`,110,319,21);
  for(let y=398;y<=1550;y+=48){ctx.strokeStyle='#eee1d6';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(110,y+10);ctx.lineTo(1130,y+10);ctx.stroke();}
 };
 const finish=()=>{
  page++;text(`Private · ${data.account.username} · ${date(data.export_date)}`,110,1637,18);text(String(page),1095,1637,22);
  if(page>1)pdf.addPage();pdf.addImage(canvas.toDataURL('image/jpeg',0.94),'JPEG',0,0,595.28,841.89,undefined,'FAST');
 };
 // Segment at grapheme boundaries so a very long Bengali word/emoji sequence
 // cannot be cut inside a combining cluster at the edge of a page.
 const Segmenter=(Intl as unknown as {Segmenter:new(locale:string,options:{granularity:string})=>{segment:(s:string)=>Iterable<{segment:string}>}}).Segmenter;
 if(!Segmenter)throw new Error('Please update your browser to download the readable PDF. Your JSON backup still works.');
 const segmenter=new Segmenter('bn',{granularity:'grapheme'});
 const wrap=(value:string)=>{
  const lines:string[]=[];font(30);
  for(const paragraph of value.replace(/\r\n?/g,'\n').split('\n')){
   let pending=Array.from(segmenter.segment(paragraph),x=>x.segment);
   if(!pending.length){lines.push('');continue;}
   while(pending.length){let end=0,lastSpace=-1,line='';while(end<pending.length&&ctx.measureText(line+pending[end]).width<=1020){line+=pending[end];if(/\s/u.test(pending[end]))lastSpace=end;end++;}
    if(end===0)end=1;else if(end<pending.length&&lastSpace>0)end=lastSpace+1;
    lines.push(pending.slice(0,end).join(''));pending=pending.slice(end);
   }
  }return lines;
 };
 if(!data.entries.length){start();text('No saved pages yet.',110,420,32);text('Your next diary entry will be part of your next download.',110,478,25);finish();}
 for(const entry of data.entries){
  const lines=wrap(String(entry.content||''));let part=0;
  for(let offset=0;offset<lines.length;offset+=24){start(entry,++part);lines.slice(offset,offset+24).forEach((line,i)=>text(line,110,390+i*48));finish();await new Promise(resolve=>setTimeout(resolve,0));}
  const stickers=Array.isArray(entry.stickers)?entry.stickers.filter((s):s is {art:string}=>!!s&&typeof s==='object'&&'art'in s&&pack.some(p=>p.id===s.art)):[];
  for(let offset=0;offset<stickers.length;offset+=20){
   start(entry,++part);text('Stickers from this entry',110,390,28);text('Arranged here for reading, not in their original positions.',110,435,20);
   for(const [i,sticker] of stickers.slice(offset,offset+20).entries()){
    let img=art.get(sticker.art);if(!img){img=new Image();img.src=`${import.meta.env.BASE_URL}stickers/${sticker.art}.webp`;await img.decode();art.set(sticker.art,img);}
    const x=130+i%4*255,y=500+Math.floor(i/4)*200;ctx.drawImage(img,x,y,140,140);text(pack.find(p=>p.id===sticker.art)!.name,x,y+168,17);
   }finish();await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 // Keep the reading copy honest: JSON remains the full structured backup.
 start();text('About this copy',110,400,34);
 const notes=['A fresh copy of your own saved diary pages.','Your partner\'s entries are not included.','Photo files and photo captions are not included in this PDF.','Stickers are collected after each entry, not over your words.','This PDF is for reading. Keep the JSON for structured backup.','The pages are images: zoom to read, rather than select text.','No copy is stored on our server. Keep this file private.'];
 notes.forEach((line,i)=>text(line,110,470+i*65,24));
 text('Exported '+new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(data.exported_at))+' IST',110,1070,22);finish();
 return pdf.output('blob');
}
