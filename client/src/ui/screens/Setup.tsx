import { useState } from 'preact/hooks';
import { CHARACTERS, CHAR_ORDER, MAPS, MAP_BY_ID, MODES, MODE_ORDER, type CharId, type ModeId } from '@estopim/shared';
import type { Source } from '../../game/input';
import { go, profile, toast } from '../../state/store';
import { Backdrop } from '../Backdrop';
import { CharPicker, isUnlocked } from '../CharPicker';
import { BackBar, Btn, CharPortrait, Seg, Toggle } from '../components';
import { Icon } from '../icons';
import { MapThumb, ModeIcon } from '../ModeIcon';
import type { MatchConfig } from '../../game/match';

interface Slot {
  kind: 'human' | 'bot' | 'off';
  char: CharId;
  team: number;
  bot: 1 | 2 | 3;
  src: string; // 'any' | 'kb-left' | 'kb-right' | 'pad-0'... | 'touch'
}

const SRC_LABEL: Record<string, string> = { any: 'Qualquer', 'kb-left': 'Teclado (WASD)', 'kb-right': 'Teclado (setas)', touch: 'Toque', 'pad-0': 'Controle 1', 'pad-1': 'Controle 2', 'pad-2': 'Controle 3', 'pad-3': 'Controle 4' };
const BOT_NAMES = ['Estalinho', 'Busca-Pé', 'Traque', 'Chuvinha', 'Rojão', 'Cometa', 'Buscapé', 'Vulcão'];
const toSource = (s: string): Source => (s === 'any' ? { type: 'any' } : s === 'touch' ? { type: 'touch' } : s.startsWith('kb') ? { type: 'keyboard', scheme: s === 'kb-left' ? 'left' : 'right' } : { type: 'gamepad', index: +s.split('-')[1] });

