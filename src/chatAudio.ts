import{chatSendError}from'./chatSendError';
import {supabase} from './lib/supabase';
export interface Voice {path:string;duration:number;mime:string;peaks:number[]}
export const AUDIO_BUCKET='chat-audio',MAX_VOICE=120,MAX_AUDIO=5*1024*1024;
export function cleanVoice(v:unknown):Voice|null {const a=v as Voice;if(!a||typeof a.path!=='string'||! /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webm|m4a|ogg)$/.test(a.path)||!Number.isFinite(a.duration)||a.duration<.5||a.duration>120||!['audio/webm','audio/mp4','audio/ogg'].includes(a.mime)||!Array.isArray(a.peaks)||a.peaks.length!==32||a.peaks.some(x=>!Number.isFinite(x)||x<0||x>1))return null;return a;}
export const voiceExt=(mime:string)=>mime.includes('mp4')?'m4a':mime.includes('ogg')?'ogg':'webm';
export async function uploadVoice(v:Voice,blob:Blob){const r=await supabase.storage.from(AUDIO_BUCKET).upload(v.path,blob,{contentType:v.mime,upsert:false});if(r.error&&!/exist|duplicate/i.test(r.error.message))throw Error(chatSendError('voice',r.error));return true;}
