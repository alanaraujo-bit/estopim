import { useEffect, useState } from 'preact/hooks';
import { ACHIEVEMENTS, CHARACTERS, COSMETIC_BY_ID, MISSIONS, MISSION_BY_ID, RARITY_INFO, rankOf, starText, xpToNext, type CharId, type MatchEndInfo } from '@estopim/shared';
import { music } from '../../audio/music';
import { sfx } from '../../audio/sfx';
import { go, profile, resetTo } from '../../state/store';
import { send } from '../../net/client';
import { Backdrop } from '../Backdrop';
import { Bar, Btn, CharPortrait, Stars } from '../components';
import { Icon } from '../icons';
import { TEAM_COLORS } from '../../game/renderer';

function eventLabel(ev: string): { text: string; sub: string; kind: string } | null {
  const [k, a, b] = ev.split(':');
  switch (k) {
    case 'level':
      return { text: `Nível ${a}!`, sub: 'Você subiu de nível', kind: 'level' };
    case 'item': {
      const c = COSMETIC_BY_ID[a];
      return c ? { text: c.name, sub: `Novo ${({ skin: 'visual', bomb: 'carga', trail: 'rastro', emote: 'emote', victory: 'comemoração', banner: 'faixa', frame: 'moldura', title: 'título' } as any)[c.kind]} · ${RARITY_INFO[c.rarity].name}`, kind: 'item' } : null;
    }
    case 'char':
      return { text: CHARACTERS[a as CharId]?.name ?? a, sub: 'Novo personagem desbloqueado!', kind: 'char' };
    case 'ach': {
      const d = ACHIEVEMENTS.find((x) => x.id === a);
      return d ? { text: d.name, sub: 'Conquista desbloqueada', kind: 'ach' } : null;
    }
    case 'mastery':
      return { text: `Maestria ${b} — ${CHARACTERS[a as CharId]?.name}`, sub: 'Maestria de personagem', kind: 'mastery' };
  }
  return null;
}

