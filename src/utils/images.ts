import { readFile } from 'fs/promises';
import path from 'path';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

export function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

export function looksLikeFilePath(text: string): boolean {
  const trimmed = text.trim();
  if (isImageFile(trimmed)) return true;
  if (trimmed.startsWith('/') || trimmed.startsWith('~') || trimmed.startsWith('./') || trimmed.startsWith('../') || /^[A-Z]:\\/i.test(trimmed)) {
    return isImageFile(trimmed) || true;
  }
  return false;
}

export async function imageToBase64(filePath: string): Promise<string | null> {
  try {
    const resolved = path.resolve(filePath.replace(/^~/, process.env.HOME || ''));
    const data = await readFile(resolved);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mime};base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
}
