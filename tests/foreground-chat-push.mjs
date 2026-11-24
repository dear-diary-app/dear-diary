import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {MessageChannel} from 'node:worker_threads';
const worker=fs.readFileSync('dist/sw.js','utf8');
const account='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
async function push(windows,type='chat',id=account){
 const listeners={},shown=[];let inbox=0;
 const scope={location:{origin:'https://example.test'},registration:{showNotification:async(...args)=>shown.push(args)},addEventListener:(name,fn)=>listeners[name]=fn};
 const ctx=vm.createContext({self:scope,clients:{matchAll:async()=>windows},URL,MessageChannel,setTimeout,clearTimeout,Date,Response,AbortController,console});
 vm.runInContext(worker,ctx);vm.runInContext('storeInbox=async()=>{}',ctx);
 let pending;listeners.push({data:{json:()=>({type,account_id:id,title:'Synthetic',body:'Test only',tag:'qa'})},waitUntil:p=>pending=p});await pending;return shown;
}
const app=(overrides={})=>({url:'https://example.test/dear-diary/#/chat',visibilityState:'visible',focused:true,postMessage:(data,ports)=>{if(ports)ports[0].postMessage({account_id:account,foreground:true});},...overrides});
assert.equal((await push([app()])).length,0);
assert.equal((await push([])).length,1);
assert.equal((await push([app({visibilityState:'hidden'})])).length,1);
assert.equal((await push([app({focused:false})])).length,1);
assert.equal((await push([app({url:'https://example.test/other/'})])).length,1);
assert.equal((await push([app()],'chat','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')).length,1);
assert.equal((await push([app({postMessage:()=>{}})])).length,1);
assert.equal((await push([app({postMessage:(data,ports)=>ports[0]?.postMessage({account_id:account,foreground:false})})])).length,1);
assert.equal((await push([app({postMessage:()=>{throw Error('closed');}})])).length,1);
assert.equal((await push([app({focused:false}),app()])).length,0);
assert.equal((await push([app()],'friend_free')).length,1);
assert.equal((await push([app()],'scheduled_sent')).length,1);
assert.equal((await push([app()],'chat',null)).length,1);
console.log('PASS foreground suppress; closed, hidden, unfocused, unrelated path/account, timeout, changed visibility, closed-window race notify; multiple windows; non-chat retained');
