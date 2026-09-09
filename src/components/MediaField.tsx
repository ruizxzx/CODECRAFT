import React from 'react';
import { MediaUploadButton } from './MediaUploadButton';

type MediaKind = 'image' | 'video' | 'file';

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  folder: 'profile' | 'articles' | 'posts' | 'videos' | 'attachments' | 'carousel' | 'users';
  accept: string;
  uploadLabel?: string;
  placeholder?: string;
  kind?: MediaKind;
  compact?: boolean;
  preview?: boolean;
  disabled?: boolean;
};

export const MediaField: React.FC<Props> = ({
  label,
  value,
  onChange,
  folder,
  accept,
  uploadLabel = 'UPLOAD',
  placeholder = 'Paste a public media URL or upload',
  kind = 'image',
  compact = false,
  preview = true,
  disabled = false,
}) => {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {label && <label className="font-mono text-[10px] font-black uppercase">{label}</label>}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 min-w-0 border-2 border-black p-2 font-mono text-xs bg-white"
        />
        <MediaUploadButton
          folder={folder}
          accept={accept}
          label={uploadLabel}
          compact={compact}
          disabled={disabled}
          onUploaded={(url) => onChange(url)}
        />
      </div>
      {preview && value && /^https?:\/\//i.test(value) && (
        <div className="border-2 border-black bg-neutral-100 p-2">
          {kind === 'video' ? (
            <video src={value} controls preload="metadata" className="w-full max-h-56 object-contain bg-black" />
          ) : kind === 'file' ? (
            <a href={value} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] font-black uppercase underline break-all">OPEN FILE · {value}</a>
          ) : (
            <img src={value} alt="Media preview" className="w-full max-h-56 object-contain bg-white border border-black" loading="lazy" />
          )}
        </div>
      )}
    </div>
  );
};
