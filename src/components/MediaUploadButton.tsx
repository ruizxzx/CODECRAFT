import React, { useRef, useState } from 'react';
import { CheckCircle2, Loader2, UploadCloud } from 'lucide-react';
import { uploadMedia } from '../lib/media';
import { ImageCropperModal } from './ImageCropperModal';
import type { CropAspectPreset, CropShape, ImageCropResult } from './ImageCropperModal';

interface MediaUploadButtonProps {
  folder: 'profile' | 'articles' | 'posts' | 'videos' | 'attachments' | 'answers' | 'carousel' | 'users' | 'site';
  accept: string;
  label?: string;
  onUploaded: (url: string, meta: { objectKey: string; kind: 'image' | 'video' | 'file'; contentType: string; size: number; width?: number; height?: number; originalFileName?: string }) => void;
  disabled?: boolean;
  compact?: boolean;
  multiple?: boolean;
  targetUid?: string;
  cropAspect?: CropAspectPreset;
  cropShape?: CropShape;
  outputWidth?: number;
  outputHeight?: number;
}

const imageAccepts = (accept: string) => accept.split(',').some((item) => item.trim().toLowerCase().startsWith('image/'));
const videoOnlyAccept = (accept: string) => accept.split(',').filter(Boolean).every((item) => item.trim().toLowerCase().startsWith('video/'));
const fileOnlyAccept = (accept: string) => accept.split(',').filter(Boolean).every((item) => item.trim().toLowerCase() === 'application/pdf');

const inferCropConfig = (folder: MediaUploadButtonProps['folder'], label: string): { aspect: CropAspectPreset; shape: CropShape; outputWidth?: number; outputHeight?: number } => {
  const text = `${folder} ${label}`.toLowerCase();
  if (text.includes('avatar') || text.includes('profile picture')) return { aspect: '1:1', shape: 'circle' as CropShape, outputWidth: 800, outputHeight: 800 };
  if (text.includes('icon') || text.includes('logo')) return { aspect: '1:1', shape: 'rect', outputWidth: 1000, outputHeight: 1000 };
  if (text.includes('banner') || text.includes('cover') || text.includes('carousel')) return { aspect: '16:9', shape: 'rect', outputWidth: 1600, outputHeight: 900 };
  if (text.includes('hero')) return { aspect: '16:9', shape: 'rect', outputWidth: 1600, outputHeight: 900 };
  if (text.includes('post')) return { aspect: '4:3', shape: 'rect', outputWidth: 1400, outputHeight: 1050 };
  if (text.includes('image')) return { aspect: 'free', shape: 'rect' };
  return { aspect: 'free', shape: 'rect' };
};

export const MediaUploadButton: React.FC<MediaUploadButtonProps> = ({
  folder,
  accept,
  label = 'UPLOAD MEDIA',
  onUploaded,
  disabled,
  compact,
  multiple = false,
  targetUid,
  cropAspect,
  cropShape,
  outputWidth,
  outputHeight,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'uploading' | 'done'>('idle');
  const [error, setError] = useState('');
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropIndex, setCropIndex] = useState(0);
  const [cropOpen, setCropOpen] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<{ file: File; width?: number; height?: number } | null>(null);
  const inferred = inferCropConfig(folder, label);
  const effectiveAspect = cropAspect || inferred.aspect;
  const effectiveShape = cropShape || inferred.shape;
  const effectiveWidth = outputWidth || inferred.outputWidth;
  const effectiveHeight = outputHeight || inferred.outputHeight;
  const isImageFlow = imageAccepts(accept) && !videoOnlyAccept(accept) && !fileOnlyAccept(accept);

  const choose = () => inputRef.current?.click();

  const performUpload = async (file: File, width?: number, height?: number, originalFileName?: string) => {
    setStatus('uploading');
    setError('');
    setProgress(0);
    try {
      const result = await uploadMedia(file, folder, setProgress, { targetUid });
      onUploaded(result.publicUrl, {
        objectKey: result.objectKey,
        kind: result.kind,
        contentType: result.contentType,
        size: result.size,
        width,
        height,
        originalFileName,
      });
      setPendingRetry(null);
      return true;
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Upload failed.');
      setPendingRetry({ file, width, height });
      setProgress(null);
      return false;
    }
  };

  const processCropped = async (result: ImageCropResult) => {
    setCropOpen(false);
    setStatus('processing');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const success = await performUpload(result.file, result.width, result.height, cropQueue[cropIndex]?.name);
    if (!success) return;
    if (multiple && cropIndex < cropQueue.length - 1) {
      const nextIndex = cropIndex + 1;
      setCropIndex(nextIndex);
      setCropOpen(true);
      setStatus('idle');
      return;
    }
    setStatus('done');
    setTimeout(() => setStatus('idle'), 1800);
  };

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setError('');
    setPendingRetry(null);

    if (isImageFlow) {
      const imageFiles = multiple ? files : [files[0]];
      setCropQueue(imageFiles);
      setCropIndex(0);
      setCropOpen(true);
      return;
    }

    setStatus('uploading');
    try {
      for (const file of (multiple ? files : [files[0]])) {
        const success = await performUpload(file, undefined, undefined, file.name);
        if (!success) break;
      }
      if (!error) {
        setStatus('done');
        setTimeout(() => setStatus('idle'), 1800);
      }
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Upload failed.');
      setStatus('idle');
      setProgress(null);
    }
  };

  const retry = async () => {
    if (!pendingRetry) return;
    const success = await performUpload(pendingRetry.file, pendingRetry.width, pendingRetry.height);
    if (success) {
      setStatus('done');
      setTimeout(() => setStatus('idle'), 1800);
    }
  };

  const currentCropFile = cropQueue[cropIndex];
  const busy = status === 'uploading' || status === 'processing';

  return <div className={compact ? 'space-y-1' : 'space-y-2'}>
    <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={(event) => void handleFiles(event)} className="hidden" disabled={disabled || busy || cropOpen} />
    <button type="button" onClick={choose} disabled={disabled || busy || cropOpen} className="border-2 border-black px-3 py-2 bg-[var(--color-primary)] font-mono text-[10px] font-black uppercase disabled:opacity-50 flex items-center gap-1">
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : status === 'done' ? <CheckCircle2 className="w-3 h-3" /> : <UploadCloud className="w-3 h-3" />}
      {status === 'processing' ? 'PROCESSING…' : status === 'uploading' ? `UPLOADING ${progress ?? 0}%` : status === 'done' ? 'UPLOADED' : label}
    </button>
    {status === 'uploading' && <div className="h-2 border-2 border-black bg-white"><div className="h-full bg-black transition-all" style={{ width: `${progress ?? 0}%` }} /></div>}
    {pendingRetry && <button type="button" onClick={() => void retry()} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase">RETRY UPLOAD</button>}
    {error && <div className="font-mono text-[9px] text-red-600 uppercase">{error}</div>}
    {cropOpen && currentCropFile && (
      <ImageCropperModal
        file={currentCropFile}
        aspect={effectiveAspect}
        cropShape={effectiveShape}
        outputWidth={effectiveWidth}
        outputHeight={effectiveHeight}
        onCancel={() => { setCropOpen(false); setCropQueue([]); setCropIndex(0); setStatus('idle'); }}
        onConfirm={(result) => void processCropped(result)}
        title={`${label} · IMAGE EDITOR`}
      />
    )}
  </div>;
};
