import { useEffect, useState } from 'preact/hooks';
import { CHARACTERS, CHAR_ORDER, COSMETIC_BY_ID, MASTERY_LEVELS, MODES, masteryLevel, rankOf, xpToNext, type Profile } from '@estopim/shared';
import { ApiError, account, api, doOp, login, logout, register } from '../../net/client';
import { confirmModal, online, profile, toast } from '../../state/store';
import { sfx } from '../../audio/sfx';
import { Backdrop } from '../Backdrop';
import { BackBar, Bar, Btn, CharPortrait, Seg } from '../components';
import { Icon } from '../icons';

export function ProfileCard({ p, compact }: { p: Profile; compact?: boolean }) {
  const ban = COSMETIC_BY_ID[p.equipped.banner]?.data ?? { a: '#ff7a2f', b: '#3a1d4f' };
  const frame = COSMETIC_BY_ID[p.equipped.frame]?.data?.color ?? '#ffd9a8';
  const title = COSMETIC_BY_ID[p.equipped.title]?.name ?? '';
  const rank = rankOf(p.ranked.mmr);
  return (
    <div class={'pcard' + (compact ? ' compact' : '')} style={{ '--ba': ban.a, '--bb': ban.b, '--fr': frame } as any}>
      <div class="pcard-banner" />
      <div class="pcard-body">
        <div class="pcard-avatar">
          <CharPortrait char={p.favoriteChar} size={compact ? 70 : 96} skin={p.equipped.skins[p.favoriteChar]} still />
          <span class="lvl">{p.level}</span>
        </div>
        <div class="col" style={{ gap: '2px', minWidth: 0 }}>
          <b class="display pc-name">
            {p.name || 'Jogador'} <span class="muted small">#{p.tag}</span>
          </b>
          <span class="pc-title">{title}</span>
          <span class="chip" style={{ color: rank.color, alignSelf: 'flex-start' }}>
            {Icon.trophy({ size: 14 })} {rank.label}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ProfileScreen({ params }: { params?: any }) {
  const p = profile.value;
  const [tab, setTab] = useState<'geral' | 'personagens' | 'historico' | 'conta'>(params?.tab ?? 'geral');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const s = p.stats;
  const hours = Math.floor(s.playSeconds / 3600);
  const mins = Math.floor((s.playSeconds % 3600) / 60);
  return (
    <div class="screen screen-anim">
      <Backdrop intensity={0.25} variant="dark" />
      <BackBar title="Perfil" kicker="Sua trajetória" />
      <div class="profile-top" style={{ position: 'relative' }}>
        <ProfileCard p={p} />
        <div class="panel col" style={{ flex: 1, minWidth: '240px' }}>
          <div class="row between small">
            <b>Nível {p.level}</b>
            <span class="muted">
              {p.xp}/{xpToNext(p.level)} XP
            </span>
          </div>
          <Bar value={p.xp / xpToNext(p.level)} />
          {editing ? (
            <div class="row">
              <input class="input" value={name} maxLength={16} onInput={(e) => setName((e.target as HTMLInputElement).value)} aria-label="Novo nome" />
              <Btn
                kind="fire"
                size="sm"
                onClick={() => {
                  const r = doOp({ k: 'name', name });
                  if (r.ok) {
                    setEditing(false);
                    sfx.confirm();
                  } else toast(r.error ?? 'Nome inválido', 'error');
                }}
              >
                Salvar
              </Btn>
            </div>
          ) : (
            <Btn kind="ghost" size="sm" icon={Icon.edit({ size: 16 })} onClick={() => setEditing(true)}>
              Alterar nome
            </Btn>
          )}
          <span class="tiny muted">Seu código de amigo: <b>{p.name}#{p.tag}</b></span>
        </div>
      </div>
      <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
        <Seg
          value={tab}
          options={[
            { v: 'geral', label: 'Estatísticas' },
            { v: 'personagens', label: 'Maestria' },
            { v: 'historico', label: 'Histórico' },
            { v: 'conta', label: 'Conta' },
          ]}
          onChange={setTab}
        />
      </div>
      <div class="scroll grow" style={{ position: 'relative' }}>
        {tab === 'geral' && (
          <div class="stat-cards">
            {[
              ['Partidas', s.matches],
              ['Vitórias', s.wins],
              ['Taxa de vitória', s.matches ? Math.round((s.wins / s.matches) * 100) + '%' : '—'],
              ['Eliminações', s.kills],
              ['Quedas', s.deaths],
              ['Blocos destruídos', s.blocks],
              ['Brasas coletadas', s.items],
              ['Cargas soltas', s.bombs],
              ['Maior cadeia', s.bestChain ? s.bestChain + 1 : 0],
              ['Por um triz', s.nearMiss],
              ['Missões concluídas', s.missions],
              ['Relíquias', s.secrets],
              ['Partidas online', s.onlineMatches],
              ['Ranqueada', `${p.ranked.wins}V / ${p.ranked.games - p.ranked.wins}D`],
              ['Tempo de jogo', `${hours}h ${mins}min`],
            ].map(([k, v]) => (
              <div key={k as string} class="panel stat-card">
                <small class="muted">{k}</small>
                <b class="display">{v}</b>
              </div>
            ))}
            {Object.keys(s.byMode).length > 0 && (
              <div class="panel stat-card wide">
                <small class="muted">Por modo</small>
                {Object.entries(s.byMode).map(([m, v]) => (
                  <div key={m} class="row between small">
                    <span>{MODES[m]?.name ?? m}</span>
                    <span>
                      {v.w}/{v.m}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === 'personagens' && (
          <div class="mastery-grid">
            {CHAR_ORDER.map((c) => {
              const xp = p.mastery[c] ?? 0;
              const lvl = masteryLevel(xp);
              const next = MASTERY_LEVELS[lvl] ?? MASTERY_LEVELS[MASTERY_LEVELS.length - 1];
              const prev = MASTERY_LEVELS[lvl - 1] ?? 0;
              const bc = s.byChar[c];
              return (
                <div key={c} class={'panel mastery' + (p.unlockedChars.includes(c) ? '' : ' locked')}>
                  <CharPortrait char={c} size={80} skin={p.equipped.skins[c]} still />
                  <div class="col" style={{ gap: '4px', flex: 1 }}>
                    <b class="display">{CHARACTERS[c].name}</b>
                    <small class="muted">
                      Maestria {lvl}/10 · {bc ? `${bc.w} vitórias em ${bc.m} partidas` : 'ainda não jogado'}
                    </small>
                    <Bar value={lvl >= 10 ? 1 : (xp - prev) / Math.max(1, next - prev)} kind="cool" />
                    <small class="tiny muted">Maestria 10: visual Dourado exclusivo</small>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {tab === 'historico' && <History />}
        {tab === 'conta' && <AccountPanel />}
      </div>
    </div>
  );
}

function History() {
  const [list, setList] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api<{ matches: any[] }>('/api/matches')
      .then((r) => setList(r.matches))
      .catch((e) => setErr(e.message));
  }, []);
  if (err) return <p class="muted">{online.value === 'online' ? err : 'O histórico de partidas online aparece quando você está conectado.'}</p>;
  if (!list) return <div class="spinner" />;
  if (!list.length) return <p class="muted">Nenhuma partida online ainda. Que tal uma Partida Rápida?</p>;
  return (
    <div class="col">
      {list.map((m) => (
        <div key={m.id} class={'panel hist' + (m.won ? ' won' : '')}>
          <b>{m.won ? 'Vitória' : 'Derrota'}</b>
          <span>{MODES[m.mode]?.name ?? m.mode}</span>
          <span class="muted small">{m.map}</span>
          <span class="small">
            {m.kills} elim. · {m.blocks} blocos
          </span>
          {m.mmrDelta ? <span class={'chip ' + (m.mmrDelta > 0 ? 'chip-ok' : 'chip-warn')}>{m.mmrDelta > 0 ? '+' : ''}{m.mmrDelta}</span> : null}
          <span class="tiny muted">{new Date(m.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
      ))}
    </div>
  );
}

function AccountPanel() {
  const acc = account.value;
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [mode, setMode] = useState<'criar' | 'entrar'>('criar');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (user.length < 3 || pass.length < 6) return toast('Usuário com 3+ caracteres e senha com 6+.', 'warn');
    setBusy(true);
    try {
      if (mode === 'criar') {
        await register(user, pass);
        toast('Conta protegida!', 'ok', 'Agora você pode entrar em outros aparelhos.');
      } else {
        const ok = await confirmModal('Entrar em outra conta?', 'O progresso deste aparelho que não estiver vinculado será substituído pelo da conta.', 'Entrar');
        if (!ok) return;
        await login(user, pass);
        toast('Bem-vindo de volta!', 'ok');
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível concluir.', 'error');
    } finally {
      setBusy(false);
    }
  };
  if (online.value !== 'online')
    return (
      <div class="panel col">
        <b>Conta</b>
        <p class="small muted">Seu progresso fica salvo neste aparelho e é sincronizado automaticamente quando houver conexão.</p>
      </div>
    );
  return (
    <div class="col" style={{ maxWidth: '520px' }}>
      {acc.linked ? (
        <div class="panel col">
          <b>Conta vinculada: {acc.username}</b>
          <p class="small muted">Seu progresso está protegido e disponível em qualquer aparelho. Use o mesmo usuário e senha para entrar.</p>
          <Btn
            kind="danger"
            icon={Icon.door({ size: 18 })}
            onClick={async () => {
              if (await confirmModal('Sair da conta?', 'Você poderá entrar de novo com seu usuário e senha.', 'Sair', true)) logout();
            }}
          >
            Sair da conta neste aparelho
          </Btn>
        </div>
      ) : (
        <div class="panel col">
          <b>Proteja seu progresso</b>
          <p class="small muted">Você está jogando como convidado. Crie um usuário e senha para não perder nada e jogar em outros aparelhos.</p>
          <Seg
            value={mode}
            options={[
              { v: 'criar', label: 'Criar acesso' },
              { v: 'entrar', label: 'Já tenho conta' },
            ]}
            onChange={setMode}
          />
          <input class="input" placeholder="Usuário" value={user} maxLength={20} autocomplete="username" onInput={(e) => setUser((e.target as HTMLInputElement).value.trim())} aria-label="Usuário" />
          <input class="input" placeholder="Senha" type="password" value={pass} maxLength={64} autocomplete={mode === 'criar' ? 'new-password' : 'current-password'} onInput={(e) => setPass((e.target as HTMLInputElement).value)} aria-label="Senha" onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <Btn kind="fire" onClick={submit} disabled={busy}>
            {mode === 'criar' ? 'Proteger conta' : 'Entrar'}
          </Btn>
        </div>
      )}
      <p class="tiny muted">Seus dados: guardamos apenas nome de jogador, progresso, estatísticas e (se você criar) usuário com senha criptografada. Nada é compartilhado com terceiros.</p>
    </div>
  );
}
