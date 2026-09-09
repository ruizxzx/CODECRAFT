import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Expand, Minus, Plus, RefreshCw, RotateCcw, RotateCw, X } from 'lucide-react';

export type CropAspectPreset = 'free' | '1:1' | '4:3' | '16:9' | '3:4' | '4:5' | '2:1';
export type CropShape = 'rect' | 'circle';

export interface ImageCropResult {
  file: File;
  width: number;
  height: number;
  type: string;
  size: number;
  previewUrl: string;
}

interface ImageCropperModalProps {
  file: File;
  aspect?: CropAspectPreset;
  cropShape?: CropShape;
  outputWidth?: number;
  outputHeight?: number;
  title?: string;
  onCancel: () => void;
  onConfirm: (result: ImageCropResult) => void | Promise<void>;
}

const OUTPUT_MAX = 1800;
const OUTPUT_AREA_MAX = 1800 * 1800;

const presetToRatio = (preset: CropAspectPreset, sourceRatio: number) => {
  switch (preset) {
    case '1:1': return 1;
    case '4:3': return 4 / 3;
    case '16:9': return 16 / 9;
    case '3:4': return 3 / 4;
    case '4:5': return 4 / 5;
    case '2:1': return 2;
    case 'free':
    default: return Number.isFinite(sourceRatio) && sourceRatio > 0 ? sourceRatio : 1;
  }
};

const formatBytes = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Could not read this image.'));
  image.decoding = 'async';
  image.src = src;
});

