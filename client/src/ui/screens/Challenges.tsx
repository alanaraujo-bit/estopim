import { useState } from 'preact/hooks';
import { ACHIEVEMENTS, CHALLENGES, COSMETIC_BY_ID, type Reward } from '@estopim/shared';
import { doOp } from '../../net/client';
import { profile, toast } from '../../state/store';
import { sfx } from '../../audio/sfx';
import { Backdrop } from '../Backdrop';
import { BackBar, Bar, Btn, Currency, Seg } from '../components';
import { Icon } from '../icons';

function rewardText(r: Reward) {
  const parts: string[] = [];
  if (r.sparks) parts.push(`${r.sparks} Faíscas`);
  if (r.seasonXp) parts.push(`${r.seasonXp} XP de temporada`);
  if (r.item) parts.push(COSMETIC_BY_ID[r.item]?.name ?? r.item);
  return parts.join(' + ');
}

function untilReset(weekly: boolean) {
  const now = new Date(Date.now() - 3 * 3600e3);
  const end = new Date(now);
  end.setUTCHours(24, 0, 0, 0);
  if (weekly) {
    const day = (now.getUTCDay() + 6) % 7;
    end.setUTCDate(end.getUTCDate() + (6 - day));
  }
  const ms = end.getTime() - now.getTime();
  const h = Math.floor(ms / 3600e3);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor((ms % 3600e3) / 60e3)}min`;
}

export function Challenges({ params }: { params?: { tab?: string } }) {
  const p = profile.value;
  const [tab, setTab] = useState(params?.tab ?? 'desafios');
  const claimC = (id: string) => {
    const r = doOp({ k: 'claimChallenge', id });
    if (r.ok) {
      sfx.reward();
      toast('Desafio concluído!', 'reward', rewardText(CHALLENGES[id].reward), '✦');
    }
  };
  const claimA = (id: string) => {
    const r = doOp({ k: 'claimAch', id });
    if (r.ok) {
      sfx.reward();
      const a = ACHIEVEMENTS.find((x) => x.id === id)!;
      toast(a.name, 'reward', rewardText(a.reward), '🏅');
    }
  };
  const doneAch = ACHIEVEMENTS.filter((a) => p.achievements[a.id]?.done).length;
  return (
    <div class="screen screen-anim">
      <Backdrop intensity={0.3} variant="dark" />
      <BackBar title={tab === 'desafios' ? 'Desafios' : 'Conquistas'} kicker="Progresso" right={<Currency />} />
      <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
        <Seg
          value={tab}
          options={[
            { v: 'desafios', label: 'Desafios' },
            { v: 'conquistas', label: `Conquistas ${doneAch}/${ACHIEVEMENTS.length}` },
          ]}
          onChange={setTab}
        />
      </div>
      {tab === 'desafios' ? (
        <div class="chal-cols scroll">
          {[
            { title: 'Diários', list: p.daily.list, weekly: false },
            { title: 'Semanais', list: p.weekly.list, weekly: true },
          ].map((grp) => (
            <section key={grp.title} class="panel col">
              <div class="row between">
                <span class="kicker">{grp.title}</span>
                <span class="chip">
                  {Icon.clock({ size: 14 })} renova em {untilReset(grp.weekly)}
                </span>
              </div>
              {grp.list.map((c) => {
                const def = CHALLENGES[c.id];
                if (!def) return null;
                const ready = c.progress >= def.target && !c.claimed;
                return (
                  <div key={c.id} class={'chal' + (c.claimed ? ' claimed' : '') + (ready ? ' ready' : '')}>
                    <div class="col" style={{ gap: '4px', flex: 1 }}>
                      <b>{def.text}</b>
                      <Bar value={c.progress / def.target} kind="green" />
                      <small class="muted">
                        {c.progress}/{def.target} · {rewardText(def.reward)}
                      </small>
                    </div>
                    {ready ? (
                      <Btn kind="gold" size="sm" icon={Icon.gift({ size: 16 })} onClick={() => claimC(c.id)}>
                        Resgatar
                      </Btn>
                    ) : c.claimed ? (
                      <span class="chip chip-ok">{Icon.check({ size: 14 })}</span>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      ) : (
        <div class="ach-grid scroll">
          {ACHIEVEMENTS.map((a) => {
            const st = p.achievements[a.id];
            const prog = Math.min(a.target, a.check(p));
            const ready = st?.done && !st.claimed;
            return (
              <div key={a.id} class={'card ach' + (st?.done ? ' done' : '') + (ready ? ' ready' : '')}>
                <span class="ach-ico">{st?.done ? Icon.medal({ size: 30 }) : Icon.lock({ size: 26 })}</span>
                <div class="col" style={{ gap: '3px', flex: 1 }}>
                  <b>{a.name}</b>
                  <small class="muted">{a.desc}</small>
                  {!st?.done && <Bar value={prog / a.target} />}
                  <small class="tiny">{rewardText(a.reward)}</small>
                </div>
                {ready && (
                  <Btn kind="gold" size="sm" onClick={() => claimA(a.id)}>
                    Resgatar
                  </Btn>
                )}
                {st?.claimed && <span class="chip chip-ok">{Icon.check({ size: 14 })}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
