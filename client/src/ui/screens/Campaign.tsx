import { useState } from 'preact/hooks';
import { BIOMES, CHAPTERS, MISSIONS, starText, type MissionDef } from '@estopim/shared';
import { go, profile } from '../../state/store';
import { sfx } from '../../audio/sfx';
import { Backdrop } from '../Backdrop';
import { BackBar, Btn, Stars } from '../components';
import { Icon } from '../icons';
import { MapThumb } from '../ModeIcon';

export function missionUnlocked(m: MissionDef) {
  return !m.requires || !!profile.value.campaign[m.requires]?.done;
}

export function Campaign({ params }: { params?: { chapter?: number } }) {
  const p = profile.value;
  const firstOpen = MISSIONS.find((m) => missionUnlocked(m) && !p.campaign[m.id]?.done) ?? MISSIONS[MISSIONS.length - 1];
  const [ch, setCh] = useState(params?.chapter ?? firstOpen.chapter);
  const [sel, setSel] = useState<string>(firstOpen.chapter === ch ? firstOpen.id : `${ch}-1`);
  const chapter = CHAPTERS[ch - 1];
  const list = MISSIONS.filter((m) => m.chapter === ch);
  const mission = MISSIONS.find((m) => m.id === sel) ?? list[0];
  const unlockedCh = (n: number) => missionUnlocked(MISSIONS.find((m) => m.chapter === n)!);
  const biome = BIOMES[chapter.biome];
  const rec = p.campaign[mission.id];
  const open = missionUnlocked(mission);
  return (
    <div class="screen screen-anim campaign-screen" style={{ '--accent': biome.accent } as any}>
      <Backdrop intensity={0.3} variant="dark" />
      <BackBar
        title="Campanha"
        kicker="O Apagão"
        right={
          <span class="chip">
            ★ {Object.values(p.campaign).reduce((a, r) => a + r.stars.filter(Boolean).length, 0)}/{MISSIONS.length * 3}
          </span>
        }
      />
      <div class="chapter-tabs">
        {CHAPTERS.map((c) => {
          const un = unlockedCh(c.n);
          const done = MISSIONS.filter((m) => m.chapter === c.n && p.campaign[m.id]?.done).length;
          return (
            <button
              key={c.n}
              class={'chapter-tab' + (c.n === ch ? ' on' : '') + (un ? '' : ' locked')}
              onClick={() => {
                if (!un) return sfx.error();
                sfx.click();
                setCh(c.n);
                const first = MISSIONS.find((m) => m.chapter === c.n && missionUnlocked(m) && !p.campaign[m.id]?.done) ?? MISSIONS.find((m) => m.chapter === c.n)!;
                setSel(first.id);
              }}
              style={{ '--bc': BIOMES[c.biome].accent } as any}
            >
              <span class="ct-n">{c.n}</span>
              <span class="ct-name">{un ? c.name : '???'}</span>
              <span class="ct-prog">{un ? `${done}/6` : Icon.lock({ size: 12 })}</span>
            </button>
          );
        })}
      </div>
      <div class="camp-body">
        <div class="camp-path panel">
          <div class="camp-head">
            <span class="kicker" style={{ color: biome.accent }}>
              Capítulo {chapter.n} · {biome.name}
            </span>
            <h2 class="h2">{chapter.name}</h2>
            <p class="small muted">{chapter.blurb}</p>
          </div>
          <div class="path">
            <svg class="path-line" viewBox="0 0 600 140" preserveAspectRatio="none" aria-hidden="true">
              <path d="M20 110 C 90 20, 150 20, 200 70 S 300 130, 360 70 S 470 10, 580 60" />
            </svg>
            {list.map((m, i) => {
              const r = p.campaign[m.id];
              const un = missionUnlocked(m);
              const pos = [
                [3, 78],
                [20, 30],
                [36, 58],
                [55, 72],
                [72, 30],
                [92, 44],
              ][i];
              return (
                <button
                  key={m.id}
                  class={'node' + (m.id === sel ? ' sel' : '') + (r?.done ? ' done' : '') + (un ? '' : ' locked') + (m.boss ? ' boss' : '')}
                  style={{ left: pos[0] + '%', top: pos[1] + '%' }}
                  onClick={() => {
                    sfx.click();
                    setSel(m.id);
                  }}
                  aria-label={`Missão ${m.id}: ${m.name}`}
                >
                  <span class="node-disc">{un ? (m.boss ? Icon.skull({ size: 22 }) : m.index) : Icon.lock({ size: 16 })}</span>
                  {r && <Stars stars={r.stars} size={11} />}
                </button>
              );
            })}
          </div>
        </div>
        <div class="camp-detail panel col">
          <div class="row between">
            <span class="kicker">
              Missão {mission.id}
              {mission.boss ? ' · Chefe' : ''}
            </span>
            {rec && <Stars stars={rec.stars} size={18} />}
          </div>
          <h2 class="h2">{open ? mission.name : '???'}</h2>
          {open ? (
            <>
              <p class="small">{mission.briefing}</p>
              <div class="row" style={{ gap: '12px', alignItems: 'flex-start' }}>
                <MapThumb map={mission.map} size={130} />
                <ul class="star-list">
                  <li class={rec?.stars[0] ? 'ok' : ''}>{mission.summary}</li>
                  {mission.stars.map((s, i) => (
                    <li key={i} class={rec?.stars[i + 1] ? 'ok' : ''}>
                      {starText(s)}
                    </li>
                  ))}
                </ul>
              </div>
              {rec?.best ? <span class="tiny muted">Melhor tempo: {Math.floor(rec.best / 60)}:{String(rec.best % 60).padStart(2, '0')}</span> : null}
              <Btn kind="fire" size="lg" shine icon={Icon.play({ size: 20 })} onClick={() => go('briefing', { id: mission.id })}>
                {rec?.done ? 'Jogar de novo' : 'Jogar'}
              </Btn>
            </>
          ) : (
            <p class="muted">Conclua a missão anterior para liberar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
