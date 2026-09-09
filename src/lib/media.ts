import { auth } from './firebase';

export type MediaUploadKind = 'image' | 'video' | 'file';

export interface MediaUploadResult {
  publicUrl: string;
  objectKey: string;
  kind: MediaUploadKind;
  contentType: string;
  size: number;
}

export const mediaLimits = {
  image: 10 * 1024 * 1024,
  video: 250 * 1024 * 1024,
  file: 25 * 1024 * 1024,
} as const;

const allowedTypes = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf',
]);

export async function uploadMedia(file: File, folder: 'profile' | 'articles' | 'posts' | 'videos' | 'attachments' | 'carousel' | 'users', onProgress?: (progress: number) => void): Promise<MediaUploadResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in before uploading media.');
  if (!allowedTypes.has(file.type)) throw new Error('Unsupported media format.');
  const kind: MediaUploadKind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
  const limit = mediaLimits[kind];
  if (file.size > limit) throw new Error(`File is too large. Maximum allowed is ${Math.round(limit / (1024 * 1024))} MB.`);

  const idToken = await user.getIdToken();
  const response = await fetch('/api/media/upload-url', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size, folder }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Could not prepare media upload.');

  await uploadWithProgress(data.uploadUrl, file, file.type, onProgress);
  onProgress?.(100);
  return { publicUrl: data.publicUrl, objectKey: data.objectKey, kind: data.kind, contentType: file.type, size: file.size };
}

function uploadWithProgress(url: string, file: File, contentType: string, onProgress?: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Media upload failed (${xhr.status}).`));
    xhr.onerror = () => reject(new Error('Network error during media upload.'));
    xhr.onabort = () => reject(new Error('Media upload was cancelled.'));
    xhr.send(file);
  });
}
