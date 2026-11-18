import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { assert } from './content.mjs';

export async function loadHomeShareImage() {
  const image = JSON.parse(await readFile(new URL('../../content/media/home-share.json', import.meta.url), 'utf8'));
  assert(typeof image.sha256 === 'string' && /^[a-f0-9]{64}$/.test(image.sha256), 'Homepage share card requires a valid checksum');
  assert(image.path === `/assets/social/home-${image.sha256.slice(0, 16)}.jpg`, 'Invalid homepage share card path');
  assert(image.width === 1200 && image.height === 630 && image.type === 'image/jpeg', 'Homepage share card must be a 1200 by 630 JPEG');
  assert(typeof image.alt === 'string' && image.alt.trim(), 'Homepage share card requires alternative text');
  const bytes = await readFile(new URL(`../assets/social/home-${image.sha256.slice(0, 16)}.jpg`, import.meta.url));
  assert(createHash('sha256').update(bytes).digest('hex') === image.sha256, 'Homepage share card checksum mismatch');
  const metadata = await sharp(bytes).metadata();
  assert(metadata.format === 'jpeg' && metadata.width === image.width && metadata.height === image.height, 'Homepage share card dimensions or format mismatch');
  return image;
}
