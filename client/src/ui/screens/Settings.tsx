import { useEffect, useState } from 'preact/hooks';
import { DEFAULT_BINDINGS, keyLabel, type Action } from '../../game/input';
import { DEFAULT_SETTINGS, autoQuality, settings, updateSettings, type Settings } from '../../state/settings';
import { confirmModal, go, toast } from '../../state/store';
import { sfx } from '../../audio/sfx';
import { music } from '../../audio/music';
import { Backdrop } from '../Backdrop';
import { BackBar, Btn, Seg, Slider, Toggle } from '../components';
import { Icon } from '../icons';

const CATS = [
  { k: 'graficos', label: 'Gráficos', icon: Icon.eye },
  { k: 'audio', label: 'Áudio', icon: Icon.sound },
  { k: 'controles', label: 'Controles', icon: Icon.keyboard },
  { k: 'toque', label: 'Toque', icon: Icon.touch },
  { k: 'controle', label: 'Controle', icon: Icon.pad },
  { k: 'acess', label: 'Acessibilidade', icon: Icon.user },
  { k: 'multi', label: 'Multijogador', icon: Icon.globe },
  { k: 'priv', label: 'Privacidade e conta', icon: Icon.shield },
  { k: 'idioma', label: 'Idioma', icon: Icon.info },
] as const;

const ACTIONS: { a: Action; label: string }[] = [
  { a: 'up', label: 'Cima' },
  { a: 'down', label: 'Baixo' },
  { a: 'left', label: 'Esquerda' },
  { a: 'right', label: 'Direita' },
  { a: 'bomb', label: 'Soltar carga' },
  { a: 'ability', label: 'Técnica' },
  { a: 'cart', label: 'Cartucho' },
  { a: 'emote', label: 'Emote' },
  { a: 'pause', label: 'Pausar' },
];

function Row({ label, hint, children }: { label: string; hint?: string; children: any }) {
  return (
    <div class="set-row">
      <div class="col" style={{ gap: '2px' }}>
        <b>{label}</b>
        {hint && <small class="muted">{hint}</small>}
      </div>
      <div class="set-ctrl">{children}</div>
    </div>
  );
}

