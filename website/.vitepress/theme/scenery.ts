// A scene as the site shows it: the WebP copy site:prepare made (scripts/site-images.mjs), or the
// app's own PNG when there was no browser to make one.
import { withBase } from 'vitepress';
import generated from '../generated.json';

const originals = import.meta.glob('../../../src/art/environments/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const copies = new Set((generated as { sceneImages?: string[] }).sceneImages ?? []);

export const sceneryUrl = (name: string) =>
  copies.has(name) ? withBase(`/yard/scenes/${name}.webp`) : originals[`../../../src/art/environments/${name}.png`];
