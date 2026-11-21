export interface DiarySheet { text:string; start:number; end:number }
// All readers use one logical 360px paper, scaled by CSS. Bundled fonts keep
// wrapping and sticker page numbers stable across screen widths.
let measure:HTMLDivElement | null=null;
export function paginateDiary(text:string):DiarySheet[] {
    if(!measure){measure=document.createElement('div');measure.style.cssText='position:fixed;left:-10000px;top:0;width:308px;font:16.5px DiarySerif,DiaryBengali,serif;line-height:31px;white-space:pre-wrap;overflow-wrap:anywhere;visibility:hidden;pointer-events:none;';document.body.appendChild(measure);}
    const fits=(s:string)=>{measure!.textContent=s||'\u200b';return measure!.getBoundingClientRect().height<=434.5;};
    const pages:DiarySheet[]=[];let start=0;
    while(start<text.length){
        const remaining=text.slice(start);
        if(fits(remaining)){pages.push({text:remaining,start,end:text.length});start=text.length;break;}
        let low=1,high=remaining.length;
        while(low<high){const mid=Math.ceil((low+high)/2);if(fits(remaining.slice(0,mid)))low=mid;else high=mid-1;}
        let length=Math.max(1,low);
        // Do not split a surrogate pair or a normal word at the paper edge.
        if(/[\uD800-\uDBFF]/.test(remaining[length-1]??''))length--;
        const cut=Math.max(remaining.lastIndexOf(' ',length-1),remaining.lastIndexOf('\n',length-1))+1;
        if(cut>0&&cut>length*.65)length=cut;
        length=Math.max(1,length);pages.push({text:remaining.slice(0,length),start,end:start+length});start+=length;
    }
    if(!pages.length)pages.push({text:'',start:0,end:0});
    if(text.endsWith('\n')&&!fits(pages[pages.length-1].text+'\u200b'))pages.push({text:'',start:text.length,end:text.length});
    return pages;
}
