import React from 'react';
import { BadgeCheck, MousePointer2, MonitorPlay, Type } from 'lucide-react';
import { CarouselElement, CarouselElementType } from '../types';

interface Props {
  imageUrl: string;
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
  text: type === 'button' ? 'VIEW FEATURE' : type === 'badge' ? 'NEW' : 'Your announcement here',
  x: 8,
  y: type === 'badge' ? 10 : type === 'button' ? 78 : 58,
  color: '#000000',
  backgroundColor: type === 'button' ? '#FF00A8' : type === 'badge' ? '#FFFFFF' : '#FFFFFF',
  fontSize: type === 'text' ? 26 : 12,
  href: type === 'button' ? '' : undefined,
});

export const CarouselBuilder: React.FC<Props> = ({
  imageUrl, positionX, positionY, zoom, elements,
  setPositionX, setPositionY, setZoom, setElements,
}) => {
  const addElement = (type: CarouselElementType) => setElements(prev => [...prev, createElement(type)]);
  const updateElement = (id: string, patch: Partial<CarouselElement>) => setElements(prev => prev.map(el => el.id === id ? { ...el, ...patch } : el));
  const removeElement = (id: string) => setElements(prev => prev.filter(el => el.id !== id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
        <div className="flex items-center gap-2"><MonitorPlay className="w-4 h-4"/><h4 className="font-display font-black uppercase">Visual Carousel Builder</h4></div>
        <span className="font-mono text-[10px] uppercase text-neutral-500">Crop image + place text, badges and buttons</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_.65fr] gap-4">
        <div>
          <div
            className="relative aspect-[21/9] bg-black border-4 border-black overflow-hidden cursor-crosshair"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setPositionX(Math.round(((event.clientX - rect.left) / rect.width) * 100));
              setPositionY(Math.round(((event.clientY - rect.top) / rect.height) * 100));
            }}
            title="Click to set image focal point"
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Carousel preview"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: `${positionX}% ${positionY}%`, transform: `scale(${zoom / 100})` }}
              />
            ) : <div className="absolute inset-0 grid place-items-center text-white font-mono text-xs">ADD AN IMAGE URL</div>}
            <div className="absolute inset-0 bg-black/10 pointer-events-none" />
            {elements.map(el => (
              <div key={el.id} className="absolute max-w-[78%]" style={{ left: `${el.x}%`, top: `${el.y}%`, color: el.color, fontSize: `${el.fontSize || 12}px` }}>
                {el.type === 'button' ? (
                  <span className="inline-block border-2 border-black px-3 py-1.5 font-mono font-black uppercase shadow-[3px_3px_0_0_#000]" style={{ backgroundColor: el.backgroundColor || '#FF00A8' }}>{el.text}</span>
                ) : el.type === 'badge' ? (
                  <span className="inline-block border-2 border-black px-2 py-1 font-mono font-black uppercase" style={{ backgroundColor: el.backgroundColor || '#FFFFFF' }}>{el.text}</span>
                ) : (
                  <span className="font-display font-black uppercase leading-none drop-shadow-[2px_2px_0_#000]">{el.text}</span>
                )}
              </div>
            ))}
          </div>
          <p className="font-mono text-[10px] mt-2 text-neutral-500 uppercase">Click the preview to set the focal point, or use the sliders. The crop is stored as focal X/Y + zoom, so the same source image can be positioned without re-uploading it.</p>
        </div>

        <div className="border-2 border-black bg-neutral-50 p-4 space-y-4">
          <div>
            <label className="font-mono text-[10px] font-black uppercase block mb-1">Horizontal crop: {positionX}%</label>
            <input type="range" min="0" max="100" value={positionX} onChange={e => setPositionX(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label className="font-mono text-[10px] font-black uppercase block mb-1">Vertical crop: {positionY}%</label>
            <input type="range" min="0" max="100" value={positionY} onChange={e => setPositionY(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label className="font-mono text-[10px] font-black uppercase block mb-1">Image zoom: {zoom}%</label>
            <input type="range" min="100" max="180" value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-full" />
          </div>

          <div className="pt-2 border-t-2 border-black">
            <div className="font-mono text-[10px] font-black uppercase mb-2">Add overlay element</div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => addElement('badge')} className="border-2 border-black bg-white px-2 py-2 font-mono text-[10px] font-black uppercase"><BadgeCheck className="inline w-3 h-3 mr-1"/>BADGE</button>
              <button onClick={() => addElement('text')} className="border-2 border-black bg-white px-2 py-2 font-mono text-[10px] font-black uppercase"><Type className="inline w-3 h-3 mr-1"/>TEXT</button>
              <button onClick={() => addElement('button')} className="border-2 border-black bg-[var(--color-primary)] px-2 py-2 font-mono text-[10px] font-black uppercase"><MousePointer2 className="inline w-3 h-3 mr-1"/>BUTTON</button>
            </div>
          </div>

          {elements.map((el, index) => (
            <div key={el.id} className="border-2 border-black bg-white p-3 space-y-2">
              <div className="flex justify-between items-center gap-2"><span className="font-mono text-[10px] font-black uppercase">{index + 1}. {el.type}</span><button onClick={() => removeElement(el.id)} className="text-red-600 font-mono text-[10px] font-black">REMOVE</button></div>
              <input value={el.text} onChange={e => updateElement(el.id, { text: e.target.value })} className="w-full border-2 border-neutral-300 px-2 py-1.5 text-xs" placeholder="Element text" />
              <div className="grid grid-cols-2 gap-2">
                <label className="font-mono text-[9px] font-bold">X %<input type="number" min="0" max="90" value={el.x} onChange={e => updateElement(el.id, { x: Number(e.target.value) })} className="w-full border-2 border-neutral-300 px-2 py-1 text-xs" /></label>
                <label className="font-mono text-[9px] font-bold">Y %<input type="number" min="0" max="90" value={el.y} onChange={e => updateElement(el.id, { y: Number(e.target.value) })} className="w-full border-2 border-neutral-300 px-2 py-1 text-xs" /></label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="font-mono text-[9px] font-bold">TEXT COLOR<input type="color" value={el.color} onChange={e => updateElement(el.id, { color: e.target.value })} className="w-full h-8 border-2 border-neutral-300" /></label>
                <label className="font-mono text-[9px] font-bold">BG COLOR<input type="color" value={el.backgroundColor || '#FFFFFF'} onChange={e => updateElement(el.id, { backgroundColor: e.target.value })} className="w-full h-8 border-2 border-neutral-300" /></label>
              </div>
              <label className="font-mono text-[9px] font-bold">FONT SIZE<input type="number" min="8" max="72" value={el.fontSize || 12} onChange={e => updateElement(el.id, { fontSize: Number(e.target.value) })} className="w-full border-2 border-neutral-300 px-2 py-1 text-xs" /></label>
              {el.type === 'button' && <input value={el.href || ''} onChange={e => updateElement(el.id, { href: e.target.value })} className="w-full border-2 border-neutral-300 px-2 py-1.5 text-xs" placeholder="Button link (optional)" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
