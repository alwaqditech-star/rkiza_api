import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

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
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN) || Boolean(process.env.VERCEL);
}

async function saveToBlobStorage(
  buffer: Buffer,
  blobPath: string,
  contentType: string,
): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'تخزين الصور غير مهيأ على Vercel — أنشئ Blob Store واربطه بمشروع rkiza_api',
    );
  }

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

  const ext = mimeToExt(mime);
  const filename = `${options.filenameBase}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (shouldUseBlobStorage()) {
    const blobPath = `uploads/${options.directory}/${filename}`;
    return saveToBlobStorage(buffer, blobPath, mime);
  }

  return saveToLocalFilesystem(
    buffer,
    options.directory,
    filename,
    options.publicPathPrefix,
  );
}
