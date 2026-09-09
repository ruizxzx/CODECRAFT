export type ShareTarget =
  | { type:'article'; slug:string; section?:string }
  | { type:'series'; slug:string; part?:number|string }
  | { type:'profile'; username:string }
  | { type:'post'; slug:string }
  | { type:'topic'; name:string };

export function canonicalPath(target:ShareTarget):string {
  switch(target.type){
    case 'article': return `/article/${encodeURIComponent(target.slug)}${target.section ? `#${encodeURIComponent(target.section)}` : ''}`;
    case 'series': return target.part ? `/series/${encodeURIComponent(target.slug)}/part-${String(target.part).padStart(2,'0')}` : `/series/${encodeURIComponent(target.slug)}`;
    case 'profile': return `/@${encodeURIComponent(target.username.replace(/^@/,''))}`;
    case 'post': return `/post/${encodeURIComponent(target.slug)}`;
    case 'topic': return `/topic/${encodeURIComponent(target.name.replace(/^#/,'').toLowerCase())}`;
  }
}
export function canonicalUrl(target:ShareTarget, origin=typeof window!=='undefined'?window.location.origin:''):string { return `${origin}${canonicalPath(target)}`; }
export async function copyCanonicalLink(target:ShareTarget){ const url=canonicalUrl(target); await navigator.clipboard.writeText(url); return url; }
export function nativeShare(target:ShareTarget,title?:string,text?:string){ const url=canonicalUrl(target); if(typeof navigator!=='undefined' && navigator.share) return navigator.share({title,url,text}); return Promise.reject(new Error('Native sharing is unavailable on this device.')); }
export const shareTargets=(target:ShareTarget,title:string)=>({
 whatsapp:`https://wa.me/?text=${encodeURIComponent(`${title} ${canonicalUrl(target)}`)}`,
 telegram:`https://t.me/share/url?url=${encodeURIComponent(canonicalUrl(target))}&text=${encodeURIComponent(title)}`,
 x:`https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(canonicalUrl(target))}`,
 linkedin:`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonicalUrl(target))}`,
 email:`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(canonicalUrl(target))}`,
});
