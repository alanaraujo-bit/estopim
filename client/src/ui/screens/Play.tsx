import { MISSIONS, MODES, MODE_ORDER, dayKey, hashStr, rankOf } from '@estopim/shared';
import { go, online, profile, toast } from '../../state/store';
import { Backdrop } from '../Backdrop';
import { BackBar, Btn } from '../components';
import { Icon } from '../icons';
import { ModeIcon } from '../ModeIcon';

export function featuredMode(): string {
  const special = MODE_ORDER.filter((m) => MODES[m].special);
  return special[hashStr(dayKey()) % special.length];
}

export function Play() {
  const p = profile.value;
  const done = MISSIONS.filter((m) => p.campaign[m.id]?.done).length;
  const stars = Object.values(p.campaign).reduce((a, r) => a + r.stars.filter(Boolean).length, 0);
  const feat = MODES[featuredMode()];
  const isOnline = online.value === 'online';
  const rank = rankOf(p.ranked.mmr);
  const needOnline = (fn: () => void) => () => {
    if (!isOnline) {
      toast('Você está offline', 'warn', 'Os modos online voltam assim que a conexão for restabelecida.');
      return;
    }
    fn();
  };
  return (
    <div class="screen screen-anim">
      <Backdrop intensity={0.4} variant="dark" />
      <BackBar title="Jogar" kicker="Escolha seu fogo" />
      <div class="play-grid scroll">
        <button class="card play-card big campaign" onClick={() => go('campaign')}>
          <div class="pc-art">{Icon.map({ size: 64 })}</div>
          <div class="pc-body">
            <span class="kicker">História</span>
            <b class="display">Campanha: O Apagão</b>
            <p>36 missões, 6 chefes, segredos em cada canto.</p>
            <div class="row" style={{ gap: '8px' }}>
              <span class="chip chip-fire">
                {done}/{MISSIONS.length} missões
              </span>
              <span class="chip">★ {stars}/{MISSIONS.length * 3}</span>
            </div>
          </div>
        </button>
        <button class="card play-card" onClick={needOnline(() => go('queue', { kind: 'casual' }))}>
          <div class="pc-art">{Icon.bolt({ size: 48 })}</div>
          <div class="pc-body">
            <span class="kicker">Online</span>
            <b class="display">Partida Rápida</b>
            <p>Arena casual contra jogadores do mundo todo.</p>
            {!isOnline && <span class="chip">{Icon.wifiOff({ size: 14 })} Offline</span>}
          </div>
        </button>
        <button
          class={'card play-card' + (p.level < 5 ? ' locked' : '')}
          onClick={needOnline(() => {
            if (p.level < 5) {
              toast('Ranqueada libera no nível 5', 'info', 'Jogue partidas e missões para subir de nível.');
              return;
            }
            go('queue', { kind: 'ranked' });
          })}
        >
          <div class="pc-art" style={{ color: rank.color }}>
            {Icon.trophy({ size: 48 })}
          </div>
          <div class="pc-body">
            <span class="kicker">Competitivo</span>
            <b class="display">Ranqueada</b>
            <p>Duelos 1 contra 1. Suba de divisão.</p>
            <span class="chip" style={{ borderColor: rank.color, color: rank.color }}>
              {p.level < 5 ? 'Nível 5 necessário' : `${rank.label} · ${p.ranked.mmr}`}
            </span>
          </div>
        </button>
        <button class="card play-card" onClick={needOnline(() => go('online'))}>
          <div class="pc-art">{Icon.users({ size: 48 })}</div>
          <div class="pc-body">
            <span class="kicker">Com amigos</span>
            <b class="display">Sala Privada</b>
            <p>Crie uma sala, mande o código, jogue do seu jeito.</p>
          </div>
        </button>
        <button class="card play-card" onClick={() => go('setup', {})}>
          <div class="pc-art">{Icon.pad({ size: 48 })}</div>
          <div class="pc-body">
            <span class="kicker">Offline</span>
            <b class="display">Local e Bots</b>
            <p>Até 4 no mesmo aparelho, com teclado e controles. Complete com bots.</p>
          </div>
        </button>
        <button class="card play-card featured" onClick={() => go('setup', { mode: feat.id })}>
          <div class="pc-art">
            <ModeIcon id={feat.id} size={52} />
          </div>
          <div class="pc-body">
            <span class="kicker">Modo em destaque hoje</span>
            <b class="display">{feat.name}</b>
            <p>{feat.tagline}</p>
          </div>
        </button>
      </div>
      <div class="row wrap" style={{ gap: '8px', position: 'relative' }}>
        <span class="muted small">Todos os modos:</span>
        {MODE_ORDER.map((m) => (
          <Btn key={m} kind="ghost" size="sm" onClick={() => go('setup', { mode: m })}>
            {MODES[m].name}
          </Btn>
        ))}
      </div>
    </div>
  );
}
