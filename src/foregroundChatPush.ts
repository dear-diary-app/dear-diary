// Answer only this app's worker. No account state is persisted in the worker.
export function listenForForegroundChatPush(accountId:string|null){
 const reply=(event:MessageEvent)=>{
  if(event.data?.type!=='diary-check-chat-foreground'||!event.ports?.[0])return;
  event.ports[0].postMessage({account_id:accountId,foreground:document.visibilityState==='visible'&&document.hasFocus()});
  event.ports[0].close();
 };
 navigator.serviceWorker?.addEventListener('message',reply);
 return()=>navigator.serviceWorker?.removeEventListener('message',reply);
}
