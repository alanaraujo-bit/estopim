import { useState } from 'preact/hooks';
import { CHARACTERS, isNameAllowed, sanitizeName, type CharId } from '@estopim/shared';
import { doOp } from '../../net/client';
import { go, profile, resetTo } from '../../state/store';
import { sfx } from '../../audio/sfx';
import { Backdrop } from '../Backdrop';
import { CharInfo } from '../CharPicker';
import { Btn, CharPortrait } from '../components';
import { Icon } from '../icons';
import { Logo } from '../Logo';

const SUGGESTIONS = ['Pavio', 'Rojãozinho', 'Estalinho', 'Busca-Pé', 'Chuvinha', 'Traque', 'Estrelinha', 'Bombinha', 'Vulcão', 'Cometa'];

export function Onboarding() {
  const p = profile.value;
  const [step, setStep] = useState(p.name ? 1 : 0);
  const [name, setName] = useState(p.name || '');
  const [err, setErr] = useState('');
  const [char, setChar] = useState<CharId>(p.favoriteChar);

  const confirmName = () => {
    const n = sanitizeName(name);
    if (!isNameAllowed(n)) {
      setErr('Use de 3 a 16 caracteres, sem palavras ofensivas.');
      sfx.error();
      return;
    }
    doOp({ k: 'name', name: n });
    sfx.confirm();
    setStep(1);
  };

  return (
    <div class="screen onboarding screen-anim">
      <Backdrop intensity={0.5} />
      <div class="onb-wrap">
        {step === 0 && (
          <div class="panel onb-card col">
            <Logo size={0.5} sub={false} />
            <span class="kicker">Bem-vindo ao Circuito Estopim</span>
            <h1 class="h2">Como a Vila deve te chamar?</h1>
            <input
              class="input"
              value={name}
              maxLength={16}
              placeholder="Seu nome de fogueteiro"
              autofocus
              onInput={(e) => {
                setName((e.target as HTMLInputElement).value);
                setErr('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && confirmName()}
              aria-label="Nome do jogador"
            />
            <div class="row wrap" style={{ gap: '6px' }}>
              {SUGGESTIONS.slice(0, 6).map((s) => (
                <button key={s} class="chip" style={{ cursor: 'pointer' }} onClick={() => setName(s + (Math.random() * 90 + 10 | 0))}>
                  {s}
                </button>
              ))}
            </div>
            {err && <span class="chip chip-warn">{err}</span>}
            <Btn kind="fire" size="lg" icon={Icon.next({ size: 20 })} onClick={confirmName}>
              Continuar
            </Btn>
          </div>
        )}
        {step === 1 && (
          <div class="panel onb-card wide col">
            <span class="kicker">Passo 2 de 2</span>
            <h1 class="h2">Escolha quem vai acender o primeiro pavio</h1>
            <p class="muted small">Mais personagens se juntam a você na campanha e conforme você sobe de nível.</p>
            <div class="onb-chars">
              {(['faisca', 'tuba', 'lume'] as CharId[]).map((c) => (
                <button key={c} class={'card onb-char' + (char === c ? ' selected' : '')} onClick={() => (sfx.click(), setChar(c))}>
                  <CharPortrait char={c} size={120} pedestal still={char !== c} emote={char === c ? 'cheer' : null} />
                  <b class="display">{CHARACTERS[c].name}</b>
                  <small>{CHARACTERS[c].role}</small>
                </button>
              ))}
            </div>
            <div class="onb-info">
              <CharInfo c={char} />
            </div>
            <div class="row wrap" style={{ justifyContent: 'flex-end' }}>
              <Btn
                kind="ghost"
                onClick={() => {
                  doOp({ k: 'fav', char });
                  doOp({ k: 'tutorial' });
                  resetTo('home');
                }}
              >
                Pular tutorial
              </Btn>
              <Btn
                kind="fire"
                size="lg"
                shine
                icon={Icon.play({ size: 20 })}
                onClick={() => {
                  doOp({ k: 'fav', char });
                  doOp({ k: 'tutorial' });
                  resetTo('home');
                  go('briefing', { id: '1-1', char, direct: true });
                }}
              >
                Começar a aventura
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
