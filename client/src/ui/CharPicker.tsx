import { useState } from 'preact/hooks';
import { CHARACTERS, CHAR_ORDER, masteryLevel, type CharId } from '@estopim/shared';
import { profile } from '../state/store';
import { sfx } from '../audio/sfx';
import { Btn, CharPortrait } from './components';
import { Icon } from './icons';

export function unlockText(c: CharId): string {
  const u = CHARACTERS[c].unlock;
  if (u.type === 'level') return `Alcance o nível ${u.level}`;
  if (u.type === 'campaign') return `Conclua a missão ${u.mission} da campanha`;
  return '';
}

export function isUnlocked(c: CharId) {
  return profile.value.unlockedChars.includes(c);
}

export function CharInfo({ c }: { c: CharId }) {
  const d = CHARACTERS[c];
  return (
    <div class="col" style={{ gap: '10px' }}>
      <div class="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
        <span class="chip chip-fire">{d.role}</span>
        <span class="chip">
          Dificuldade{' '}
          {[1, 2, 3].map((k) => (
            <span key={k} style={{ color: k <= d.difficulty ? '#ffd166' : 'rgba(255,255,255,.2)' }}>
              ●
            </span>
          ))}
        </span>
        <span class="chip">{d.origin}</span>
      </div>
      <p class="muted small">{d.bio}</p>
      <div class="ability-box">
        <div class="row between">
          <b class="h3">Técnica: {d.ability.name}</b>
          <span class="chip chip-cool">
            {Icon.clock({ size: 14 })} {d.ability.cooldown}s
          </span>
        </div>
        <p class="small">{d.ability.desc}</p>
      </div>
      <div class="ability-box passive">
        <b class="h3">Passiva: {d.passive.name}</b>
        <p class="small">{d.passive.desc}</p>
      </div>
      <div class="stat-grid">
        <StatRow label="Cargas" v={d.start.bombs} max={d.caps.bombs} cap={8} />
        <StatRow label="Alcance" v={d.start.range} max={d.caps.range} cap={8} />
        <StatRow label="Velocidade" v={d.start.speed + 1} max={d.caps.speed + 1} cap={7} />
      </div>
    </div>
  );
}

function StatRow({ label, v, max, cap }: { label: string; v: number; max: number; cap: number }) {
  return (
    <div class="stat-row">
      <span>{label}</span>
      <div class="pips" aria-label={`${label}: inicial ${v}, máximo ${max}`}>
        {Array.from({ length: cap }, (_, i) => (
          <i key={i} class={i < v ? 'on' : i < max ? 'cap' : ''} />
        ))}
      </div>
    </div>
  );
}

/** Seletor de personagem em sobreposição. */
export function CharPicker(p: { value: CharId; onPick: (c: CharId) => void; onClose: () => void; allowLocked?: boolean; title?: string }) {
  const [sel, setSel] = useState<CharId>(p.value);
  const locked = !isUnlocked(sel) && !p.allowLocked;
  const mastery = profile.value.mastery[sel] ?? 0;
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && p.onClose()}>
      <div class="panel picker" role="dialog" aria-label="Escolha seu personagem">
        <div class="row between">
          <h2 class="h2">{p.title ?? 'Escolha seu personagem'}</h2>
          <Btn kind="ghost" title="Fechar" icon={Icon.close({ size: 20 })} onClick={p.onClose} />
        </div>
        <div class="picker-body">
          <div class="picker-grid">
            {CHAR_ORDER.map((c) => {
              const un = isUnlocked(c) || p.allowLocked;
              return (
                <button
                  key={c}
                  class={'card picker-card' + (sel === c ? ' selected' : '') + (un ? '' : ' locked')}
                  onClick={() => {
                    sfx.click();
                    setSel(c);
                  }}
                  onDblClick={() => un && p.onPick(c)}
                  aria-label={CHARACTERS[c].name + (un ? '' : ' (bloqueado)')}
                >
                  <CharPortrait char={c} size={84} skin={profile.value.equipped.skins[c]} still={sel !== c} />
                  <span class="nm">{CHARACTERS[c].name}</span>
                  {!un && <span class="lock">{Icon.lock({ size: 18 })}</span>}
                </button>
              );
            })}
          </div>
          <div class="picker-detail">
            <div class="row" style={{ alignItems: 'flex-end' }}>
              <CharPortrait char={sel} size={150} pedestal dir={2} skin={profile.value.equipped.skins[sel]} />
              <div class="col" style={{ gap: '4px' }}>
                <span class="kicker">{CHARACTERS[sel].title}</span>
                <span class="display" style={{ fontSize: '2rem' }}>
                  {CHARACTERS[sel].name}
                </span>
                <span class="muted small">“{CHARACTERS[sel].quote}”</span>
                {isUnlocked(sel) && <span class="chip chip-cool">Maestria {masteryLevel(mastery)}</span>}
              </div>
            </div>
            <CharInfo c={sel} />
            {locked ? (
              <div class="chip chip-warn" style={{ alignSelf: 'flex-start' }}>
                {Icon.lock({ size: 16 })} {unlockText(sel)}
              </div>
            ) : (
              <Btn kind="fire" size="lg" icon={Icon.check({ size: 20 })} onClick={() => p.onPick(sel)}>
                Escolher {CHARACTERS[sel].name}
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
