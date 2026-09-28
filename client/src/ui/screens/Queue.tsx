import { useEffect, useState } from 'preact/hooks';
import { CHARACTERS, rankOf } from '@estopim/shared';
import { onMsg, queueStatus, send } from '../../net/client';
import { profile, resetTo, toast } from '../../state/store';
import { sfx } from '../../audio/sfx';
import { Backdrop } from '../Backdrop';
import { CharPicker } from '../CharPicker';
import { Btn, CharPortrait } from '../components';
import { Icon } from '../icons';

const HINTS = [
  'Dica: flanquear é melhor que perseguir. Preveja onde o adversário vai estar.',
  'Dica: ao cair, suas Brasas se espalham pela arena. Proteja-se quando estiver forte.',
  'Dica: reações em cadeia atravessam o mapa mais rápido do que qualquer corrida.',
  'Dica: a técnica do seu personagem recarrega sozinha. Use sem medo.',
  'Dica: no Colapso, fique perto do centro — as bordas caem primeiro.',
  'Dica: o anel ao redor da carga mostra quanto falta para explodir.',
];

export function Queue({ params }: { params: { kind: 'casual' | 'ranked' } }) {
  const p = profile.value;
  const [char, setChar] = useState(p.favoriteChar);
  const [picker, setPicker] = useState(false);
  const [t0] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [hint] = useState(HINTS[(Math.random() * HINTS.length) | 0]);
  const st = queueStatus.value;
  useEffect(() => {
    const ok = send({ t: 'queue', kind: params.kind, char });
    if (!ok) {
      toast('Sem conexão com o servidor.', 'error');
      resetTo('online');
    }
    const iv = setInterval(() => setNow(Date.now()), 500);
    const off = onMsg((m) => {
      if (m.t === 'error') {
        sfx.error();
        toast(m.msg, 'error');
        resetTo('online');
      }
    });
    return () => {
      clearInterval(iv);
      off();
    };
  }, []);
  const secs = Math.floor((now - t0) / 1000);
  const cancel = () => {
    send({ t: 'unqueue' });
    sfx.back();
    resetTo('online');
  };
  const rank = rankOf(p.ranked.mmr);
  return (
    <div class="screen screen-anim queue">
      <Backdrop intensity={0.8} />
      <div class="queue-center">
        <span class="kicker">{params.kind === 'ranked' ? `Ranqueada · ${rank.label}` : 'Partida rápida'}</span>
        <h1 class="h1">Procurando adversários</h1>
        <div class="fuse-timer">
          <div class="fuse-spark" />
          <span class="display">
            {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
          </span>
        </div>
        <p class="muted small">{st ? `${st.inQueue} jogador(es) na fila` : 'Conectando à fila…'}</p>
        {params.kind === 'casual' && secs > 12 && <p class="small">Se ninguém aparecer em breve, completaremos a partida com bots.</p>}
        {params.kind === 'ranked' && secs > 45 && <p class="small">A ranqueada só junta humanos com nível parecido. Pode demorar um pouco.</p>}
        <div class="row" style={{ gap: '14px', alignItems: 'center' }}>
          <CharPortrait char={char} size={140} pedestal skin={p.equipped.skins[char]} />
          <div class="col" style={{ gap: '6px' }}>
            <b class="display" style={{ fontSize: '1.4rem' }}>
              {CHARACTERS[char].name}
            </b>
            <Btn
              kind="ghost"
              size="sm"
              icon={Icon.refresh({ size: 16 })}
              onClick={() => {
                setPicker(true);
              }}
            >
              Trocar
            </Btn>
          </div>
        </div>
        <Btn kind="danger" icon={Icon.close({ size: 18 })} onClick={cancel}>
          Cancelar
        </Btn>
        <p class="tiny muted" style={{ maxWidth: '420px', textAlign: 'center' }}>
          {hint}
        </p>
      </div>
      {picker && (
        <CharPicker
          value={char}
          onClose={() => setPicker(false)}
          onPick={(c) => {
            setChar(c);
            setPicker(false);
            send({ t: 'unqueue' });
            send({ t: 'queue', kind: params.kind, char: c });
          }}
        />
      )}
    </div>
  );
}
