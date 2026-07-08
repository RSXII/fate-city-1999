import { readdirSync } from 'fs';
import { join } from 'path';

export const prerender = true;

export function load() {
  const dir = join(process.cwd(), 'static', 'images', 'camera');
  let photos = [];
  try {
    photos = readdirSync(dir)
      .filter(f => /\.(png|jpe?g|webp|gif)$/i.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] ?? '0');
        const numB = parseInt(b.match(/\d+/)?.[0] ?? '0');
        return numA - numB || a.localeCompare(b);
      });
  } catch { /* directory missing or unreadable */ }
  return { photos };
}
