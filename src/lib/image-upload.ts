import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import {
  type MediaScope,
  mediaPublicPath,
  saveMediaAsset,
} from './media-storage';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_SIZE = 2 * 1024 * 1024;

function resolveImageMime(file: File): string | null {
  if (file.type && ALLOWED_TYPES.has(file.type)) {
    return file.type;
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return null;
}

function mimeToExt(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}

function shouldUseBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function shouldUseDatabaseStorage(): boolean {
  return Boolean(process.env.VERCEL);
}

async function saveToBlobStorage(
  buffer: Buffer,
  blobPath: string,
  contentType: string,
): Promise<string> {
  const { put } = await import('@vercel/blob');
  const blob = await put(blobPath, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return `${blob.url}?v=${Date.now()}`;
}

async function saveToLocalFilesystem(
  buffer: Buffer,
  directory: string,
  filename: string,
  publicPathPrefix: string,
): Promise<string> {
  const dir = path.join(process.cwd(), 'public', 'uploads', directory);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return `${publicPathPrefix}/${filename}?v=${Date.now()}`;
}

export async function saveUploadedImage(
  file: File,
  options: {
    scope: MediaScope;
    ownerId: number;
    directory: string;
    filenameBase: string;
    publicPathPrefix: string;
  },
): Promise<string> {
  const mime = resolveImageMime(file);
  if (!mime) {
    throw new Error('نوع الصورة غير مدعوم — استخدم JPG أو PNG أو WEBP');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('حجم الصورة يجب ألا يتجاوز 2 ميجابايت');
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (shouldUseBlobStorage()) {
    const ext = mimeToExt(mime);
    const blobPath = `uploads/${options.directory}/${options.filenameBase}.${ext}`;
    return saveToBlobStorage(buffer, blobPath, mime);
  }

  if (shouldUseDatabaseStorage()) {
    return saveMediaAsset(options.scope, options.ownerId, mime, buffer);
  }

  const ext = mimeToExt(mime);
  const filename = `${options.filenameBase}.${ext}`;
  return saveToLocalFilesystem(
    buffer,
    options.directory,
    filename,
    options.publicPathPrefix,
  );
}

export { mediaPublicPath, type MediaScope };
