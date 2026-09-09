import {auth,db} from './firebase';
import {collection,doc,getDocs,onSnapshot,query,serverTimestamp,setDoc,where} from 'firebase/firestore';
export async function heartbeatPresence(scopeId:string){const u=auth.currentUser;if(!u||!scopeId)return;const now=Date.now();await setDoc(doc(db,'presence',scopeId,'members',u.uid),{uid:u.uid,lastSeenAt:serverTimestamp(),expiresAt:new Date(now+90000),updatedAt:serverTimestamp()},{merge:true});}
export function subscribePresence(scopeId:string,cb:(count:number)=>void){if(!scopeId)return()=>{};const q=query(collection(db,'presence',scopeId,'members'),where('expiresAt','>',new Date()));return onSnapshot(q,s=>cb(s.size),()=>cb(0));}
export function startPresence(scopeId:string){let stopped=false;const tick=()=>{if(!stopped)heartbeatPresence(scopeId).catch(e=>console.error('Presence heartbeat failed:',e))};tick();const id=window.setInterval(tick,30000);return()=>{stopped=true;window.clearInterval(id)}}
