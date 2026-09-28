import { CHARACTERS, COSMETIC_BY_ID, RARITY_INFO, SEASON, seasonReward, seasonTier } from '@estopim/shared';
import { doOp } from '../../net/client';
import { profile, toast } from '../../state/store';
import { sfx } from '../../audio/sfx';
import { Backdrop } from '../Backdrop';
import { BackBar, Bar, Btn, Bunting, CharPortrait, Currency } from '../components';
import { Icon } from '../icons';

export function Season() {
  const p = profile.value;
  const tier = seasonTier(p);
  const within = p.season.xp % SEASON.tierXp;
  const daysLeft = Math.max(0, Math.ceil((new Date(SEASON.ends).getTime() - Date.now()) / 86400000));
  const claim = (t: number) => {
    const r = doOp({ k: 'claimSeason', tier: t });
    if (r.ok) {
      sfx.reward();
      const rw = seasonReward(t);
      toast(rw.item ? `${COSMETIC_BY_ID[rw.item]?.name}` : `+${rw.sparks} Faíscas`, 'reward', `Faixa ${t} resgatada`, '✦');
    }
  };
  const claimAll = () => {
    for (let t = 1; t <= tier; t++) if (!p.season.claimed.includes(t)) doOp({ k: 'claimSeason', tier: t });
    sfx.reward();
  };
  const pending = Array.from({ length: tier }, (_, i) => i + 1).filter((t) => !p.season.claimed.includes(t));
  return (
    <div class="screen screen-anim">
      <Backdrop intensity={1} />
      <Bunting n={24} />
      <BackBar title="Temporada" kicker={SEASON.name.split('—')[0]} right={<Currency />} />
      <div class="season-head panel" style={{ position: 'relative' }}>
        <div class="col" style={{ gap: '6px', flex: 1 }}>
          <span class="kicker">{SEASON.name.split('—')[1]}</span>
          <p class="small">{SEASON.desc}</p>
          <div class="row between small">
            <b>Faixa {tier}/{SEASON.tiers}</b>
            <span class="muted">
              {within}/{SEASON.tierXp} XP de temporada · termina em {daysLeft} dias
            </span>
          </div>
          <Bar value={tier >= SEASON.tiers ? 1 : within / SEASON.tierXp} kind="cool" />
          <p class="tiny muted">XP de temporada vem de partidas, missões e desafios. Todas as recompensas desta trilha são gratuitas.</p>
        </div>
        {pending.length > 1 && (
          <Btn kind="gold" icon={Icon.gift({ size: 18 })} onClick={claimAll}>
            Resgatar {pending.length}
          </Btn>
        )}
      </div>
      <div class="season-track scroll-x">
        {Array.from({ length: SEASON.tiers }, (_, i) => i + 1).map((t) => {
          const rw = seasonReward(t);
          const item = rw.item ? COSMETIC_BY_ID[rw.item] : null;
          const reached = t <= tier;
          const claimed = p.season.claimed.includes(t);
          return (
            <div key={t} class={'tier' + (reached ? ' reached' : '') + (claimed ? ' claimed' : '') + (item ? ' special' : '')} style={item ? ({ '--rc': RARITY_INFO[item.rarity].color } as any) : undefined}>
              <span class="tier-n">{t}</span>
              <div class="tier-art">
                {item?.kind === 'skin' && item.char ? <CharPortrait char={item.char} size={78} skin={item.id} still /> : item ? <span class="emo">{item.kind === 'emote' ? item.data?.glyph : item.kind === 'bomb' ? '●' : item.kind === 'banner' ? '▰' : item.kind === 'trail' ? '✦' : '❝'}</span> : <span class="coin-art">{Icon.coin({ size: 30 })}</span>}
              </div>
              <small>{item ? item.name : `${rw.sparks} Faíscas`}</small>
              {item?.char && <small class="muted">{CHARACTERS[item.char].name}</small>}
              {reached && !claimed && (
                <Btn kind="gold" size="sm" onClick={() => claim(t)}>
                  Resgatar
                </Btn>
              )}
              {claimed && <span class="chip chip-ok">{Icon.check({ size: 12 })}</span>}
              {!reached && <span class="chip">{Icon.lock({ size: 12 })}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
