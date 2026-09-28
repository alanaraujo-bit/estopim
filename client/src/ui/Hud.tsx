import { BOSS_INFO, CARTRIDGES, CHARACTERS, CURSE_DEFS, I, ITEMS, type Game, type HudObjective } from '@estopim/shared';
import { SLOT_COLORS, TEAM_COLORS } from '../game/renderer';
import { CharPortrait } from './components';
import { Icon } from './icons';

const fmt = (ticks: number) => {
  const s = Math.max(0, Math.ceil(ticks / 60));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export interface HudProps {
  g: Game;
  local: number[];
  wins?: Record<number, number>;
  roundsToWin?: number;
  mission?: boolean;
  compact?: boolean;
  onPause: () => void;
  showPause: boolean;
  ping?: number;
}

export function Hud({ g, local, wins, roundsToWin, mission, compact, onPause, showPause, ping }: HudProps) {
  const teamsMode = new Set(g.players.map((p) => p.team)).size < g.players.length;
  const objectives: HudObjective[] = (g as any).remoteHud ?? g.ctl.hud?.(g) ?? [];
  const boss = g.enemies.find((e) => e.boss && e.alive);
  const me = g.players[local[0]];
  return (
    <div class={'hud' + (compact ? ' compact' : '')}>
      {!mission && (
        <div class="hud-top">
          <div class="hud-players">
            {g.players.map((p) => {
              const col = teamsMode ? TEAM_COLORS[p.team % 4] : SLOT_COLORS[p.id % 8];
              const w = wins?.[p.team] ?? 0;
              return (
                <div key={p.id} class={'hp-card' + (p.alive ? '' : ' dead') + (local.includes(p.id) ? ' me' : '')} style={{ '--pc': col } as any}>
                  <div class="hp-face">
                    <CharPortrait char={p.char} size={44} still skin={p.cosmetics?.skin} />
                    {!p.alive && <span class="hp-skull">{Icon.skull({ size: 22 })}</span>}
                  </div>
                  <div class="hp-info">
                    <span class="hp-name">{p.name}</span>
                    <span class="hp-stats">
                      <span title="Cargas">●{p.bombsMax}</span>
                      <span title="Alcance">✚{p.range}</span>
                      <span title="Velocidade">»{p.speedLvl + 1}</span>
                      {p.shield > 0 && <span title="Escudo">◆</span>}
                      {p.kick && <span title="Chute">K</span>}
                    </span>
                    {roundsToWin && roundsToWin > 1 && (
                      <span class="hp-wins" aria-label={`${w} rodadas vencidas`}>
                        {Array.from({ length: roundsToWin }, (_, k) => (
                          <i key={k} class={k < w ? 'on' : ''} />
                        ))}
                      </span>
                    )}
                    {g.mode === 'coroa' && <span class="hp-score">{Math.floor(((g.mstate.teamScore ?? {})[p.team] ?? 0) / 60)} pts</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div class={'hud-timer' + (g.sudden ? ' sudden' : '')}>
            {g.mode === 'horda' || g.mode === 'chuva' ? objectives[0]?.text ?? '' : fmt(g.timeLeft)}
            {g.sudden && <small>COLAPSO!</small>}
          </div>
        </div>
      )}
      {mission && (
        <div class="hud-mission">
          <div class="obj-panel">
            {objectives
              .filter((o) => !o.optional)
              .map((o, k) => (
                <div key={k} class={'obj' + (o.done ? ' done' : '') + (o.failed ? ' failed' : '')}>
                  <span class="obj-check">{o.done ? Icon.check({ size: 14 }) : '•'}</span>
                  <span>{o.text}</span>
                  {o.progress !== undefined && !o.done && (
                    <span class="obj-bar">
                      <i style={{ width: Math.max(0, Math.min(1, o.progress)) * 100 + '%' }} />
                    </span>
                  )}
                </div>
              ))}
          </div>
          {me && (
            <div class="hearts" aria-label={`Vida: ${me.hp} de ${me.maxHp}`}>
              {Array.from({ length: me.maxHp }, (_, k) => (
                <span key={k} class={k < me.hp ? 'on' : ''}>
                  {Icon.heart({ size: 22 })}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {boss && (
        <div class="boss-bar">
          <span class="display">{BOSS_INFO[boss.type]?.name ?? 'Chefe'}</span>
          <div class="bb">
            <i style={{ width: (boss.hp / boss.maxHp) * 100 + '%' }} />
            {Array.from({ length: boss.maxHp - 1 }, (_, k) => (
              <b key={k} style={{ left: ((k + 1) / boss.maxHp) * 100 + '%' }} />
            ))}
          </div>
        </div>
      )}
      {me && me.alive && !compact && <LocalStatus g={g} id={me.id} />}
      {showPause && (
        <button class="hud-pause btn btn-ghost btn-icon" onClick={onPause} title="Pausar">
          {Icon.pause({ size: 20 })}
        </button>
      )}
      {ping !== undefined && ping > 0 && <span class={'ping' + (ping > 150 ? ' bad' : '')}>{ping} ms</span>}
    </div>
  );
}

function LocalStatus({ g, id }: { g: Game; id: number }) {
  const p = g.players[id];
  const c = CHARACTERS[p.char];
  const cd = p.abilityCd / Math.max(1, p.abilityMax);
  const cart = p.cart ? CARTRIDGES[p.cart] : null;
  return (
    <div class="local-status">
      {g.rules.abilities && (
        <div class={'ls-abil' + (cd > 0 ? ' cooling' : ' ready')} style={{ '--cd': cd } as any} title={c.ability.desc}>
          <b>{c.ability.name}</b>
          <small>{cd > 0 ? Math.ceil(p.abilityCd / 60) + 's' : 'PRONTA'}</small>
        </div>
      )}
      {cart && (
        <div class="ls-cart" style={{ '--cc': cart.color } as any} title={cart.desc}>
          <b>{cart.short}</b>
          <small>×{p.cartCharges}</small>
        </div>
      )}
      {p.curse > 0 && (
        <div class="ls-curse">
          <b>{p.curse === 99 ? 'Brasa Quente' : CURSE_DEFS[p.curse]?.name}</b>
          <small>{Math.ceil(p.curseT / 60)}s</small>
        </div>
      )}
      {p.potatoT > 0 && (
        <div class="ls-curse hot">
          <b>BRASA QUENTE</b>
          <small>{Math.ceil(p.potatoT / 60)}s</small>
        </div>
      )}
    </div>
  );
}

export { ITEMS, I };
