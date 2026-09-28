import { useEffect, useState } from 'preact/hooks';
import { CHALLENGES, CHARACTERS, COSMETIC_BY_ID, SEASON, rollChallenges, seasonTier, xpToNext, type CharId } from '@estopim/shared';
import { music } from '../../audio/music';
import { go, mutateProfile, online, profile } from '../../state/store';
import { Backdrop } from '../Backdrop';
import { CharPicker } from '../CharPicker';
import { Bar, Btn, CharPortrait, Currency } from '../components';
import { Icon } from '../icons';
import { Logo } from '../Logo';

export function ProfileChip() {
  const p = profile.value;
  const title = COSMETIC_BY_ID[p.equipped.title]?.name ?? '';
  return (
    <button class="profile-chip" onClick={() => go('profile')} aria-label="Abrir perfil">
      <span class="avatar">
        <CharPortrait char={p.favoriteChar} size={70} skin={p.equipped.skins[p.favoriteChar]} still />
        <span class="lvl">{p.level}</span>
      </span>
      <span class="col" style={{ gap: '2px', alignItems: 'flex-start', minWidth: 0 }}>
        <span class="nm">{p.name || 'Jogador'}</span>
        <span class="tt">{title}</span>
      </span>
    </button>
  );
}

export function Home() {
  const p = profile.value;
  const [picker, setPicker] = useState(false);
  useEffect(() => {
    music.play('menu', 3);
    music.setIntensity(1);
    mutateProfile((pp) => rollChallenges(pp));
  }, []);
  const c = CHARACTERS[p.favoriteChar];
  const tier = seasonTier(p);
  const unclaimedSeason = Array.from({ length: tier }, (_, i) => i + 1).some((t) => !p.season.claimed.includes(t));
  const readyChal = [...p.daily.list, ...p.weekly.list].some((x) => !x.claimed && x.progress >= (CHALLENGES[x.id]?.target ?? 1e9));
  const readyAch = Object.values(p.achievements).some((a) => a.done && !a.claimed);
  return (
    <div class="screen home screen-anim">
      <Backdrop intensity={0.7} />
      <div class="topbar" style={{ position: 'relative' }}>
        <ProfileChip />
        <div class="spacer" />
        <span class={'chip ' + (online.value === 'online' ? 'chip-ok' : 'chip')} title={online.value === 'online' ? 'Conectado aos servidores' : 'Modo offline'}>
          {online.value === 'online' ? Icon.wifi({ size: 16 }) : Icon.wifiOff({ size: 16 })}
          {online.value === 'online' ? 'Online' : online.value === 'connecting' ? 'Conectando…' : 'Offline'}
        </span>
        <Currency />
        <Btn kind="ghost" title="Amigos" icon={Icon.users({ size: 22 })} onClick={() => go('friends')} />
        <Btn kind="ghost" title="Configurações" icon={Icon.gear({ size: 22 })} onClick={() => go('settings')} />
      </div>
      <div class="home-main" style={{ position: 'relative' }}>
        <div class="home-left">
          <Logo size={0.62} sub={false} />
          <nav class="home-nav" aria-label="Menu principal">
            <Btn kind="fire" size="xl" class="play-btn" shine icon={Icon.play({ size: 34 })} onClick={() => go('play')}>
              JOGAR
            </Btn>
            <button class="card nav-tile" onClick={() => go('campaign')}>
              {Icon.map()}
              <b>Campanha</b>
              <small>A história do Apagão</small>
            </button>
            <button class="card nav-tile" onClick={() => go('online')}>
              {Icon.globe()}
              <b>Online</b>
              <small>Rápida, ranqueada e salas</small>
            </button>
            <button class="card nav-tile" onClick={() => go('locker')}>
              {Icon.shirt()}
              <b>Armário</b>
              <small>Visuais e personalização</small>
            </button>
            <button class="card nav-tile" onClick={() => go('season')}>
              {Icon.flag()}
              <b>Temporada</b>
              <small>Faixa {tier} de {SEASON.tiers}</small>
              {unclaimedSeason && <span class="badge-dot" />}
            </button>
          </nav>
          <div class="home-mini">
            <Btn kind="ghost" size="sm" icon={Icon.target({ size: 18 })} dot={readyChal} onClick={() => go('challenges')}>
              Desafios
            </Btn>
            <Btn kind="ghost" size="sm" icon={Icon.medal({ size: 18 })} dot={readyAch} onClick={() => go('challenges', { tab: 'conquistas' })}>
              Conquistas
            </Btn>
            <Btn kind="ghost" size="sm" icon={Icon.trophy({ size: 18 })} onClick={() => go('rankings')}>
              Ranking
            </Btn>
            <Btn kind="ghost" size="sm" icon={Icon.bag({ size: 18 })} onClick={() => go('shop')}>
              Oficina
            </Btn>
          </div>
        </div>
        <div class="home-right">
          <div class="showcase">
            <CharPortrait char={p.favoriteChar} size={Math.min(420, Math.max(200, window.innerHeight * 0.52))} pedestal skin={p.equipped.skins[p.favoriteChar]} />
            <div class="showcase-info">
              <span class="role">{c.role}</span>
              <span class="name">{c.name}</span>
              <span class="muted small">{c.title}</span>
              <Btn kind="ghost" size="sm" icon={Icon.refresh({ size: 16 })} onClick={() => setPicker(true)}>
                Trocar
              </Btn>
            </div>
          </div>
          <div class="home-cards">
            <div class="panel mini-card col" onClick={() => go('challenges')} role="button" tabIndex={0}>
              <div class="row between">
                <span class="kicker">Desafios do dia</span>
                {Icon.target({ size: 18 })}
              </div>
              {p.daily.list.map((ch) => {
                const def = CHALLENGES[ch.id];
                if (!def) return null;
                return (
                  <div class="chal-line" key={ch.id}>
                    <span style={{ textDecoration: ch.claimed ? 'line-through' : 'none', opacity: ch.claimed ? 0.5 : 1 }}>{def.text}</span>
                    <span class="tiny muted">
                      {ch.progress}/{def.target}
                    </span>
                    <Bar value={ch.progress / def.target} kind="green" />
                  </div>
                );
              })}
            </div>
            <div class="panel mini-card col" onClick={() => go('profile')} role="button" tabIndex={0}>
              <div class="row between">
                <span class="kicker">Nível {p.level}</span>
                <span class="tiny muted">
                  {p.xp}/{xpToNext(p.level)} XP
                </span>
              </div>
              <Bar value={p.xp / xpToNext(p.level)} />
              <div class="row between" style={{ marginTop: '4px' }}>
                <span class="kicker" style={{ color: 'var(--cool)' }}>
                  {SEASON.name.split('—')[1]?.trim()}
                </span>
                <span class="tiny muted">Faixa {tier}</span>
              </div>
              <Bar value={(p.season.xp % SEASON.tierXp) / SEASON.tierXp} kind="cool" />
            </div>
          </div>
        </div>
      </div>
      {picker && (
        <CharPicker
          value={p.favoriteChar}
          onClose={() => setPicker(false)}
          onPick={(ch: CharId) => {
            mutateProfile((pp) => (pp.favoriteChar = ch));
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}