const blobToFile = (blob: Blob, name: string) => new File([blob], name, { type: blob.type, lastModified: Date.now() });

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  file,
  aspect = 'free',
  cropShape = 'rect',
  outputWidth,
  outputHeight,
  title = 'IMAGE EDITOR',
  onCancel,
  onConfirm,
}) => {
  const previewUrlRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ active: boolean; x: number; y: number; offsetX: number; offsetY: number }>({ active: false, x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selectedAspect, setSelectedAspect] = useState<CropAspectPreset>(aspect);
  const [processing, setProcessing] = useState(false);
  const [resultPreview, setResultPreview] = useState<ImageCropResult | null>(null);

  const [sourceWidth, setSourceWidth] = useState(0);
  const [sourceHeight, setSourceHeight] = useState(0);

  const sourceRatio = sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : 1;
  const ratio = useMemo(() => presetToRatio(selectedAspect, sourceRatio), [selectedAspect, sourceRatio]);

  const viewport = useMemo(() => {
    const maxWidth = 820;
    const maxHeight = 620;
    const width = Math.max(260, Math.min(maxWidth, maxHeight * ratio));
    const height = width / ratio;
    return { width, height };
  }, [ratio]);

  const displayScale = useMemo(() => {
    if (!sourceWidth || !sourceHeight) return 1;
    const rotated = rotation % 180 !== 0 ? { width: sourceHeight, height: sourceWidth } : { width: sourceWidth, height: sourceHeight };
    const fit = Math.max(viewport.width / rotated.width, viewport.height / rotated.height);
    return fit * zoom;
  }, [sourceWidth, sourceHeight, rotation, viewport.width, viewport.height, zoom]);

  const clampOffset = useCallback((next: { x: number; y: number }) => {
    if (!sourceWidth || !sourceHeight) return next;
    const rotated = rotation % 180 !== 0 ? { width: sourceHeight, height: sourceWidth } : { width: sourceWidth, height: sourceHeight };
    const drawW = rotated.width * displayScale;
    const drawH = rotated.height * displayScale;
    const maxX = Math.max(0, (drawW - viewport.width) / 2);
    const maxY = Math.max(0, (drawH - viewport.height) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  }, [displayScale, rotation, sourceHeight, sourceWidth, viewport.height, viewport.width]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !sourceWidth || !sourceHeight) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(viewport.width * pixelRatio);
    canvas.height = Math.round(viewport.height * pixelRatio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    ctx.save();
    ctx.translate(viewport.width / 2 + offset.x, viewport.height / 2 + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(displayScale, displayScale);
    ctx.drawImage(image, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
    ctx.restore();

    // Crop framing polish
    ctx.save();
    if (cropShape === 'circle') {
      const diameter = Math.min(viewport.width, viewport.height);
      ctx.beginPath();
      ctx.arc(viewport.width / 2, viewport.height / 2, diameter / 2 - 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.rect(0, 0, viewport.width, viewport.height);
      ctx.arc(viewport.width / 2, viewport.height / 2, diameter / 2, 0, Math.PI * 2, true);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(viewport.width / 2, viewport.height / 2, diameter / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, viewport.width - 4, viewport.height - 4);
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(10, 10, viewport.width - 20, viewport.height - 20);
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.moveTo(viewport.width / 3, 0); ctx.lineTo(viewport.width / 3, viewport.height);
      ctx.moveTo((viewport.width / 3) * 2, 0); ctx.lineTo((viewport.width / 3) * 2, viewport.height);
      ctx.moveTo(0, viewport.height / 3); ctx.lineTo(viewport.width, viewport.height / 3);
      ctx.moveTo(0, (viewport.height / 3) * 2); ctx.lineTo(viewport.width, (viewport.height / 3) * 2);
      ctx.stroke();
    }
    ctx.restore();
  }, [cropShape, displayScale, offset.x, offset.y, rotation, sourceHeight, sourceWidth, viewport.height, viewport.width]);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    let cancelled = false;
    (async () => {
      try {
        const image = await loadImage(objectUrl);
        if (cancelled) return;
        imageRef.current = image;
        setSourceWidth(image.naturalWidth || image.width);
        setSourceHeight(image.naturalHeight || image.height);
        setReady(true);
        setOffset({ x: 0, y: 0 });
        setZoom(1);
      } catch (e: any) {
        setError(e?.message || 'Unable to open this image.');
      }
    })();
    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [file]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !processing) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel, processing]);

  useEffect(() => {
    if (ready) draw();
  }, [draw, ready]);

  useEffect(() => {
    setOffset((current) => clampOffset(current));
  }, [clampOffset]);

  const reset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setResultPreview(null);
  };

  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { active: true, x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
  };

  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    const next = clampOffset({ x: dragRef.current.offsetX + event.clientX - dragRef.current.x, y: dragRef.current.offsetY + event.clientY - dragRef.current.y });
    setOffset(next);
  };

  const pointerUp = () => {
    dragRef.current.active = false;
  };

  const outputSize = useMemo(() => {
    const requestedW = Math.max(1, Math.round(outputWidth || (ratio >= 1 ? OUTPUT_MAX : Math.round(OUTPUT_MAX * ratio))));
    const requestedH = Math.max(1, Math.round(outputHeight || (ratio >= 1 ? Math.round(OUTPUT_MAX / ratio) : OUTPUT_MAX)));
    let width = requestedW;
    let height = requestedH;
    const area = width * height;
    if (area > OUTPUT_AREA_MAX) {
      const factor = Math.sqrt(OUTPUT_AREA_MAX / area);
      width = Math.max(1, Math.round(width * factor));
      height = Math.max(1, Math.round(height * factor));
    }
    return { width, height };
  }, [outputHeight, outputWidth, ratio]);

  const buildResult = async () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !ready) return;
    setProcessing(true);
    setError('');
    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = outputSize.width;
      exportCanvas.height = outputSize.height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Image processing is unavailable in this browser.');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (cropShape === 'circle') {
        ctx.beginPath();
        ctx.arc(outputSize.width / 2, outputSize.height / 2, Math.min(outputSize.width, outputSize.height) / 2, 0, Math.PI * 2);
        ctx.clip();
      }
      ctx.save();
      const previewScale = outputSize.width / viewport.width;
      ctx.translate(outputSize.width / 2 + offset.x * previewScale, outputSize.height / 2 + offset.y * previewScale);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(displayScale * previewScale, displayScale * previewScale);
      ctx.drawImage(image, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
      ctx.restore();

      const outputType = file.type === 'image/png' ? 'image/png' : 'image/webp';
      const quality = outputType === 'image/webp' ? 0.9 : undefined;
      const blob = await new Promise<Blob | null>((resolve) => exportCanvas.toBlob(resolve, outputType, quality));
      if (!blob) throw new Error('Could not process this image.');
      const extension = outputType === 'image/png' ? 'png' : 'webp';
      const safeStem = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').slice(0, 70) || 'image';
      const processed = blobToFile(blob, `${safeStem}-cropped.${extension}`);
      const previewUrl = URL.createObjectURL(blob);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = previewUrl;
      const result: ImageCropResult = { file: processed, width: outputSize.width, height: outputSize.height, type: outputType, size: processed.size, previewUrl };
      setResultPreview(result);
    } catch (e: any) {
      setError(e?.message || 'Image processing failed.');
    } finally {
      setProcessing(false);
    }
  };

  const confirm = async () => {
    if (!resultPreview) {
      await buildResult();
      return;
    }
    await onConfirm(resultPreview);
  };

  const aspectOptions: CropAspectPreset[] = ['free', '1:1', '4:3', '16:9', '3:4', '4:5', '2:1'];

  return (
    <div className="fixed inset-0 z-[1000] bg-black/80 p-3 sm:p-6 grid place-items-center" role="dialog" aria-modal="true" aria-labelledby="image-editor-title">
      <div className="bg-white border-4 border-black w-full max-w-5xl max-h-[95vh] overflow-y-auto neo-shadow p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b-2 border-black pb-3 mb-4">
          <div>
            <div className="font-mono text-[9px] font-black uppercase text-fuchsia-600">PREVIEW BEFORE UPLOAD</div>
            <h2 id="image-editor-title" className="font-display font-black text-xl uppercase">{title}</h2>
          </div>
          <button type="button" onClick={onCancel} className="border-2 border-black p-2 bg-white" aria-label="Cancel image editing"><X className="w-4 h-4" /></button>
        </div>

        {error && <div className="border-2 border-red-600 bg-red-50 text-red-700 p-3 mb-3 font-mono text-[10px] font-black uppercase">{error}</div>}

        {!ready ? (
          <div className="border-2 border-black bg-neutral-100 min-h-72 grid place-items-center font-mono text-xs font-black uppercase">Loading image…</div>
        ) : (
          <>
            <div className="grid lg:grid-cols-[1fr_270px] gap-4">
              <div className="min-w-0">
                <div className="w-full overflow-auto bg-black border-2 border-black p-2">
                  <canvas
                    ref={canvasRef}
                    onPointerDown={pointerDown}
                    onPointerMove={pointerMove}
                    onPointerUp={pointerUp}
                    onPointerCancel={pointerUp}
                    onPointerLeave={pointerUp}
                    className="mx-auto block max-w-full touch-none cursor-grab active:cursor-grabbing"
                    aria-label="Image crop canvas"
                  />
                </div>
                <div className="font-mono text-[9px] uppercase mt-2 text-neutral-600">Drag the image to reposition. Crop frame stays fixed.</div>
              </div>

              <div className="space-y-3">
                <div className="border-2 border-black p-3 space-y-2">
                  <div className="font-mono text-[9px] font-black uppercase">RATIO</div>
                  <div className="flex flex-wrap gap-1">
                    {aspectOptions.map((option) => (
                      <button key={option} type="button" onClick={() => { setSelectedAspect(option); setOffset({ x: 0, y: 0 }); setResultPreview(null); }} className={`border-2 border-black px-2 py-1 font-mono text-[9px] font-black uppercase ${selectedAspect === option ? 'bg-[var(--color-primary)]' : 'bg-white'}`}>
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-2 border-black p-3 space-y-2">
                  <div className="font-mono text-[9px] font-black uppercase">ZOOM</div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => { setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2))); setResultPreview(null); }} className="border-2 border-black p-2 bg-white" aria-label="Zoom out"><Minus className="w-3 h-3" /></button>
                    <input aria-label="Zoom" type="range" min="1" max="3" step="0.05" value={zoom} onChange={(e) => { setZoom(Number(e.target.value)); setResultPreview(null); }} className="flex-1" />
                    <button type="button" onClick={() => { setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2))); setResultPreview(null); }} className="border-2 border-black p-2 bg-white" aria-label="Zoom in"><Plus className="w-3 h-3" /></button>
                  </div>
                  <div className="font-mono text-[9px] text-neutral-600">{Math.round(zoom * 100)}%</div>
                </div>

                <div className="border-2 border-black p-3 space-y-2">
                  <div className="font-mono text-[9px] font-black uppercase">TRANSFORM</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); setResultPreview(null); }} className="border-2 border-black p-2 bg-white font-mono text-[9px] font-black uppercase inline-flex justify-center gap-1"><Expand className="w-3 h-3" /> FIT</button>
                    <button type="button" onClick={() => { setRotation(0); setOffset({ x: 0, y: 0 }); setZoom(1); setResultPreview(null); }} className="border-2 border-black p-2 bg-white font-mono text-[9px] font-black uppercase">RESET</button>
                    <button type="button" onClick={() => { setOffset({ x: 0, y: 0 }); setResultPreview(null); }} className="border-2 border-black p-2 bg-white font-mono text-[9px] font-black uppercase">CENTER</button>
                  </div>
                </div>

                <div className="border-2 border-black p-3 space-y-2">
                  <div className="font-mono text-[9px] font-black uppercase">ROTATE</div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setRotation((r) => (r - 90 + 360) % 360); setOffset({ x: 0, y: 0 }); setResultPreview(null); }} className="flex-1 border-2 border-black p-2 bg-white font-mono text-[9px] font-black inline-flex justify-center gap-1"><RotateCcw className="w-3 h-3" /> LEFT</button>
                    <button type="button" onClick={() => { setRotation((r) => (r + 90) % 360); setOffset({ x: 0, y: 0 }); setResultPreview(null); }} className="flex-1 border-2 border-black p-2 bg-white font-mono text-[9px] font-black inline-flex justify-center gap-1"><RotateCw className="w-3 h-3" /> RIGHT</button>
                  </div>
                </div>

                <div className="border-2 border-black p-3 space-y-2">
                  <div className="font-mono text-[9px] font-black uppercase">ORIGINAL</div>
                  <div className="font-mono text-[9px]">{sourceWidth} × {sourceHeight} · {formatBytes(file.size)}</div>
                  <div className="font-mono text-[9px]">{file.type.toUpperCase()}</div>
                </div>

                {resultPreview && (
                  <div className="border-2 border-black p-3 space-y-2 bg-neutral-50">
                    <div className="font-mono text-[9px] font-black uppercase">FINAL PREVIEW</div>
                    <img src={resultPreview.previewUrl} alt="Final cropped preview" className="w-full aspect-square object-contain bg-white border-2 border-black" />
                    <div className="font-mono text-[9px]">{resultPreview.width} × {resultPreview.height}</div>
                    <div className="font-mono text-[9px]">{resultPreview.type.replace('image/', '').toUpperCase()} · {formatBytes(resultPreview.size)}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t-2 border-black pt-4">
              <button type="button" onClick={reset} className="border-2 border-black px-3 py-2 bg-white font-mono text-[9px] font-black uppercase inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> RESET</button>
              <div className="flex flex-wrap gap-2 ml-auto">
                <button type="button" onClick={onCancel} className="border-2 border-black px-4 py-2 bg-white font-mono text-[9px] font-black uppercase">CANCEL</button>
                {!resultPreview ? (
                  <button type="button" onClick={() => void buildResult()} disabled={processing} className="border-2 border-black px-4 py-2 bg-black text-white font-mono text-[9px] font-black uppercase disabled:opacity-50 inline-flex items-center gap-1"><Expand className="w-3 h-3" /> {processing ? 'PROCESSING…' : 'PREVIEW CROP'}</button>
                ) : (
                  <button type="button" onClick={() => void confirm()} disabled={processing} className="border-2 border-black px-4 py-2 bg-[var(--color-primary)] font-mono text-[9px] font-black uppercase disabled:opacity-50 inline-flex items-center gap-1"><Check className="w-3 h-3" /> USE IMAGE</button>
                )}
              </div>
            </div>
            <div className="mt-2 font-mono text-[9px] text-neutral-500 uppercase">Nothing is uploaded until you click USE IMAGE.</div>
          </>
        )}
      </div>
    </div>
  );
};
