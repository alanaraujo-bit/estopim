import { useEffect, useState } from 'preact/hooks';
import { RANKS, rankOf, type CharId } from '@estopim/shared';
import { api } from '../../net/client';
import { online, profile } from '../../state/store';
import { Backdrop } from '../Backdrop';
import { BackBar, CharPortrait, Seg } from '../components';
import { Icon } from '../icons';

interface Entry {
  id: string;
  name: string;
  tag: string;
  level: number;
  mmr: number;
  wins: number;
  games: number;
  char: CharId;
}

export function Rankings() {
  const p = profile.value;
  const [kind, setKind] = useState<'ranked' | 'level'>('ranked');
  const [data, setData] = useState<{ entries: Entry[]; me?: { pos: number } } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    setData(null);
    setErr('');
    api<{ entries: Entry[]; me?: { pos: number } }>('/api/leaderboard?type=' + kind)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [kind, online.value]);
  const myRank = rankOf(p.ranked.mmr);
  return (
    <div class="screen screen-anim">
      <Backdrop intensity={0.25} variant="dark" />
      <BackBar title="Ranking" kicker="Os melhores do Circuito" />
      <div class="row wrap" style={{ position: 'relative', gap: '12px' }}>
        <Seg
          value={kind}
          options={[
            { v: 'ranked', label: 'Ranqueada' },
            { v: 'level', label: 'Nível' },
          ]}
          onChange={setKind}
        />
        <span class="chip" style={{ color: myRank.color }}>
          Você: {myRank.label} · {p.ranked.mmr}
          {data?.me ? ` · #${data.me.pos}` : ''}
        </span>
      </div>
      <div class="rank-tiers" style={{ position: 'relative' }}>
        {RANKS.map((r) => (
          <span key={r.id} class={'tier-chip' + (myRank.id === r.id ? ' on' : '')} style={{ color: r.color, borderColor: r.color }}>
            {r.name}
            <small>{r.min}+</small>
          </span>
        ))}
      </div>
      <div class="panel scroll grow" style={{ position: 'relative' }}>
        {err && <p class="muted">{online.value === 'online' ? err : 'Conecte-se para ver o ranking global.'}</p>}
        {!err && !data && <div class="spinner" />}
        {data && !data.entries.length && <p class="muted">Ninguém no ranking ainda. Seja o primeiro!</p>}
        {data?.entries.map((e, i) => {
          const r = rankOf(e.mmr);
          return (
            <div key={e.id} class={'lb-row' + (e.id === p.id ? ' me' : '') + (i < 3 ? ' top' : '')}>
              <span class="lb-pos">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
              <CharPortrait char={e.char} size={40} still />
              <b class="lb-name">
                {e.name}
                <small class="muted">#{e.tag}</small>
              </b>
              <span class="small muted">Nv. {e.level}</span>
              {kind === 'ranked' ? (
                <span class="lb-score" style={{ color: r.color }}>
                  {r.label} · {e.mmr}
                </span>
              ) : (
                <span class="lb-score">{e.wins} vitórias</span>
              )}
            </div>
          );
        })}
      </div>
      {Icon.trophy({ size: 0 })}
    </div>
  );
}
