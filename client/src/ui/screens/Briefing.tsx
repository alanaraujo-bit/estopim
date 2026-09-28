import { useEffect, useState } from 'preact/hooks';
import { BIOMES, CHARACTERS, MISSION_BY_ID, starText, type CharId } from '@estopim/shared';
import { go, profile, resetTo } from '../../state/store';
import { sfx } from '../../audio/sfx';
import { Backdrop } from '../Backdrop';
import { CharPicker } from '../CharPicker';
import { BackBar, Btn, CharPortrait } from '../components';
import { Icon } from '../icons';

const SPEAKER_CHAR: Record<string, CharId> = { Faísca: 'faisca', Tuba: 'tuba', Lume: 'lume', Geada: 'geada', 'Geada (rádio)': 'geada', Pirá: 'pira', 'Pirá (voz distante)': 'pira', Mola: 'mola', Magna: 'magna', Vulto: 'vulto' };

export function Briefing({ params }: { params: { id: string; char?: CharId; direct?: boolean } }) {
  const def = MISSION_BY_ID[params.id];
  const p = profile.value;
  const [char, setChar] = useState<CharId>(params.char ?? p.favoriteChar);
  const [line, setLine] = useState(0);
  const [picker, setPicker] = useState(false);
  const intro = def.intro;
  const done = line >= intro.length;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !done && !picker) {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const advance = () => {
    sfx.click();
    setLine((l) => Math.min(intro.length, l + 1));
  };
  const start = () => {
    sfx.confirm();
    resetTo('game', { kind: 'mission', id: def.id, char });
  };
  const cur = intro[Math.min(line, intro.length - 1)];
  const speakerChar = cur ? SPEAKER_CHAR[cur.who] : undefined;
  return (
    <div class="screen screen-anim briefing" style={{ '--accent': BIOMES[def.map.biome].accent } as any}>
      <Backdrop intensity={0.2} variant="dark" />
      <BackBar title={def.name} kicker={`Missão ${def.id}`} onBack={() => (params.direct ? resetTo('home') : go('campaign', { chapter: def.chapter }))} />
      <div class="brief-body">
        {!done ? (
          <div class="dialog-wrap" onClick={advance} role="button" tabIndex={0} aria-label="Avançar diálogo">
            <div class="dialog-portrait">{speakerChar ? <CharPortrait char={speakerChar} size={180} dir={2} /> : <div class="npc-portrait">{cur.who.startsWith('Vó') ? '👵' : cur.who.startsWith('O Arconte') ? '◐' : '?'}</div>}</div>
            <div class="panel dialog-box" key={line}>
              <span class="speaker">{cur.who}</span>
              <p class="dialog-text">{cur.text}</p>
              <div class="row between">
                <span class="tiny muted">
                  {line + 1}/{intro.length}
                </span>
                <span class="row" style={{ gap: '8px' }}>
                  <Btn kind="ghost" size="sm" onClick={(e) => (e.stopPropagation(), setLine(intro.length))}>
                    Pular
                  </Btn>
                  <Btn kind="fire" size="sm" icon={Icon.next({ size: 16 })} onClick={(e) => (e.stopPropagation(), advance())}>
                    Continuar
                  </Btn>
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div class="brief-ready">
            <div class="panel col">
              <span class="kicker">Objetivo</span>
              <h2 class="h2">{def.summary}</h2>
              <p class="small muted">{def.briefing}</p>
              <ul class="star-list">
                <li>Concluir a missão</li>
                {def.stars.map((s, i) => (
                  <li key={i}>{starText(s)}</li>
                ))}
              </ul>
              <div class="row wrap" style={{ gap: '8px' }}>
                <span class="chip">
                  {Icon.heart({ size: 14 })} {def.hp} de vida
                </span>
                {def.timeLimit && (
                  <span class="chip chip-warn">
                    {Icon.clock({ size: 14 })} {def.timeLimit}s
                  </span>
                )}
                {def.budget && <span class="chip chip-cool">Máx. {def.budget} cargas</span>}
              </div>
            </div>
            <div class="panel col center">
              <CharPortrait char={char} size={170} pedestal skin={p.equipped.skins[char]} />
              <b class="display" style={{ fontSize: '1.5rem' }}>
                {CHARACTERS[char].name}
              </b>
              <Btn kind="ghost" size="sm" icon={Icon.refresh({ size: 16 })} onClick={() => setPicker(true)}>
                Trocar personagem
              </Btn>
              <Btn kind="fire" size="xl" shine icon={Icon.play({ size: 26 })} onClick={start} autofocus>
                Começar
              </Btn>
              <Btn kind="ghost" size="sm" onClick={() => setLine(0)}>
                Rever diálogo
              </Btn>
            </div>
          </div>
        )}
      </div>
      {picker && (
        <CharPicker
          value={char}
          onClose={() => setPicker(false)}
          onPick={(c) => {
            setChar(c);
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}
