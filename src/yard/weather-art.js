// Textures decode only when their season is visible; small precipitation materials are cached.
import { canvasFor, decodeImage, materialCache } from './raster.js';

const loadSeasonalImage = () => decodeImage('../art/weather/seasonal.png');

export function createWeatherArt(changed, { loadImage = loadSeasonalImage, makeCanvas = canvasFor } = {}) {
  let image = null,
    pending = null,
    decorative = false,
    season = 'summer';
  const materials = materialCache(makeCanvas),
    { material } = materials;
  function use(nextSeason, weather, active) {
    season = nextSeason;
    decorative = active && (season === 'spring' || season === 'autumn') && weather === 'clear';
    if (decorative && !pending) {
      pending = Promise.resolve(loadImage())
        .then(loaded => {
          if (loaded && loaded.width === 384 && loaded.height === 256) image = loaded;
          if (image && decorative) changed();
        })
        .catch(() => {});
    }
    if (weather === 'rain') {
      for (const [key, ink] of [
        ['rain-day', '168,192,214'],
        ['rain-night', '190,208,230'],
      ])
        material(key, ctx => {
          const gradient = ctx.createLinearGradient(0, 0, 0, 64);
          gradient.addColorStop(0, `rgba(${ink},0)`);
          gradient.addColorStop(0.35, `rgba(${ink},0.45)`);
          gradient.addColorStop(0.85, `rgba(${ink},1)`);
          gradient.addColorStop(1, `rgba(${ink},0.7)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.moveTo(31.5, 1);
          ctx.lineTo(36, 56);
          ctx.quadraticCurveTo(32, 64, 28, 56);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = `rgba(${ink},0.9)`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(32, 39);
          ctx.lineTo(32, 58);
          ctx.stroke();
        });
      for (const [key, ink] of [
        ['ripple-day', '168,192,214'],
        ['ripple-night', '190,208,230'],
      ])
        material(key, ctx => {
          ctx.strokeStyle = `rgba(${ink},0.8)`;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.ellipse(32, 32, 27, 9, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = `rgba(${ink},0.4)`;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.ellipse(32, 32, 18, 6, 0, 0, Math.PI * 2);
          ctx.stroke();
        });
    }
    if (weather === 'snow') {
      material('snow-far', ctx => {
        const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 27);
        glow.addColorStop(0, 'rgba(255,255,255,0.95)');
        glow.addColorStop(0.3, 'rgba(247,251,255,0.8)');
        glow.addColorStop(1, 'rgba(247,251,255,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, 64, 64);
      });
      material('snow-near', ctx => {
        ctx.translate(32, 32);
        ctx.strokeStyle = '#eff7ff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let arm = 0; arm < 6; arm++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -25);
          for (const at of [12, 19]) {
            ctx.moveTo(0, -at);
            ctx.lineTo(-5, -at + 5);
            ctx.moveTo(0, -at);
            ctx.lineTo(5, -at + 5);
          }
          ctx.stroke();
        }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
  function faller(ctx, particle, kind, scale, now) {
    if (!image) return false;
    const column = Math.min(2, Math.max(0, Math.floor(particle.tint * 3))),
      size = particle.size * (kind === 'spring' ? 3 : 3.8) * scale;
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.phase * 0.8 + particle.spin * now);
    ctx.scale(1, 0.5 + 0.5 * Math.abs(Math.cos(particle.phase)));
    ctx.drawImage(image, column * 128, kind === 'spring' ? 128 : 0, 128, 128, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }
  function rain(ctx, particle, scale, night) {
    const sprite = materials.get(night ? 'rain-night' : 'rain-day');
    if (!sprite) return false;
    const width = (0.8 + particle.depth * 0.9) * scale * 12,
      length = particle.size * scale;
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(Math.atan(-particle.vx / particle.vy));
    ctx.drawImage(sprite, -width / 2, -length, width, length);
    ctx.restore();
    return true;
  }
  function snow(ctx, particle, scale) {
    const near = particle.depth > 0.72,
      sprite = materials.get(near ? 'snow-near' : 'snow-far');
    if (!sprite) return false;
    const size = particle.size * scale * (near ? 3.2 : 3);
    ctx.save();
    ctx.translate(particle.x, particle.y);
    if (near) ctx.rotate(particle.phase * 0.2);
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }
  function ripple(ctx, splash, scale, progress, night) {
    const sprite = materials.get(night ? 'ripple-night' : 'ripple-day');
    if (!sprite || progress <= 0 || progress >= 1) return false;
    const size = (2 + splash.depth * 5) * progress * scale * 4;
    ctx.drawImage(sprite, splash.x - size / 2, splash.y - size / 2, size, size);
    return true;
  }
  return { use, faller, rain, snow, ripple };
}