export function SettingsScreen() {
  const [cat, setCat] = useState<string>('graficos');
  const [scheme, setScheme] = useState<'solo' | 'left' | 'right'>('solo');
  const [listening, setListening] = useState<{ a: Action; slot: number } | null>(null);
  const s = settings.value;
  const set = (patch: Partial<Settings>) => updateSettings(patch);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape' && listening.a !== 'pause') {
        setListening(null);
        return;
      }
      const b = structuredClone(s.bindings);
      // remove a tecla de outras ações do mesmo esquema
      for (const act of Object.keys(b[scheme]) as Action[]) b[scheme][act] = b[scheme][act].filter((k) => k !== e.code);
      const list = b[scheme][listening.a].slice();
      list[listening.slot] = e.code;
      b[scheme][listening.a] = list.filter(Boolean);
      set({ bindings: b });
      sfx.confirm();
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, scheme]);

  return (
    <div class="screen screen-anim">
      <Backdrop intensity={0.2} variant="dark" />
      <BackBar title="Configurações" />
      <div class="settings">
        <nav class="set-nav">
          {CATS.map((c) => (
            <button key={c.k} class={'set-tab' + (cat === c.k ? ' on' : '')} onClick={() => (sfx.click(), setCat(c.k))}>
              {c.icon({ size: 18 })}
              <span>{c.label}</span>
            </button>
          ))}
        </nav>
        <div class="panel set-body scroll">
          {cat === 'graficos' && (
            <>
              <Row label="Qualidade" hint={s.quality === 'auto' ? `Automática (atual: ${['baixa', 'média', 'alta'][autoQuality.value]})` : 'Afeta partículas, brilhos e resolução'}>
                <Seg
                  value={s.quality}
                  options={[
                    { v: 'auto', label: 'Auto' },
                    { v: 0, label: 'Baixa' },
                    { v: 1, label: 'Média' },
                    { v: 2, label: 'Alta' },
                  ]}
                  onChange={(v) => set({ quality: v as any })}
                />
              </Row>
              <Row label="Tremor de tela" hint="Intensidade do chacoalhar nas explosões">
                <Slider value={s.shake} onChange={(v) => set({ shake: v })} />
              </Row>
              <Row label="Clarões" hint="Flashes de luz em explosões grandes">
                <Toggle value={s.flashes} onChange={(v) => set({ flashes: v })} />
              </Row>
              <Row label="Marcadores de jogador" hint="Formas e nomes acima dos personagens">
                <Toggle value={s.markers} onChange={(v) => set({ markers: v })} />
              </Row>
              <Row label="Mostrar FPS">
                <Toggle value={s.showFps} onChange={(v) => set({ showFps: v })} />
              </Row>
            </>
          )}
          {cat === 'audio' && (
            <>
              <Row label="Volume geral">
                <Slider value={s.master} onChange={(v) => set({ master: v })} />
              </Row>
              <Row label="Música">
                <Slider value={s.music} onChange={(v) => set({ music: v })} />
              </Row>
              <Row label="Efeitos">
                <Slider value={s.sfx} onChange={(v) => set({ sfx: v })} />
              </Row>
              <Row label="Interface">
                <Slider value={s.ui} onChange={(v) => set({ ui: v })} />
              </Row>
              <Row label="Silenciar tudo">
                <Toggle value={s.muted} onChange={(v) => set({ muted: v })} />
              </Row>
              <Row label="Silenciar em segundo plano" hint="Quando você troca de aba ou minimiza">
                <Toggle value={s.muteInBackground} onChange={(v) => set({ muteInBackground: v })} />
              </Row>
              <Row label="Testar som">
                <Btn kind="ghost" size="sm" onClick={() => (sfx.explosion(3, 0), music.play('menu', 3))}>
                  Tocar
                </Btn>
              </Row>
            </>
          )}
          {cat === 'controles' && (
            <>
              <Row label="Esquema" hint="Solo: um jogador. Esquerda/Direita: dois jogadores dividindo o teclado.">
                <Seg
                  value={scheme}
                  options={[
                    { v: 'solo', label: 'Solo' },
                    { v: 'left', label: 'Jogador A' },
                    { v: 'right', label: 'Jogador B' },
                  ]}
                  onChange={setScheme}
                />
              </Row>
              {ACTIONS.map(({ a, label }) => (
                <Row key={a} label={label}>
                  <div class="row" style={{ gap: '6px' }}>
                    {[0, 1].map((slot) => {
                      const code = s.bindings[scheme][a][slot];
                      const on = listening?.a === a && listening.slot === slot;
                      return (
                        <button key={slot} class={'keycap bind' + (on ? ' listening' : '')} onClick={() => setListening({ a, slot })} aria-label={`Remapear ${label}`}>
                          {on ? 'Aperte…' : code ? keyLabel(code) : '+'}
                        </button>
                      );
                    })}
                  </div>
                </Row>
              ))}
              <Btn
                kind="ghost"
                size="sm"
                icon={Icon.refresh({ size: 16 })}
                onClick={async () => {
                  if (await confirmModal('Restaurar teclas?', 'Todas as teclas voltam ao padrão.', 'Restaurar')) set({ bindings: structuredClone(DEFAULT_BINDINGS) });
                }}
              >
                Restaurar padrão
              </Btn>
            </>
          )}
          {cat === 'toque' && (
            <>
              <Row label="Tamanho dos controles">
                <Slider value={s.touchSize} min={0.7} max={1.4} onChange={(v) => set({ touchSize: v })} />
              </Row>
              <Row label="Opacidade">
                <Slider value={s.touchOpacity} min={0.3} max={1} onChange={(v) => set({ touchOpacity: v })} />
              </Row>
              <Row label="Direcional flutuante" hint="Aparece onde você encosta o polegar">
                <Toggle value={s.touchFloating} onChange={(v) => set({ touchFloating: v })} />
              </Row>
              <Row label="Modo canhoto" hint="Inverte os lados do direcional e dos botões">
                <Toggle value={s.touchLeftHanded} onChange={(v) => set({ touchLeftHanded: v })} />
              </Row>
              <Row label="Vibração">
                <Toggle value={s.haptics} onChange={(v) => set({ haptics: v })} />
              </Row>
            </>
          )}
          {cat === 'controle' && (
            <>
              <p class="small muted">Controles de Xbox, PlayStation e genéricos funcionam automaticamente, inclusive para navegar nos menus.</p>
              {[
                ['Direcional / analógico', 'Mover'],
                ['A / ✕', 'Soltar carga · confirmar'],
                ['B / ○ ou X / □ ou LB', 'Técnica · voltar nos menus'],
                ['Y / △ ou RB', 'Cartucho'],
                ['Select / Share', 'Emote'],
                ['Start / Options', 'Pausar'],
              ].map(([k, v]) => (
                <Row key={k} label={v}>
                  <span class="keycap">{k}</span>
                </Row>
              ))}
              <Row label="Vibração do controle">
                <Toggle value={s.padVibration} onChange={(v) => set({ padVibration: v })} />
              </Row>
            </>
          )}
          {cat === 'acess' && (
            <>
              <Row label="Tamanho da interface">
                <Slider value={s.uiScale} min={0.85} max={1.3} onChange={(v) => set({ uiScale: v })} />
              </Row>
              <Row label="Texto grande">
                <Toggle value={s.largeText} onChange={(v) => set({ largeText: v })} />
              </Row>
              <Row label="Movimento reduzido" hint="Menos animações, tremores e clarões">
                <Toggle value={s.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
              </Row>
              <Row label="Alto contraste">
                <Toggle value={s.highContrast} onChange={(v) => set({ highContrast: v })} />
              </Row>
              <Row label="Filtro de cores" hint="Os sinais do jogo também usam formas, anéis e ícones — nunca só cor.">
                <Seg
                  value={s.colorblind}
                  options={[
                    { v: 'nenhum', label: 'Nenhum' },
                    { v: 'protanopia', label: 'Protan.' },
                    { v: 'deuteranopia', label: 'Deuteran.' },
                    { v: 'tritanopia', label: 'Tritan.' },
                  ]}
                  onChange={(v) => set({ colorblind: v as any })}
                />
              </Row>
              <Row label="Dicas durante o jogo">
                <Toggle value={s.tips} onChange={(v) => set({ tips: v })} />
              </Row>
            </>
          )}
          {cat === 'multi' && (
            <>
              <Row label="Mostrar nomes dos jogadores">
                <Toggle value={s.showNames} onChange={(v) => set({ showNames: v })} />
              </Row>
              <Row label="Chat rápido" hint="Frases prontas no lobby (não existe chat de texto livre)">
                <Toggle value={s.quickChat} onChange={(v) => set({ quickChat: v })} />
              </Row>
              <Row label="Aceitar convites de">
                <Seg
                  value={s.invites}
                  options={[
                    { v: 'todos', label: 'Todos' },
                    { v: 'amigos', label: 'Amigos' },
                    { v: 'ninguem', label: 'Ninguém' },
                  ]}
                  onChange={(v) => set({ invites: v as any })}
                />
              </Row>
            </>
          )}
          {cat === 'priv' && (
            <>
              <Row label="Aparecer online para amigos">
                <Toggle value={s.showOnline} onChange={(v) => set({ showOnline: v })} />
              </Row>
              <Row label="Conta e sincronização" hint="Proteja seu progresso com usuário e senha">
                <Btn kind="ghost" size="sm" onClick={() => go('profile', { tab: 'conta' })}>
                  Abrir
                </Btn>
              </Row>
              <Row label="Apagar dados deste aparelho" hint="Remove progresso local não sincronizado">
                <Btn
                  kind="danger"
                  size="sm"
                  onClick={async () => {
                    if (!(await confirmModal('Apagar dados locais?', 'Configurações e progresso não sincronizado deste aparelho serão removidos.', 'Apagar', true))) return;
                    try {
                      localStorage.clear();
                    } catch {
                      /* ignora */
                    }
                    location.reload();
                  }}
                >
                  Apagar
                </Btn>
              </Row>
              <Row label="Restaurar configurações">
                <Btn kind="ghost" size="sm" onClick={() => (set({ ...structuredClone(DEFAULT_SETTINGS) }), toast('Configurações restauradas', 'ok'))}>
                  Restaurar
                </Btn>
              </Row>
              <Row label="Créditos">
                <Btn kind="ghost" size="sm" onClick={() => go('credits')}>
                  Ver
                </Btn>
              </Row>
            </>
          )}
          {cat === 'idioma' && (
            <>
              <Row label="Idioma do jogo" hint="Todo o conteúdo está em português do Brasil.">
                <Seg value={s.language} options={[{ v: 'pt-BR', label: 'Português (Brasil)' }]} onChange={(v) => set({ language: v as any })} />
              </Row>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
