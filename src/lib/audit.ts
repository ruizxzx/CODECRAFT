import { auth, checkIsAdmin } from './firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { resolveMasterAccess } from './masterControl';

export async function writeAdminAudit(action:string,target:string,before?:unknown,after?:unknown){
  const actor=auth.currentUser;
  if(!actor || !(checkIsAdmin(actor.email) || await resolveMasterAccess(actor))) return;
  await addDoc(collection(db,'adminAuditLog'),{
    actorId:actor.uid, actorEmail:actor.email||'', actorName:actor.displayName||'',
    action:String(action).slice(0,120), target:String(target).slice(0,240),
    before:before ?? null, after:after ?? null, createdAt:serverTimestamp()
  });
}
