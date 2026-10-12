// A friend's choice never changes the shared catalog entry used by another friend.
const realisticAssets = new WeakMap();
export function styledAsset(asset, style) {
  const urls = asset?.realisticSpriteUrls;
  if (style !== 'realistic' || !urls?.default) return asset;
  if (realisticAssets.has(asset)) return realisticAssets.get(asset);
  const seasonalSpriteUrls = Object.fromEntries(Object.entries(urls).filter(([season]) => season !== 'default'));
  const selected = {
    ...asset,
    spriteStyle: 'realistic',
    spriteUrl: urls.default,
    seasonalSpriteUrls,
    portraitUrl: asset.realisticPortraitUrl,
  };
  realisticAssets.set(asset, selected);
  return selected;
}
