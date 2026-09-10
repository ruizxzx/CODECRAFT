import React from 'react';
import {RichText} from './RichText';

type Props={text?:string;onMentionClick?:(username:string)=>void};
export const QuestionContent:React.FC<Props>=({text='',onMentionClick})=>{
 const lines=String(text||'').split(/\n/); const nodes:React.ReactNode[]=[]; let i=0;
 while(i<lines.length){ if(lines[i].trim().startsWith('```')){const lang=lines[i].trim().slice(3);const code:string[]=[];i++;while(i<lines.length&&!lines[i].trim().startsWith('```')){code.push(lines[i]);i++;}i++;nodes.push(<pre key={`c-${i}`} className="overflow-x-auto border-2 border-black bg-black text-white p-3 font-mono text-xs"><code data-language={lang}>{code.join('\n')}</code></pre>);continue;} if(/^\s*\[\d+\]\s+/.test(lines[i])){nodes.push(<div key={`s-${i}`} className="border-l-4 border-black bg-neutral-100 p-3 font-mono text-xs"><RichText text={lines[i]} onMentionClick={onMentionClick}/></div>);i++;continue;} const line=lines[i]; if(!line.trim()){nodes.push(<div key={`b-${i}`} className="h-2"/>);i++;continue;} nodes.push(<p key={`p-${i}`} className="leading-relaxed"><RichText text={line} onMentionClick={onMentionClick}/></p>);i++; }
 return <div className="space-y-2">{nodes}</div>;
};
