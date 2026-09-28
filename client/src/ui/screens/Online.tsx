import { useEffect, useState } from 'preact/hooks';
import { rankOf } from '@estopim/shared';
import { go, online, profile, toast } from '../../state/store';
import { onMsg, onlineCount, send } from '../../net/client';
import { sfx } from '../../audio/sfx';
import { Backdrop } from '../Backdrop';
import { BackBar, Btn } from '../components';
import { Icon } from '../icons';

export function Online() {
  const p = profile.value;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const isOn = online.value === 'online';
  useEffect(
    () =>
      onMsg((m) => {
        if (m.t === 'room' && m.room) {
          setBusy(false);
          go('lobby', {});
        }
        if (m.t === 'error') {
          setBusy(false);
          sfx.error();
          toast(m.msg, 'error');
        }
      }),
    [],
  );
  const create = () => {
    setBusy(true);
    if (!send({ t: 'room.create', char: p.favoriteChar })) {
      setBusy(false);
      toast('Sem conexão com o servidor.', 'error');
    }
  };
  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4) return toast('Digite o código da sala (5 letras).', 'warn');
    setBusy(true);
    if (!send({ t: 'room.join', code: c, char: p.favoriteChar })) {
      setBusy(false);
      toast('Sem conexão com o servidor.', 'error');
    }
  };
  const rank = rankOf(p.ranked.mmr);
  return (
    <div class="screen screen-anim">
      <Backdrop intensity={0.3} variant="dark" />
      <BackBar
        title="Online"
        kicker="Multijogador"
        right={
          <span class={'chip ' + (isOn ? 'chip-ok' : 'chip-warn')}>
            {isOn ? Icon.wifi({ size: 16 }) : Icon.wifiOff({ size: 16 })}
            {isOn ? `${onlineCount.value} online agora` : online.value === 'connecting' ? 'Conectando…' : 'Offline'}
          </span>
        }
      />
      {!isOn ? (
        <div class="center col grow" style={{ position: 'relative' }}>
          <div class="panel col center" style={{ maxWidth: '440px', textAlign: 'center' }}>
            {Icon.wifiOff({ size: 48 })}
            <h2 class="h2">Sem conexão com a arena</h2>
            <p class="muted small">Estamos tentando reconectar automaticamente. Enquanto isso, a campanha e as partidas locais continuam disponíveis.</p>
            <Btn kind="ghost" onClick={() => go('setup', {})}>
              Jogar offline
            </Btn>
          </div>
        </div>
      ) : (
        <div class="online-grid scroll">
          <button class="card play-card" onClick={() => go('queue', { kind: 'casual' })}>
            <div class="pc-art">{Icon.bolt({ size: 48 })}</div>
            <div class="pc-body">
              <span class="kicker">Casual</span>
              <b class="display">Partida Rápida</b>
              <p>Arena de até 4 jogadores. Se faltar gente, bots completam depois de um tempo.</p>
            </div>
          </button>
          <button class={'card play-card' + (p.level < 5 ? ' locked' : '')} onClick={() => (p.level < 5 ? toast('Ranqueada libera no nível 5', 'info') : go('queue', { kind: 'ranked' }))}>
            <div class="pc-art" style={{ color: rank.color }}>
              {Icon.trophy({ size: 48 })}
            </div>
            <div class="pc-body">
              <span class="kicker">Competitivo</span>
              <b class="display">Ranqueada 1×1</b>
              <p>Melhor de 5 rodadas, só humanos, pontuação por habilidade.</p>
              <span class="chip" style={{ color: rank.color }}>
                {rank.label} · {p.ranked.mmr}
              </span>
            </div>
          </button>
          <div class="panel col">
            <span class="kicker">Sala privada</span>
            <h2 class="h2">Jogue com seus amigos</h2>
            <p class="small muted">Crie uma sala, escolha modo e mapa, e compartilhe o código.</p>
            <Btn kind="fire" size="lg" icon={Icon.plus({ size: 20 })} onClick={create} disabled={busy}>
              Criar sala
            </Btn>
            <div class="divider" />
            <label class="field">
              <span>Entrar com código</span>
              <div class="row">
                <input
                  class="input code-input"
                  value={code}
                  maxLength={5}
                  placeholder="ABCDE"
                  onInput={(e) => setCode((e.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && join()}
                  aria-label="Código da sala"
                />
                <Btn kind="cool" onClick={join} disabled={busy}>
                  Entrar
                </Btn>
              </div>
            </label>
          </div>
          <button class="card play-card" onClick={() => go('friends')}>
            <div class="pc-art">{Icon.users({ size: 48 })}</div>
            <div class="pc-body">
              <span class="kicker">Social</span>
              <b class="display">Amigos</b>
              <p>Adicione amigos pelo código e convide para sua sala.</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