export function Results({ params }: { params: any }) {
  const p = profile.value;
  const [shown, setShown] = useState(0);
  const kind = params.kind as 'mission' | 'local' | 'online';
  const info: MatchEndInfo | undefined = params.info;
  const events: string[] = (kind === 'online' ? info?.events : params.events) ?? [];
  const labels = events.map(eventLabel).filter(Boolean) as { text: string; sub: string; kind: string }[];

  let won = false;
  let title = '';
  let sub = '';
  let char: CharId = p.favoriteChar;
  if (kind === 'mission') {
    won = params.success;
    title = won ? 'Missão concluída!' : 'Missão falhou';
    sub = won ? MISSION_BY_ID[params.id]?.name : params.reason;
    char = params.char;
  } else if (kind === 'local') {
    const me = params.players[params.local[0]];
    won = params.winnerTeam === me.team;
    char = me.char;
    title = params.winnerTeam < 0 ? 'Empate!' : won ? 'Vitória!' : 'Derrota';
    sub = params.local.length > 1 && params.winnerTeam >= 0 ? `${params.players.filter((x: any) => x.team === params.winnerTeam).map((x: any) => x.name).join(' e ')} venceu!` : '';
  } else if (info) {
    const me = info.players[params.local[0]];
    won = info.winnerTeam === me?.team;
    char = me?.char ?? char;
    title = info.winnerTeam < 0 ? 'Empate!' : won ? 'Vitória!' : 'Derrota';
    sub = info.ranked ? 'Ranqueada' : 'Partida online';
  }
  const rewards = kind === 'online' ? info?.rewards : params.rewards;
  const missionRewards = kind === 'mission' ? params.rewards : null;
  const xp = rewards?.xp ?? missionRewards?.xp ?? 0;
  const sparks = rewards?.sparks ?? missionRewards?.sparks ?? 0;

  useEffect(() => {
    music.play(won ? 'vitoria' : 'menu', 5);
    if (won) sfx.reward();
    const iv = setInterval(() => setShown((s) => s + 1), 380);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    const l = labels[shown - 3];
    if (l) l.kind === 'level' ? sfx.levelUp() : sfx.reward();
  }, [shown]);

  const players = kind === 'local' ? params.players : kind === 'online' ? info?.players ?? [] : [];
  const def = kind === 'mission' ? MISSION_BY_ID[params.id] : null;
  const nextMission = def ? MISSIONS[MISSIONS.indexOf(def) + 1] : null;

  return (
    <div class={'screen results screen-anim ' + (won ? 'won' : 'lost')}>
      <Backdrop intensity={won ? 1.6 : 0} variant={won ? 'night' : 'dark'} />
      <div class="res-wrap">
        <div class="res-hero">
          <CharPortrait char={char} size={220} pedestal emote={won ? 'win' : 'sad'} dir={2} skin={p.equipped.skins[char]} />
          <div class="col" style={{ gap: '6px' }}>
            <span class="kicker">{kind === 'mission' ? `Missão ${params.id}` : 'Resultado'}</span>
            <h1 class={'res-title' + (won ? ' win' : '')}>{title}</h1>
            {sub && <span class="muted">{sub}</span>}
            {kind === 'mission' && (
              <div class="col" style={{ gap: '4px', marginTop: '6px' }}>
                <Stars stars={params.stars} size={30} />
                {def && (
                  <ul class="star-list">
                    <li class={params.stars[0] ? 'ok' : ''}>Concluir a missão</li>
                    {def.stars.map((s, i) => (
                      <li key={i} class={params.stars[i + 1] ? 'ok' : ''}>
                        {starText(s)}
                      </li>
                    ))}
                  </ul>
                )}
                <span class="small muted">
                  Tempo: {Math.floor(params.time / 60)}:{String(params.time % 60).padStart(2, '0')}
                </span>
              </div>
            )}
            {info?.mmr && (
              <span class="chip" style={{ color: rankOf(info.mmr.after).color }}>
                {rankOf(info.mmr.after).label} · {info.mmr.after} ({info.mmr.after - info.mmr.before >= 0 ? '+' : ''}
                {info.mmr.after - info.mmr.before})
              </span>
            )}
          </div>
        </div>

        {players.length > 0 && (
          <div class="panel res-table">
            <div class="rt-row head">
              <span>Jogador</span>
              <span title="Eliminações">Elim.</span>
              <span title="Quedas">Quedas</span>
              <span title="Blocos">Blocos</span>
              <span title="Brasas">Brasas</span>
            </div>
            {players.map((pl: any, i: number) => (
              <div key={i} class={'rt-row' + ((kind === 'local' ? params.local : params.local).includes(i) ? ' me' : '')} style={{ '--tc': TEAM_COLORS[pl.team % 4] } as any}>
                <span class="row" style={{ gap: '8px' }}>
                  <CharPortrait char={pl.char} size={34} still />
                  <b>{pl.name}</b>
                  {pl.bot ? <span class="tag" style={{ background: '#6a5a8a', color: '#fff' }}>BOT</span> : null}
                  {pl.team === (kind === 'local' ? params.winnerTeam : info?.winnerTeam) && <span style={{ color: '#ffcf3d' }}>{Icon.crown({ size: 16 })}</span>}
                </span>
                <span>{pl.kills}</span>
                <span>{pl.deaths}</span>
                <span>{pl.blocks}</span>
                <span>{pl.items}</span>
              </div>
            ))}
          </div>
        )}

        <div class="panel res-rewards col">
          <div class="row between">
            <span class="kicker">Recompensas</span>
            <span class="row" style={{ gap: '8px' }}>
              <span class="chip chip-fire">+{xp} XP</span>
              <span class="chip" style={{ color: '#ffe7a0' }}>
                {Icon.coin({ size: 14 })} +{sparks}
              </span>
            </span>
          </div>
          {rewards?.breakdown && (
            <div class="xp-lines">
              {rewards.breakdown.map((b: any, i: number) => (
                <div key={i} class={'xp-line' + (shown > i ? ' in' : '')}>
                  <span>{b.label}</span>
                  <b>+{b.xp}</b>
                </div>
              ))}
            </div>
          )}
          {missionRewards && (
            <div class="xp-lines">
              <div class={'xp-line' + (shown > 0 ? ' in' : '')}>
                <span>{missionRewards.firstClear ? 'Primeira conclusão' : 'Missão repetida'}</span>
                <b>+{missionRewards.firstClear ? 260 : 60}</b>
              </div>
              {missionRewards.newStars > 0 && (
                <div class={'xp-line' + (shown > 1 ? ' in' : '')}>
                  <span>Estrelas novas ×{missionRewards.newStars}</span>
                  <b>+{missionRewards.newStars * 70}</b>
                </div>
              )}
            </div>
          )}
          <div class="row between small">
            <b>Nível {p.level}</b>
            <span class="muted">
              {p.xp}/{xpToNext(p.level)} XP
            </span>
          </div>
          <Bar value={p.xp / xpToNext(p.level)} />
          {labels.length > 0 && (
            <div class="unlocks">
              {labels.map((l, i) => (
                <div key={i} class={'unlock ' + l.kind + (shown > i + 2 ? ' in' : '')}>
                  <span class="u-ico">{l.kind === 'level' ? Icon.starFill({ size: 22 }) : l.kind === 'char' ? Icon.user({ size: 22 }) : l.kind === 'ach' ? Icon.medal({ size: 22 }) : Icon.gift({ size: 22 })}</span>
                  <div>
                    <b>{l.text}</b>
                    <small>{l.sub}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
          {kind !== 'online' && !won && kind === 'local' && <p class="tiny muted">Partidas contra bots rendem um pouco menos XP que partidas online.</p>}
        </div>

        <div class="row wrap res-actions">
          {kind === 'mission' && (
            <>
              {params.success && nextMission && (
                <Btn kind="fire" size="lg" shine icon={Icon.next({ size: 20 })} onClick={() => resetTo('briefing', { id: nextMission.id, char: params.char })}>
                  Próxima missão
                </Btn>
              )}
              <Btn kind={params.success ? 'ghost' : 'fire'} icon={Icon.refresh({ size: 18 })} onClick={() => resetTo('game', { kind: 'mission', id: params.id, char: params.char })}>
                Tentar de novo
              </Btn>
              <Btn kind="ghost" icon={Icon.map({ size: 18 })} onClick={() => resetTo('campaign', { chapter: def?.chapter })}>
                Mapa da campanha
              </Btn>
            </>
          )}
          {kind === 'local' && (
            <>
              <Btn kind="fire" size="lg" icon={Icon.refresh({ size: 20 })} onClick={() => resetTo('game', { kind: 'local', cfg: { ...params.cfg, seed: undefined } })}>
                Revanche
              </Btn>
              <Btn kind="ghost" icon={Icon.gear({ size: 18 })} onClick={() => resetTo('setup', { mode: params.cfg.mode })}>
                Ajustar partida
              </Btn>
            </>
          )}
          {kind === 'online' && (
            <>
              <Btn
                kind="fire"
                size="lg"
                icon={Icon.refresh({ size: 20 })}
                onClick={() => {
                  send({ t: 'rematch' });
                  resetTo('lobby', {});
                }}
              >
                Revanche
              </Btn>
              <Btn kind="ghost" icon={Icon.bolt({ size: 18 })} onClick={() => resetTo('queue', { kind: info?.ranked ? 'ranked' : 'casual' })}>
                Nova partida
              </Btn>
            </>
          )}
          <Btn kind="ghost" icon={Icon.home({ size: 18 })} onClick={() => resetTo('home')}>
            Início
          </Btn>
        </div>
      </div>
    </div>
  );
}

export { go };
