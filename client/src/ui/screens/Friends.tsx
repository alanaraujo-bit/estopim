import { useEffect, useState } from 'preact/hooks';
import type { CharId } from '@estopim/shared';
import { ApiError, api, currentRoom, invites, presence, send } from '../../net/client';
import { confirmModal, go, online, profile, toast } from '../../state/store';
import { sfx } from '../../audio/sfx';
import { Backdrop } from '../Backdrop';
import { BackBar, Btn, CharPortrait } from '../components';
import { Icon } from '../icons';

interface Friend {
  id: string;
  name: string;
  tag: string;
  level: number;
  char: CharId;
  status: 'online' | 'offline' | 'playing';
}
interface Req {
  id: string;
  name: string;
  tag: string;
}

export function Friends() {
  const p = profile.value;
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [recent, setRecent] = useState<Req[]>([]);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const load = () =>
    api<{ friends: Friend[]; requests: Req[]; recent: Req[] }>('/api/friends')
      .then((r) => {
        setFriends(r.friends);
        setReqs(r.requests);
        setRecent(r.recent ?? []);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [online.value]);
  const add = async (tagStr?: string) => {
    const t = (tagStr ?? code).trim();
    if (!/^.{3,16}#\d{4}$/.test(t)) return toast('Use o formato Nome#1234', 'warn');
    try {
      await api('/api/friends/request', { tag: t });
      sfx.confirm();
      toast('Pedido enviado!', 'ok');
      setCode('');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Erro ao enviar pedido.', 'error');
    }
  };
  const respond = async (id: string, accept: boolean) => {
    try {
      await api('/api/friends/respond', { id, accept });
      load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Erro.', 'error');
    }
  };
  const remove = async (f: Friend) => {
    if (!(await confirmModal(`Remover ${f.name}?`, 'Vocês deixarão de ser amigos.', 'Remover', true))) return;
    await api('/api/friends/' + f.id, undefined, 'DELETE').catch(() => {});
    load();
  };
  const invite = (f: Friend) => {
    if (!currentRoom.value) {
      toast('Crie uma sala primeiro', 'info', 'Depois convide seus amigos por aqui.');
      go('online');
      return;
    }
    send({ t: 'invite', to: f.id });
    toast(`Convite enviado para ${f.name}`, 'ok');
  };
  const pending = invites.value.filter((i) => Date.now() - i.at < 5 * 60e3);
  if (online.value !== 'online')
    return (
      <div class="screen screen-anim">
        <Backdrop intensity={0.2} variant="dark" />
        <BackBar title="Amigos" />
        <div class="center col grow" style={{ position: 'relative' }}>
          <div class="panel col center" style={{ maxWidth: 420, textAlign: 'center' }}>
            {Icon.wifiOff({ size: 42 })}
            <p class="muted">A lista de amigos precisa de conexão. Estamos tentando reconectar.</p>
          </div>
        </div>
      </div>
    );
  return (
    <div class="screen screen-anim">
      <Backdrop intensity={0.25} variant="dark" />
      <BackBar title="Amigos" kicker={`Seu código: ${p.name}#${p.tag}`} />
      <div class="friends scroll">
        <section class="panel col">
          <span class="kicker">Adicionar amigo</span>
          <div class="row">
            <input class="input" placeholder="Nome#1234" value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Código do amigo" />
            <Btn kind="fire" icon={Icon.plus({ size: 18 })} onClick={() => add()}>
              Adicionar
            </Btn>
          </div>
          <Btn
            kind="ghost"
            size="sm"
            icon={Icon.copy({ size: 16 })}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${p.name}#${p.tag}`);
                toast('Código copiado!', 'ok');
              } catch {
                toast(`${p.name}#${p.tag}`, 'info');
              }
            }}
          >
            Copiar meu código
          </Btn>
        </section>
        {pending.length > 0 && (
          <section class="panel col">
            <span class="kicker">Convites para salas</span>
            {pending.map((i) => (
              <div key={i.code} class="friend">
                <b>{i.from.name}</b>
                <span class="muted small">Sala {i.code}</span>
                <Btn kind="fire" size="sm" onClick={() => (send({ t: 'room.join', code: i.code, char: p.favoriteChar }), go('lobby', {}))}>
                  Entrar
                </Btn>
              </div>
            ))}
          </section>
        )}
        {reqs.length > 0 && (
          <section class="panel col">
            <span class="kicker">Pedidos de amizade</span>
            {reqs.map((r) => (
              <div key={r.id} class="friend">
                <b>
                  {r.name}
                  <small class="muted">#{r.tag}</small>
                </b>
                <span class="row" style={{ gap: '6px' }}>
                  <Btn kind="green" size="sm" icon={Icon.check({ size: 14 })} onClick={() => respond(r.id, true)}>
                    Aceitar
                  </Btn>
                  <Btn kind="ghost" size="sm" icon={Icon.close({ size: 14 })} onClick={() => respond(r.id, false)} title="Recusar" />
                </span>
              </div>
            ))}
          </section>
        )}
        <section class="panel col">
          <span class="kicker">Amigos {friends ? `(${friends.length})` : ''}</span>
          {err && <p class="muted">{err}</p>}
          {!friends && !err && <div class="spinner" />}
          {friends && !friends.length && <p class="muted small">Você ainda não adicionou ninguém. Compartilhe seu código!</p>}
          {friends
            ?.slice()
            .sort((a, b) => (presence.value[b.id] === 'online' ? 1 : 0) - (presence.value[a.id] === 'online' ? 1 : 0))
            .map((f) => {
              const st = presence.value[f.id] ?? f.status;
              return (
                <div key={f.id} class="friend">
                  <span class={'dot ' + st} />
                  <CharPortrait char={f.char} size={40} still />
                  <b>
                    {f.name}
                    <small class="muted">#{f.tag}</small>
                  </b>
                  <span class="muted small">{st === 'online' ? 'Online' : st === 'playing' ? 'Em partida' : 'Offline'} · Nv. {f.level}</span>
                  <span class="row" style={{ gap: '6px', marginLeft: 'auto' }}>
                    {st === 'online' && (
                      <Btn kind="cool" size="sm" icon={Icon.send({ size: 14 })} onClick={() => invite(f)}>
                        Convidar
                      </Btn>
                    )}
                    <Btn kind="ghost" size="sm" title="Remover" icon={Icon.close({ size: 14 })} onClick={() => remove(f)} />
                  </span>
                </div>
              );
            })}
        </section>
        {recent.length > 0 && (
          <section class="panel col">
            <span class="kicker">Jogaram com você recentemente</span>
            {recent.map((r) => (
              <div key={r.id} class="friend">
                <b>
                  {r.name}
                  <small class="muted">#{r.tag}</small>
                </b>
                <Btn kind="ghost" size="sm" icon={Icon.plus({ size: 14 })} onClick={() => add(`${r.name}#${r.tag}`)}>
                  Adicionar
                </Btn>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
