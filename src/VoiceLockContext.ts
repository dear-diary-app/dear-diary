import{createContext}from'react';
export type VoiceLockState={enabled:boolean;status:string;listening:boolean;supported:boolean;setEnabled:(on:boolean)=>void;resume:()=>void};
export const VoiceLockContext=createContext<VoiceLockState|null>(null);
