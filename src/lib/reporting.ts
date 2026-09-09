import {auth,db} from './firebase';
import {collection,doc,getDocs,limit,orderBy,query,serverTimestamp,setDoc,updateDoc} from 'firebase/firestore';
export type ReportReason='Spam'|'Harassment'|'Copyright'|'Misinformation'|'Other';
export type ReportTarget='article'|'post'|'comment'|'creator';
export async function createReport(targetType:ReportTarget,targetId:string,reason:ReportReason,details=''){const u=auth.currentUser;if(!u)throw new Error('Sign in required to report content.');const id=`report-${crypto.randomUUID()}`;await setDoc(doc(db,'reports',id),{reporterId:u.uid,reporterEmail:u.email||'',targetType,targetId,reason,details:details.slice(0,1000),status:'open',moderatorAction:'',resolution:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});return id;}
export async function listReports(){const s=await getDocs(query(collection(db,'reports'),orderBy('createdAt','desc'),limit(300)));return s.docs.map(d=>({id:d.id,...d.data()}));}
export async function updateReport(id:string,status:'open'|'resolved'|'dismissed',moderatorAction:string,resolution:string){const u=auth.currentUser;if(!u)throw new Error('Authentication required.');await updateDoc(doc(db,'reports',id),{status,moderatorAction:moderatorAction.slice(0,500),resolution:resolution.slice(0,1000),resolvedBy:u.uid,updatedAt:serverTimestamp()});}
