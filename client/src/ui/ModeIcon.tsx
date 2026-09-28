import { useEffect, useRef } from 'preact/hooks';
import { F, MAP_BY_ID, Rng, T, parseMap, type MapDef } from '@estopim/shared';
import { BIOME_ART } from '../art/biomes';
import { Icon } from './icons';

export function ModeIcon({ id, size = 32 }: { id: string; size?: number }) {
  switch (id) {
    case 'classico':
      return Icon.bomb({ size });
    case 'equipes':
      return Icon.users({ size });
    case 'coroa':
      return Icon.crown({ size });
    case 'chuva':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
          <circle cx="8" cy="15" r="4" fill="currentColor" />
          <circle cx="17" cy="9" r="3" fill="currentColor" />
          <path d="M8 3v5M17 1v3M12 6v3M20 14v3" />
        </svg>
      );
    case 'brasa':
      return Icon.flame({ size });
    case 'captura':
      return Icon.target({ size });
    case 'horda':
      return Icon.robot({ size });
  }
  return Icon.bomb({ size });
}

/** Miniatura do mapa (visão de cima simplificada). */
export function MapThumb({ id, map, size = 120 }: { id?: string; map?: MapDef; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const def = map ?? (id ? MAP_BY_ID[id] : undefined);
    const cv = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = cv.getContext('2d')!;
    if (!def) {
      cv.width = size * dpr;
      cv.height = size * 0.86 * dpr;
      c.scale(dpr, dpr);
      c.fillStyle = '#2a1a44';
      c.fillRect(0, 0, size, size);
      c.fillStyle = '#ffd166';
      c.font = `900 ${size * 0.4}px Bungee, system-ui`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('?', size / 2, size * 0.43);
      return;
    }
    const pm = parseMap(def, new Rng(7), { items: null });
    const cell = size / pm.w;
    const H = cell * pm.h;
    cv.width = size * dpr;
    cv.height = H * dpr;
    cv.style.height = H + 'px';
    c.scale(dpr, dpr);
    const a = BIOME_ART[def.biome];
    for (let y = 0; y < pm.h; y++)
      for (let x = 0; x < pm.w; x++) {
        const i = y * pm.w + x;
        const t = pm.tiles[i],
          f = pm.floor[i];
        let col = (x + y) % 2 ? a.floorA : a.floorB;
        if (f === F.Ice) col = '#cdeefc';
        if (f >= F.ConvU && f <= F.ConvL) col = '#f2a33a';
        if (f === F.Teleport) col = '#8a6aff';
        if (f === F.Vent) col = '#ff7a1a';
        if (f === F.Pit) col = '#05060e';
        if (t === T.Wall) col = a.wallTop;
        if (t === T.Pillar) col = a.pillarTop;
        if (t === T.Block || t === T.Hard) col = a.blockTop;
        if (t === T.Vine) col = '#4f9a4a';
        if (t === T.Barrel) col = '#e8413b';
        if (t === T.MirrorA || t === T.MirrorB) col = '#bff8ff';
        c.fillStyle = col;
        c.fillRect(x * cell, y * cell, Math.ceil(cell), Math.ceil(cell));
      }
    for (const s of pm.spawns) {
      c.fillStyle = '#fff3c4';
      c.beginPath();
      c.arc((s.x + 0.5) * cell, (s.y + 0.5) * cell, cell * 0.35, 0, Math.PI * 2);
      c.fill();
    }
    if (def.dark) {
      c.fillStyle = 'rgba(5,2,12,0.55)';
      c.fillRect(0, 0, size, H);
    }
  }, [id, map, size]);
  return <canvas ref={ref} class="map-thumb" style={{ width: size + 'px', height: size * 0.86 + 'px', borderRadius: '10px', display: 'block' }} />;
}
