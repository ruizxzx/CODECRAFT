import React, { useState } from 'react';
import { BadgeCheck, Link2, MousePointer2, MonitorPlay, Type } from 'lucide-react';
import { CarouselElement, CarouselElementType } from '../types';

interface Props {
  mode: 'image' | 'scratch';
  imageUrl: string;
  backgroundColor: string;
  positionX: number;
  positionY: number;
  zoom: number;
  elements: CarouselElement[];
  setPositionX: React.Dispatch<React.SetStateAction<number>>;
  setPositionY: React.Dispatch<React.SetStateAction<number>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setElements: React.Dispatch<React.SetStateAction<CarouselElement[]>>;
}

const createElement = (type: CarouselElementType): CarouselElement => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  text: type === 'button' ? 'VIEW FEATURE' : type === 'badge' ? 'NEW' : type === 'link' ? 'READ MORE →' : 'Your announcement here',
  x: type === 'badge' ? 7 : type === 'button' ? 8 : 10,
  y: type === 'badge' ? 10 : type === 'button' ? 78 : 40,
  color: type === 'button' ? '#000000' : '#FFFFFF',
  backgroundColor: type === 'button' ? '#FF00A8' : type === 'badge' ? '#FFFFFF' : undefined,
  fontSize: type === 'text' ? 34 : type === 'link' ? 14 : 12,
  href: type === 'button' || type === 'link' ? '' : undefined,
});

const ResponsiveCarouselPreview: React.FC<{
  mode: 'image' | 'scratch';
  imageUrl: string;
  backgroundColor: string;
  positionX: number;
  positionY: number;
  zoom: number;
  elements: CarouselElement[];
  onSetPosition: (x: number, y: number) => void;
}> = ({ mode, imageUrl, backgroundColor, positionX, positionY, zoom, elements, onSetPosition }) => {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const frameClass = previewMode === 'mobile' ? 'aspect-[16/9]' : 'aspect-[21/9]';
  const sourceLabel = previewMode === 'mobile' ? 'MOBILE · 16:9' : 'DESKTOP · 21:9';
  const safeInset = previewMode === 'mobile' ? '8%' : '5%';
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'image') return;
    const rect = event.currentTarget.getBoundingClientRect();
    onSetPosition(Math.round(((event.clientX - rect.left) / rect.width) * 100), Math.round(((event.clientY - rect.top) / rect.height) * 100));
  };
  return (
    <div className="border-2 border-black bg-neutral-50 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] font-black uppercase">LIVE RESPONSIVE CROP PREVIEW</div>
          <div className="font-mono text-[9px] uppercase text-neutral-500">Click preview to reposition • {sourceLabel}</div>
        </div>
        <div className="flex border-2 border-black">
          <button type="button" onClick={() => setPreviewMode('desktop')} className={`px-2.5 py-1.5 font-mono text-[9px] font-black uppercase ${previewMode === 'desktop' ? 'bg-[var(--color-primary)]' : 'bg-white'}`}>DESKTOP</button>
          <button type="button" onClick={() => setPreviewMode('mobile')} className={`px-2.5 py-1.5 font-mono text-[9px] font-black uppercase border-l-2 border-black ${previewMode === 'mobile' ? 'bg-[var(--color-primary)]' : 'bg-white'}`}>MOBILE</button>
        </div>
      </div>
      <div className="grid md:grid-cols-[1fr_220px] gap-3 items-stretch">
        <div className={`${frameClass} relative border-4 border-black overflow-hidden bg-black cursor-crosshair`} onClick={handleClick}>
          <div className="absolute inset-0" style={{ backgroundColor }} />
          {mode === 'image' && imageUrl && <img src={imageUrl} alt="Carousel crop preview" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: `${positionX}% ${positionY}%`, transform: `scale(${zoom / 100})`, transformOrigin: 'center' }} />}
          {mode === 'image' && !imageUrl && <div className="absolute inset-0 grid place-items-center text-white font-mono text-xs uppercase px-4 text-center">ADD AN IMAGE URL</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10 pointer-events-none" />
          <div className="absolute pointer-events-none border border-dashed border-white/60" style={{ left: safeInset, right: safeInset, top: safeInset, bottom: safeInset }} />
          {elements.map(el => {
            const style: React.CSSProperties = { left: `${el.x}%`, top: `${el.y}%`, color: el.color, fontSize: `${el.fontSize || 12}px`, backgroundColor: el.type === 'text' || el.type === 'link' ? undefined : (el.backgroundColor || undefined) };
            if (el.type === 'button') return <button key={el.id} type="button" onClick={e => e.stopPropagation()} className="absolute inline-block border-2 border-black px-3 py-1.5 font-mono font-black uppercase shadow-[3px_3px_0_0_#000]" style={style}>{el.text}</button>;
            if (el.type === 'badge') return <span key={el.id} className="absolute inline-block border-2 border-black px-2 py-1 font-mono font-black uppercase" style={style}>{el.text}</span>;
            if (el.type === 'link') return <span key={el.id} className="absolute font-mono font-black uppercase underline decoration-2 underline-offset-4 drop-shadow-[2px_2px_0_#000]" style={style}>{el.text}</span>;
            return <span key={el.id} className="absolute max-w-[78%] font-display font-black uppercase leading-none drop-shadow-[3px_3px_0_#000]" style={style}>{el.text}</span>;
          })}
        </div>
        <div className="border-2 border-black bg-white p-3 font-mono text-[9px] uppercase space-y-2">
          <div className="font-black">CROP STATE</div>
          <div className="flex justify-between"><span>X POSITION</span><strong>{positionX}%</strong></div>
          <div className="flex justify-between"><span>Y POSITION</span><strong>{positionY}%</strong></div>
          <div className="flex justify-between"><span>ZOOM</span><strong>{zoom}%</strong></div>
          <div className="pt-2 border-t border-black text-neutral-500">Safe-area guide shows the region most likely to remain visible across responsive layouts.</div>
        </div>
      </div>
    </div>
  );
};

