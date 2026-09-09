import React,{useEffect,useState} from 'react';
import {Activity} from 'lucide-react';
import {auth} from '../lib/firebase';
import {startPresence,subscribePresence} from '../lib/presence';
export const PresenceBadge:React.FC<{scopeId:string;label?:string}>=({scopeId,label='ACTIVE NOW'})=>{const[count,setCount]=useState(0);useEffect(()=>{if(!auth.currentUser)return;const stop=startPresence(scopeId);const unsub=subscribePresence(scopeId,setCount);return()=>{stop();unsub()}},[scopeId,auth.currentUser?.uid]);return <div className="inline-flex items-center gap-2 border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase"><Activity className="w-3 h-3"/>{count} {label}</div>};
