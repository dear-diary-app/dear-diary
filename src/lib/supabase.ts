import{friendModeOn}from'../friendPrivacy';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(url, key, {
  global:{fetch:async(input,init)=>{const url=String(input instanceof Request?input.url:input);if(friendModeOn()){const path=new URL(url).pathname;const allowed=path.startsWith('/auth/v1/')||path==='/rest/v1/app_settings'||path==='/rest/v1/profiles'&&new URL(url).searchParams.get('select')==='username';if(!allowed)throw Error('Private data is unavailable in Friend mode.');}return fetch(input,init);}},
  auth: { persistSession: true, autoRefreshToken: true },
});