export const CarouselBuilder: React.FC<Props> = ({
  mode, imageUrl, backgroundColor, positionX, positionY, zoom, elements,
  setPositionX, setPositionY, setZoom, setElements,
}) => {
  const addElement = (type: CarouselElementType) => setElements(prev => [...prev, createElement(type)]);
  const updateElement = (id: string, patch: Partial<CarouselElement>) => setElements(prev => prev.map(el => el.id === id ? { ...el, ...patch } : el));
  const removeElement = (id: string) => setElements(prev => prev.filter(el => el.id !== id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
        <div className="flex items-center gap-2"><MonitorPlay className="w-4 h-4"/><h4 className="font-display font-black uppercase">Visual Carousel Builder</h4></div>
        <span className="font-mono text-[10px] uppercase text-neutral-500">{mode === 'image' ? 'Image crop + layers' : 'From-scratch canvas + layers'}</span>
      </div>

      <ResponsiveCarouselPreview
        mode={mode}
        imageUrl={imageUrl}
        backgroundColor={backgroundColor}
        positionX={positionX}
        positionY={positionY}
        zoom={zoom}
        elements={elements}
        onSetPosition={(x, y) => { setPositionX(x); setPositionY(y); }}
      />

      <div className="border-2 border-black bg-neutral-50 p-4 space-y-4">
        {mode === 'image' && <>
          <div><label className="font-mono text-[10px] font-black uppercase block mb-1">Horizontal crop: {positionX}%</label><input type="range" min="0" max="100" value={positionX} onChange={e => setPositionX(Number(e.target.value))} className="w-full" /></div>
          <div><label className="font-mono text-[10px] font-black uppercase block mb-1">Vertical crop: {positionY}%</label><input type="range" min="0" max="100" value={positionY} onChange={e => setPositionY(Number(e.target.value))} className="w-full" /></div>
          <div><label className="font-mono text-[10px] font-black uppercase block mb-1">Image zoom: {zoom}%</label><input type="range" min="100" max="180" value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-full" /></div>
        </>}

        <div className="pt-2 border-t-2 border-black">
          <div className="font-mono text-[10px] font-black uppercase mb-2">Add design element</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button type="button" onClick={() => addElement('badge')} className="border-2 border-black bg-white px-2 py-2 font-mono text-[10px] font-black uppercase"><BadgeCheck className="inline w-3 h-3 mr-1"/>BADGE</button>
            <button type="button" onClick={() => addElement('text')} className="border-2 border-black bg-white px-2 py-2 font-mono text-[10px] font-black uppercase"><Type className="inline w-3 h-3 mr-1"/>TEXT</button>
            <button type="button" onClick={() => addElement('link')} className="border-2 border-black bg-white px-2 py-2 font-mono text-[10px] font-black uppercase"><Link2 className="inline w-3 h-3 mr-1"/>LINKED TEXT</button>
            <button type="button" onClick={() => addElement('button')} className="border-2 border-black bg-[var(--color-primary)] px-2 py-2 font-mono text-[10px] font-black uppercase"><MousePointer2 className="inline w-3 h-3 mr-1"/>BUTTON</button>
          </div>
        </div>

        {elements.map((el, index) => (
          <div key={el.id} className="border-2 border-black bg-white p-3 space-y-2">
            <div className="flex justify-between items-center gap-2"><span className="font-mono text-[10px] font-black uppercase">{index + 1}. {el.type}</span><button type="button" onClick={() => removeElement(el.id)} className="text-red-600 font-mono text-[10px] font-black">REMOVE</button></div>
            <input value={el.text} onChange={e => updateElement(el.id, { text: e.target.value })} className="w-full border-2 border-neutral-300 px-2 py-1.5 text-xs" placeholder="Element text" />
            <div className="grid grid-cols-2 gap-2">
              <label className="font-mono text-[9px] font-bold">X %<input type="number" min="0" max="92" value={el.x} onChange={e => updateElement(el.id, { x: Math.max(0, Math.min(92, Number(e.target.value))) })} className="w-full border-2 border-neutral-300 px-2 py-1 text-xs" /></label>
              <label className="font-mono text-[9px] font-bold">Y %<input type="number" min="0" max="92" value={el.y} onChange={e => updateElement(el.id, { y: Math.max(0, Math.min(92, Number(e.target.value))) })} className="w-full border-2 border-neutral-300 px-2 py-1 text-xs" /></label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="font-mono text-[9px] font-bold">TEXT COLOR<input type="color" value={el.color || '#FFFFFF'} onChange={e => updateElement(el.id, { color: e.target.value })} className="w-full h-8 border-2 border-neutral-300" /></label>
              <label className="font-mono text-[9px] font-bold">BG COLOR<input type="color" value={el.backgroundColor || '#FFFFFF'} onChange={e => updateElement(el.id, { backgroundColor: e.target.value })} className="w-full h-8 border-2 border-neutral-300" /></label>
            </div>
            <label className="font-mono text-[9px] font-bold">FONT SIZE<input type="number" min="8" max="96" value={el.fontSize || 12} onChange={e => updateElement(el.id, { fontSize: Number(e.target.value) })} className="w-full border-2 border-neutral-300 px-2 py-1 text-xs" /></label>
            {(el.type === 'button' || el.type === 'link') && <input value={el.href || ''} onChange={e => updateElement(el.id, { href: e.target.value })} className="w-full border-2 border-neutral-300 px-2 py-1.5 text-xs" placeholder="https://example.com or /blog" />}
          </div>
        ))}
      </div>
    </div>
  );
};
