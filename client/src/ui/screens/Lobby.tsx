import { useEffect, useState } from 'preact/hooks';
import { CHARACTERS, MAPS, MODES, MODE_ORDER, QUICK_CHAT, type CharId, type RoomConfig } from '@estopim/shared';
import { currentRoom, onMsg, send } from '../../net/client';
import { back, profile, resetTo, toast } from '../../state/store';
import { sfx } from '../../audio/sfx';
import { Backdrop } from '../Backdrop';
import { CharPicker } from '../CharPicker';
import { BackBar, Btn, CharPortrait, Seg, Toggle } from '../components';
import { Icon } from '../icons';
import { MapThumb, ModeIcon } from '../ModeIcon';
import { TEAM_COLORS } from '../../game/renderer';

export function Lobby() {
  const p = profile.value;
  const room = currentRoom.value;
  const [picker, setPicker] = useState(false);
  const [chat, setChat] = useState<{ name: string; text: string; at: number }[]>([]);
  useEffect(
    () =>
      onMsg((m) => {
        if (m.t === 'chat') setChat((c) => [...c.slice(-5), { name: m.name, text: QUICK_CHAT[m.phrase] ?? '', at: Date.now() }]);
        if (m.t === 'error') {
          sfx.error();
          toast(m.msg, 'error');
        }
        if (m.t === 'room' && !m.room) resetTo('online');
      }),
    [],
  );
  if (!room) {
    return (
      <div class="screen screen-anim">
        <Backdrop intensity={0.2} variant="dark" />
        <BackBar title="Sala" onBack={() => resetTo('online')} />
        <div class="center col grow">
          <div class="spinner" />
          <p class="muted">Entrando na sala…</p>
        </div>
      </div>
    );
  }
  const meM = room.members.find((m) => m.id === p.id || (!m.bot && m.name === p.name));
  const isHost = !!meM?.host;
  const cfg = room.cfg;
  const mode = MODES[cfg.mode];
  const setCfg = (patch: Partial<RoomConfig>) => send({ t: 'room.cfg', cfg: patch });
  const humans = room.members.filter((m) => !m.bot);
  const allReady = humans.every((m) => m.ready || m.host);
  const shareLink = `${location.origin}/?sala=${room.code}`;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'ESTOPIM', text: `Bora jogar ESTOPIM! Sala ${room.code}`, url: shareLink });
      else {
        await navigator.clipboard.writeText(shareLink);
        toast('Link copiado!', 'ok');
      }
    } catch {
      /* cancelado */
    }
  };
  const maps = mode.maps === 'all' ? MAPS : MAPS.filter((m) => (mode.maps as string[]).includes(m.id));
  return (
    <div class="screen screen-anim">
      <Backdrop intensity={0.3} variant="dark" />
      <BackBar
        title={room.kind === 'private' ? 'Sala privada' : room.kind === 'ranked' ? 'Ranqueada' : 'Partida rápida'}
        kicker={room.state === 'results' ? 'Aguardando revanche' : 'Lobby'}
        onBack={() => {
          send({ t: 'room.leave' });
          resetTo('online');
        }}
        right={
          room.kind === 'private' ? (
            <div class="row" style={{ gap: '8px' }}>
              <button
                class="room-code"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(room.code);
                    toast('Código copiado!', 'ok');
                  } catch {
                    toast(`Código: ${room.code}`, 'info');
                  }
                }}
                title="Copiar código"
              >
                <small>CÓDIGO</small>
                <b>{room.code}</b>
              </button>
              <Btn kind="cool" icon={Icon.share({ size: 18 })} onClick={share} title="Convidar">
                Convidar
              </Btn>
            </div>
          ) : undefined
        }
      />
      <div class="lobby scroll">
        <section class="panel col">
          <span class="kicker">
            Jogadores ({room.members.length}/{cfg.maxPlayers})
          </span>
          <div class="lobby-members">
            {Array.from({ length: cfg.maxPlayers }, (_, i) => {
              const m = room.members[i];
              if (!m)
                return (
                  <div key={i} class="member empty">
                    <span class="muted">Aguardando jogador…</span>
                    {isHost && room.kind === 'private' && (
                      <Btn kind="ghost" size="sm" icon={Icon.robot({ size: 16 })} onClick={() => setCfg({ bots: cfg.bots + 1 })}>
                        Bot
                      </Btn>
                    )}
                  </div>
                );
              const mine = m === meM;
              return (
                <div key={m.id} class={'member' + (m.ready || m.host ? ' ready' : '') + (mine ? ' me' : '')} style={{ '--tc': TEAM_COLORS[m.team % 4] } as any}>
                  <CharPortrait char={m.char} size={64} skin={m.cosmetics?.skin} still />
                  <div class="col" style={{ gap: '2px', minWidth: 0, flex: 1 }}>
                    <b class="nm">
                      {m.name} {m.host && <span class="tag">ANFITRIÃO</span>} {m.bot ? <span class="tag" style={{ background: '#6a5a8a', color: '#fff' }}>BOT</span> : null}
                    </b>
                    <small class="muted">
                      {CHARACTERS[m.char].name} · Nível {m.level}
                      {!m.online && !m.bot ? ' · reconectando…' : ''}
                    </small>
                  </div>
                  {mode.teams && (
                    <button class="team-pill" style={{ background: TEAM_COLORS[m.team % 4] }} disabled={!mine && !isHost} onClick={() => mine && send({ t: 'room.team', team: m.team === 0 ? 1 : 0 })}>
                      {m.team === 0 ? 'Brasa' : 'Anil'}
                    </button>
                  )}
                  <span class={'ready-mark' + (m.ready || m.host || m.bot ? ' on' : '')}>{m.ready || m.host || m.bot ? Icon.check({ size: 18 }) : '…'}</span>
                  {isHost && !mine && room.kind === 'private' && <Btn kind="ghost" size="sm" title="Remover" icon={Icon.close({ size: 14 })} onClick={() => (m.bot ? setCfg({ bots: Math.max(0, cfg.bots - 1) }) : send({ t: 'room.kick', id: m.id }))} />}
                </div>
              );
            })}
          </div>
          <div class="row wrap" style={{ gap: '8px' }}>
            <Btn kind="ghost" icon={Icon.user({ size: 18 })} onClick={() => setPicker(true)}>
              Personagem
            </Btn>
            {!isHost && (
              <Btn kind={meM?.ready ? 'green' : 'fire'} icon={Icon.check({ size: 18 })} onClick={() => send({ t: 'room.ready', ready: !meM?.ready })}>
                {meM?.ready ? 'Pronto!' : 'Estou pronto'}
              </Btn>
            )}
            {isHost && (
              <Btn kind="fire" size="lg" shine icon={Icon.play({ size: 20 })} disabled={!allReady || room.members.length < mode.minPlayers} onClick={() => send({ t: 'room.start' })}>
                {room.members.length < mode.minPlayers ? `Mínimo ${mode.minPlayers} jogadores` : allReady ? 'Começar partida' : 'Aguardando prontos'}
              </Btn>
            )}
          </div>
          <div class="quick-chat">
            {QUICK_CHAT.slice(0, 6).map((q, i) => (
              <button key={i} class="chip" onClick={() => send({ t: 'room.chat', phrase: i })}>
                {q}
              </button>
            ))}
          </div>
          {chat.length > 0 && (
            <div class="chat-log">
              {chat.map((c, i) => (
                <div key={i}>
                  <b>{c.name}:</b> {c.text}
                </div>
              ))}
            </div>
          )}
        </section>
        <section class="panel col">
          <span class="kicker">Configuração {isHost ? '' : '(definida pelo anfitrião)'}</span>
          <div class="mode-row">
            {MODE_ORDER.map((m) => (
              <button key={m} class={'card mode-chip' + (cfg.mode === m ? ' selected' : '')} disabled={!isHost || room.kind !== 'private'} onClick={() => setCfg({ mode: m as any, roundsToWin: MODES[m].roundsToWin })}>
                <ModeIcon id={m} size={22} />
                <b>{MODES[m].name}</b>
              </button>
            ))}
          </div>
          <p class="small muted">{mode.desc}</p>
          <div class="map-row small-maps">
            <button class={'card map-card' + (cfg.map === 'aleatorio' ? ' selected' : '')} disabled={!isHost || room.kind !== 'private'} onClick={() => setCfg({ map: 'aleatorio' })}>
              <MapThumb size={90} />
              <b>Aleatória</b>
            </button>
            {maps.map((m) => (
              <button key={m.id} class={'card map-card' + (cfg.map === m.id ? ' selected' : '')} disabled={!isHost || room.kind !== 'private'} onClick={() => setCfg({ map: m.id })}>
                <MapThumb id={m.id} size={90} />
                <b>{m.name}</b>
              </button>
            ))}
          </div>
          {isHost && room.kind === 'private' && (
            <div class="rules-grid">
              {mode.roundsToWin > 1 && (
                <label class="field">
                  <span>Rodadas para vencer</span>
                  <Seg value={cfg.roundsToWin} options={[1, 2, 3, 4, 5].map((v) => ({ v, label: String(v) }))} onChange={(v) => setCfg({ roundsToWin: v })} />
                </label>
              )}
              <label class="field">
                <span>Brasas</span>
                <Seg value={cfg.items} options={[{ v: 0, label: 'Nenhuma' }, { v: 1, label: 'Normal' }, { v: 2, label: 'Caótico' }]} onChange={(v) => setCfg({ items: v as any })} />
              </label>
              <label class="field">
                <span>Dificuldade dos bots</span>
                <Seg value={cfg.botLevel} options={[{ v: 1, label: 'Fácil' }, { v: 2, label: 'Normal' }, { v: 3, label: 'Difícil' }]} onChange={(v) => setCfg({ botLevel: v as any })} />
              </label>
              <div class="row between">
                <span>Técnicas</span>
                <Toggle value={cfg.abilities} onChange={(v) => setCfg({ abilities: v })} />
              </div>
              <div class="row between">
                <span>Cartuchos</span>
                <Toggle value={cfg.cartridges} onChange={(v) => setCfg({ cartridges: v })} />
              </div>
              <div class="row between">
                <span>Brasas corrompidas</span>
                <Toggle value={cfg.curses} onChange={(v) => setCfg({ curses: v })} />
              </div>
            </div>
          )}
        </section>
      </div>
      {picker && (
        <CharPicker
          value={meM?.char ?? p.favoriteChar}
          onClose={() => setPicker(false)}
          onPick={(c: CharId) => {
            send({ t: 'room.char', char: c });
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}

export { back };
