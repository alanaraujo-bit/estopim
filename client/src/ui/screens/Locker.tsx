import { useState } from 'preact/hooks';
import { CHARACTERS, CHAR_ORDER, COSMETICS, RARITY_INFO, type CharId, type CosmeticDef, type CosmeticKind } from '@estopim/shared';
import { doOp } from '../../net/client';
import { go, profile, toast } from '../../state/store';
import { sfx } from '../../audio/sfx';
import { Backdrop } from '../Backdrop';
import { BackBar, BombPreview, Btn, CharPortrait, Currency } from '../components';
import { Icon } from '../icons';
import { isUnlocked } from '../CharPicker';
import { ProfileCard } from './Profile';

const TABS: { k: CosmeticKind; label: string }[] = [
  { k: 'skin', label: 'Visuais' },
  { k: 'bomb', label: 'Cargas' },
  { k: 'trail', label: 'Rastros' },
  { k: 'emote', label: 'Emotes' },
  { k: 'victory', label: 'Comemoração' },
  { k: 'banner', label: 'Faixas' },
  { k: 'frame', label: 'Molduras' },
  { k: 'title', label: 'Títulos' },
];

export function sourceText(c: CosmeticDef): string {
  switch (c.source) {
    case 'loja':
      return `Oficina · ${c.price} Faíscas`;
    case 'temporada':
      return 'Trilha da Temporada';
    case 'campanha':
      return 'Recompensa da campanha';
    case 'conquista':
      return 'Recompensa de conquista';
    case 'maestria':
      return 'Maestria 10 do personagem';
    case 'nivel':
      return 'Recompensa de nível';
    case 'ranqueada':
      return 'Recompensa ranqueada';
  }
  return 'Inicial';
}

export function Locker() {
  const p = profile.value;
  const [tab, setTab] = useState<CosmeticKind>('skin');
  const [char, setChar] = useState<CharId>(p.favoriteChar);
  const [preview, setPreview] = useState<string | null>(null);
  const items = COSMETICS.filter((c) => c.kind === tab && (tab !== 'skin' || c.char === char));
  const owned = (id: string) => id === 'base' || p.inventory.includes(id);
  const equippedId = tab === 'skin' ? p.equipped.skins[char] ?? 'base' : tab === 'emote' ? '' : (p.equipped as any)[tab];
  const equip = (c: CosmeticDef | null, index?: number) => {
    const id = c?.id ?? 'base';
    const r = doOp({ k: 'equip', slot: tab === 'skin' ? 'skin' : (tab as any), id, char: tab === 'skin' ? char : undefined, index });
    if (r.ok) {
      sfx.confirm();
    } else toast(r.error ?? 'Não foi possível equipar.', 'error');
  };
  const skinPreview = tab === 'skin' ? preview ?? equippedId : p.equipped.skins[char] ?? 'base';
  return (
    <div class="screen screen-anim">
      <Backdrop intensity={0.25} variant="dark" />
      <BackBar title="Armário" kicker="Personalização" right={<Currency />} />
      <div class="locker">
        <div class="locker-stage panel">
          {tab === 'banner' || tab === 'frame' || tab === 'title' ? (
            <ProfileCard p={p} />
          ) : tab === 'bomb' ? (
            <div class="col center">
              <BombPreview skin={preview ?? p.equipped.bomb} size={160} />
            </div>
          ) : (
            <CharPortrait char={char} size={260} pedestal skin={skinPreview} moving={tab === 'trail'} emote={tab === 'victory' ? 'win' : null} />
          )}
          {tab === 'skin' && (
            <div class="char-strip">
              {CHAR_ORDER.map((c) => (
                <button
                  key={c}
                  class={'mini-char' + (c === char ? ' on' : '') + (isUnlocked(c) ? '' : ' locked')}
                  onClick={() => {
                    sfx.click();
                    setChar(c);
                    setPreview(null);
                  }}
                  aria-label={CHARACTERS[c].name}
                >
                  <CharPortrait char={c} size={46} still skin={p.equipped.skins[c]} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div class="locker-list panel col">
          <div class="tabs">
            {TABS.map((t) => (
              <button
                key={t.k}
                class={'tab' + (tab === t.k ? ' on' : '')}
                onClick={() => {
                  sfx.click();
                  setTab(t.k);
                  setPreview(null);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'emote' && (
            <div class="emote-slots">
              <span class="kicker">Equipados (a tecla de emote alterna entre eles)</span>
              <div class="row" style={{ gap: '8px' }}>
                {p.equipped.emotes.map((id) => {
                  const d = COSMETICS.find((c) => c.id === id);
                  return (
                    <span key={id} class="chip">
                      {d?.data?.glyph} {d?.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          <div class="cos-grid scroll">
            {tab === 'skin' && (
              <button class={'card cos' + (equippedId === 'base' ? ' selected' : '')} onClick={() => (setPreview('base'), equip(null))}>
                <CharPortrait char={char} size={70} still />
                <b>Clássico</b>
                <small class="muted">Visual original</small>
              </button>
            )}
            {items.map((c) => {
              const own = owned(c.id);
              const eq = tab === 'emote' ? p.equipped.emotes.includes(c.id) : equippedId === c.id;
              return (
                <button
                  key={c.id}
                  class={'card cos' + (eq ? ' selected' : '') + (own ? '' : ' locked')}
                  style={{ '--rc': RARITY_INFO[c.rarity].color } as any}
                  onPointerEnter={() => setPreview(c.id)}
                  onClick={() => {
                    setPreview(c.id);
                    if (!own) {
                      if (c.source === 'loja') go('shop');
                      else toast(c.name, 'info', sourceText(c));
                      return;
                    }
                    if (tab === 'emote') {
                      if (eq) return;
                      equip(c, 3);
                    } else equip(c);
                  }}
                >
                  <span class="rarity" />
                  {tab === 'skin' ? <CharPortrait char={char} size={70} still skin={c.id} /> : tab === 'bomb' ? <BombPreview skin={c.id} size={64} /> : tab === 'emote' ? <span class="emo">{c.data?.glyph}</span> : tab === 'banner' ? <span class="ban" style={{ background: `linear-gradient(135deg, ${c.data?.a}, ${c.data?.b})` }} /> : tab === 'frame' ? <span class="frm" style={{ borderColor: c.data?.color }} /> : <span class="emo">{tab === 'trail' ? '✦' : tab === 'victory' ? '★' : '❝'}</span>}
                  <b>{c.name}</b>
                  <small class="muted">{own ? (eq ? 'Equipado' : RARITY_INFO[c.rarity].name) : sourceText(c)}</small>
                  {!own && <span class="lock">{Icon.lock({ size: 14 })}</span>}
                </button>
              );
            })}
          </div>
          <Btn kind="ghost" size="sm" icon={Icon.bag({ size: 16 })} onClick={() => go('shop')}>
            Ir para a Oficina
          </Btn>
        </div>
      </div>
    </div>
  );
}