export function Setup({ params }: { params: { mode?: ModeId } }) {
  const p = profile.value;
  const [mode, setMode] = useState<ModeId>(params?.mode ?? 'classico');
  const def = MODES[mode];
  const [map, setMap] = useState('aleatorio');
  const [rounds, setRounds] = useState(def.roundsToWin);
  const [items, setItems] = useState<0 | 1 | 2>(1);
  const [abilities, setAbilities] = useState(true);
  const [carts, setCarts] = useState(true);
  const [curses, setCurses] = useState(true);
  const [ff, setFf] = useState(true);
  const [picker, setPicker] = useState<number | null>(null);
  const rndChars = CHAR_ORDER.filter((c) => c !== p.favoriteChar);
  const [slots, setSlots] = useState<Slot[]>([
    { kind: 'human', char: p.favoriteChar, team: 0, bot: 2, src: 'any' },
    { kind: 'bot', char: rndChars[0], team: 1, bot: 2, src: 'kb-right' },
    { kind: 'bot', char: rndChars[1], team: 2, bot: 2, src: 'pad-0' },
    { kind: 'bot', char: rndChars[2], team: 3, bot: 2, src: 'pad-1' },
  ]);

  const maps = def.maps === 'all' ? MAPS : MAPS.filter((m) => (def.maps as string[]).includes(m.id));
  const changeMode = (m: ModeId) => {
    setMode(m);
    setRounds(MODES[m].roundsToWin);
    const mm = MODES[m];
    if (mm.maps !== 'all' && map !== 'aleatorio' && !mm.maps.includes(map)) setMap('aleatorio');
    setSlots((ss) => ss.map((s, i) => ({ ...s, team: mm.teams ? (i < 2 ? 0 : 1) : mm.coop ? 0 : i })));
  };
  const upd = (i: number, patch: Partial<Slot>) => setSlots((ss) => ss.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const active = slots.filter((s) => s.kind !== 'off');
  const humans = slots.filter((s) => s.kind === 'human');

  const start = () => {
    if (!humans.length) return toast('Adicione pelo menos um jogador humano.', 'warn');
    if (active.length < def.minPlayers) return toast(`${def.name} precisa de pelo menos ${def.minPlayers} participantes.`, 'warn');
    if (def.teams && new Set(active.map((s) => s.team)).size < 2) return toast('Monte duas equipes diferentes.', 'warn');
    const srcs = humans.map((h) => (humans.length === 1 ? 'any' : h.src));
    if (new Set(srcs).size < srcs.length) return toast('Dois jogadores estão usando o mesmo controle.', 'warn');
    for (const h of humans) if (!isUnlocked(h.char)) return toast(`${CHARACTERS[h.char].name} ainda está bloqueado.`, 'warn');
    let botN = 0;
    let humanN = 0;
    const players = active.map((s) => ({
      name: s.kind === 'bot' ? BOT_NAMES[botN++ % BOT_NAMES.length] : humanN++ === 0 ? p.name || 'Jogador 1' : `Jogador ${humanN}`,
      char: s.char,
      team: def.coop ? 0 : def.teams ? s.team : active.indexOf(s),
      bot: s.kind === 'bot' ? s.bot : (0 as const),
      cosmetics: s.kind === 'human' && humanN === 1 ? { skin: p.equipped.skins[s.char] ?? 'base', bomb: p.equipped.bomb, trail: p.equipped.trail } : undefined,
    }));
    const local = active.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === 'human').map(({ s, i }) => ({ id: i, source: toSource(humans.length === 1 ? 'any' : s.src) }));
    const cfg: MatchConfig = {
      mode,
      mapId: map,
      randomMap: map === 'aleatorio',
      players,
      roundsToWin: rounds,
      rules: { items, abilities, cartridges: carts, curses, friendlyFire: ff },
      local,
    };
    go('game', { kind: 'local', cfg });
  };

  return (
    <div class="screen screen-anim">
      <Backdrop intensity={0.3} variant="dark" />
      <BackBar
        title="Local e Bots"
        kicker="Partida personalizada"
        right={
          <Btn kind="fire" size="lg" shine icon={Icon.play({ size: 20 })} onClick={start}>
            Começar
          </Btn>
        }
      />
      <div class="setup scroll">
        <section class="panel col">
          <span class="kicker">Modo</span>
          <div class="mode-row">
            {MODE_ORDER.map((m) => (
              <button key={m} class={'card mode-chip' + (mode === m ? ' selected' : '')} onClick={() => changeMode(m as ModeId)}>
                <ModeIcon id={m} size={26} />
                <b>{MODES[m].name}</b>
              </button>
            ))}
          </div>
          <p class="small">
            <b>{def.tagline}</b> <span class="muted">{def.desc}</span>
          </p>
          <ul class="rules-list">
            {def.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>

        <section class="panel col">
          <span class="kicker">Participantes</span>
          <div class="slots">
            {slots.map((s, i) => (
              <div key={i} class={'slot' + (s.kind === 'off' ? ' off' : '')}>
                <button class="slot-face" onClick={() => s.kind !== 'off' && setPicker(i)} aria-label="Trocar personagem" disabled={s.kind === 'off'}>
                  {s.kind !== 'off' ? <CharPortrait char={s.char} size={78} still skin={s.kind === 'human' && i === 0 ? p.equipped.skins[s.char] : undefined} /> : <span class="muted">—</span>}
                  {s.kind !== 'off' && <small>{CHARACTERS[s.char].name}</small>}
                </button>
                <div class="col" style={{ gap: '6px', flex: 1, minWidth: 0 }}>
                  <Seg
                    value={s.kind}
                    options={[
                      { v: 'human', label: 'Humano' },
                      { v: 'bot', label: 'Bot' },
                      ...(i > 0 ? [{ v: 'off' as const, label: 'Vazio' }] : []),
                    ]}
                    onChange={(v) => upd(i, { kind: v as Slot['kind'] })}
                  />
                  {s.kind === 'bot' && <Seg value={s.bot} options={[{ v: 1, label: 'Fácil' }, { v: 2, label: 'Normal' }, { v: 3, label: 'Difícil' }]} onChange={(v) => upd(i, { bot: v as 1 | 2 | 3 })} />}
                  {s.kind === 'human' && humans.length > 1 && (
                    <select class="input" value={s.src} onChange={(e) => upd(i, { src: (e.target as HTMLSelectElement).value })} aria-label="Controle">
                      {Object.entries(SRC_LABEL)
                        .filter(([k]) => k !== 'any')
                        .map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                    </select>
                  )}
                  {def.teams && s.kind !== 'off' && (
                    <Seg value={s.team} options={[{ v: 0, label: 'Equipe Brasa' }, { v: 1, label: 'Equipe Anil' }]} onChange={(v) => upd(i, { team: v as number })} />
                  )}
                </div>
              </div>
            ))}
          </div>
          {humans.length > 1 && <p class="tiny muted">Dica: teclado dividido — Jogador A usa WASD + F/G/R, Jogador B usa setas + / . ,  — controles funcionam automaticamente.</p>}
        </section>

        <section class="panel col">
          <span class="kicker">Arena</span>
          <div class="map-row">
            <button class={'card map-card' + (map === 'aleatorio' ? ' selected' : '')} onClick={() => setMap('aleatorio')}>
              <MapThumb size={120} />
              <b>Aleatória</b>
              <small class="muted">Muda a cada rodada</small>
            </button>
            {maps.map((m) => (
              <button key={m.id} class={'card map-card' + (map === m.id ? ' selected' : '')} onClick={() => setMap(m.id)}>
                <MapThumb id={m.id} size={120} />
                <b>{m.name}</b>
                <small class="muted">{m.mechanic.split('.')[0]}.</small>
              </button>
            ))}
          </div>
          {map !== 'aleatorio' && <p class="small muted">{MAP_BY_ID[map].desc}</p>}
        </section>

        <section class="panel col">
          <span class="kicker">Regras</span>
          <div class="rules-grid">
            {def.roundsToWin > 1 && (
              <label class="field">
                <span>Rodadas para vencer</span>
                <Seg value={rounds} options={[1, 2, 3, 4, 5].map((v) => ({ v, label: String(v) }))} onChange={setRounds} />
              </label>
            )}
            {mode !== 'brasa' && (
              <label class="field">
                <span>Brasas (itens)</span>
                <Seg value={items} options={[{ v: 0, label: 'Nenhuma' }, { v: 1, label: 'Normal' }, { v: 2, label: 'Caótico' }]} onChange={(v) => setItems(v as 0 | 1 | 2)} />
              </label>
            )}
            <div class="row between">
              <span>Técnicas dos personagens</span>
              <Toggle value={abilities} onChange={setAbilities} label="Técnicas" />
            </div>
            <div class="row between">
              <span>Cartuchos especiais</span>
              <Toggle value={carts} onChange={setCarts} label="Cartuchos" />
            </div>
            <div class="row between">
              <span>Brasas corrompidas</span>
              <Toggle value={curses} onChange={setCurses} label="Maldições" />
            </div>
            {def.teams && (
              <div class="row between">
                <span>Fogo amigo</span>
                <Toggle value={ff} onChange={setFf} label="Fogo amigo" />
              </div>
            )}
          </div>
        </section>
      </div>
      {picker !== null && (
        <CharPicker
          value={slots[picker].char}
          allowLocked={slots[picker].kind === 'bot'}
          onClose={() => setPicker(null)}
          onPick={(c) => {
            upd(picker, { char: c });
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}
