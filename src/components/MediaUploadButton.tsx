import React, { useRef, useState } from 'react';
import { UploadCloud, Loader2, CheckCircle2 } from 'lucide-react';
import { uploadMedia } from '../lib/media';

interface MediaUploadButtonProps {
  folder: 'profile' | 'articles' | 'posts' | 'videos' | 'attachments' | 'carousel' | 'users';
  accept: string;
  label?: string;
  onUploaded: (url: string, meta: { objectKey: string; kind: 'image' | 'video' | 'file'; contentType: string; size: number }) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const MediaUploadButton: React.FC<MediaUploadButtonProps> = ({ folder, accept, label = 'UPLOAD MEDIA', onUploaded, disabled, compact }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const choose = () => inputRef.current?.click();
  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setDone(false); setProgress(0);
    try {
      const result = await uploadMedia(file, folder, setProgress);
      onUploaded(result.publicUrl, { objectKey: result.objectKey, kind: result.kind, contentType: result.contentType, size: result.size });
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Upload failed.');
      setProgress(null);
    }
  };

  return <div className={compact ? 'space-y-1' : 'space-y-2'}>
    <input ref={inputRef} type="file" accept={accept} onChange={(event) => void handleChange(event)} className="hidden" disabled={disabled || progress !== null} />
    <button type="button" onClick={choose} disabled={disabled || progress !== null} className="border-2 border-black px-3 py-2 bg-[var(--color-primary)] font-mono text-[10px] font-black uppercase disabled:opacity-50 flex items-center gap-1">
      {progress !== null ? <Loader2 className="w-3 h-3 animate-spin" /> : done ? <CheckCircle2 className="w-3 h-3" /> : <UploadCloud className="w-3 h-3" />}
      {progress !== null ? `UPLOADING ${progress}%` : done ? 'UPLOADED' : label}
    </button>
    {progress !== null && <div className="h-2 border-2 border-black bg-white"><div className="h-full bg-black transition-all" style={{ width: `${progress}%` }} /></div>}
    {error && <div className="font-mono text-[9px] text-red-600 uppercase">{error}</div>}
  </div>;
};
