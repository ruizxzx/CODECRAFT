import React from 'react';
import { Play } from 'lucide-react';

type FeedMediaSource = {
  title?: string;
  coverImage?: string;
  coverImageAlt?: string;
  mediaUrls?: string[];
  attachments?: string[];
};

interface Props {
  item: FeedMediaSource;
  showAll?: boolean;
  className?: string;
  compact?: boolean;
}

const isVideo=(url:string)=>/\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(url);
const isDocument=(url:string)=>/\.(pdf|docx?|pptx?|xlsx?)(?:$|\?)/i.test(url);
const isImage=(url:string)=>/\.(jpe?g|png|webp|gif|avif|bmp|svg)(?:$|\?)/i.test(url)||(!isDocument(url)&&!isVideo(url));
const identity=(url:string)=>{try{const u=new URL(url,window.location.origin);return `${u.origin}${u.pathname}`.replace(/\/+$/,'').toLowerCase();}catch{return String(url).split(/[?#]/)[0].replace(/\/+$/,'').toLowerCase();}};

export const FeedMediaPreview:React.FC<Props>=({item,showAll=false,className='',compact=false})=>{
 const seen=new Set<string>();
 const media=[...(item.coverImage?[item.coverImage]:[]),...(item.mediaUrls||[]),...(item.attachments||[])].map(String).map(v=>v.trim()).filter(Boolean).filter(url=>{
   if(!(isImage(url)||isVideo(url))) return false;
   const key=identity(url); if(seen.has(key)) return false; seen.add(key); return true;
 });
 if(!media.length)return null;
 const items=showAll?media.slice(0,4):media.slice(0,1);
 const frame=compact?'h-28 sm:h-32':'h-32 sm:h-40';
 return <div className={`${showAll&&items.length>1?'grid grid-cols-2 gap-2':''} ${className}`}>
   {items.map((url,i)=>isVideo(url)?<div key={`${identity(url)}-${i}`} className={`relative ${frame} overflow-hidden border-2 border-black bg-black`}>
     <video src={url} controls preload="metadata" className="w-full h-full object-cover" aria-label={`${item.title||'Post'} video ${i+1}`}/><span className="absolute top-1 left-1 pointer-events-none border-2 border-black bg-white px-1.5 py-0.5 font-mono text-[8px] font-black"><Play className="inline w-2.5 h-2.5 mr-0.5"/>VIDEO</span>
   </div>:<div key={`${identity(url)}-${i}`} className={`overflow-hidden ${frame} border-2 border-black bg-neutral-100`}>
     <img src={url} alt={item.coverImageAlt||item.title||`Post image ${i+1}`} loading="lazy" className="w-full h-full object-cover" onError={e=>{e.currentTarget.parentElement?.remove();}}/>
   </div>)}
 </div>;
};
