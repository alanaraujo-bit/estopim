import { useState } from 'preact/hooks';
import { CHARACTERS, COSMETICS, RARITY_INFO, type CosmeticDef } from '@estopim/shared';
import { doOp } from '../../net/client';
import { confirmModal, profile, toast } from '../../state/store';
import { sfx } from '../../audio/sfx';
import { Backdrop } from '../Backdrop';
import { BackBar, BombPreview, Btn, CharPortrait, Currency } from '../components';
import { Icon } from '../icons';

const KIND_LABEL: Record<string, string> = { skin: 'Visual', bomb: 'Carga', trail: 'Rastro', emote: 'Emote', victory: 'Comemoração', banner: 'Faixa', frame: 'Moldura', title: 'Título' };

export function Shop() {
  const p = profile.value;
  const [filter, setFilter] = useState<string>('todos');
  const all = COSMETICS.filter((c) => c.source === 'loja');
  const list = all.filter((c) => filter === 'todos' || c.kind === filter);
  const buy = async (c: CosmeticDef) => {
    if (p.inventory.includes(c.id)) return;
    if (p.sparks < (c.price ?? 0)) {
      sfx.error();
      toast('Faíscas insuficientes', 'warn', 'Jogue partidas, missões e desafios para ganhar mais.');
      return;
    }
    const ok = await confirmModal(`Comprar ${c.name}?`, `Custa ${c.price} Faíscas. Você terá ${p.sparks - (c.price ?? 0)} depois da compra.`, 'Comprar');
    if (!ok) return;
    const r = doOp({ k: 'buy', id: c.id });
    if (r.ok) {
      sfx.reward();
      toast(`${c.name} é seu!`, 'reward', 'Equipe no Armário.', '✦');
    } else toast(r.error ?? 'Compra não concluída.', 'error');
  };
  return (
    <div class="screen screen-anim">
      <Backdrop intensity={0.25} variant="dark" />
      <BackBar title="Oficina" kicker="Visuais da Vila" right={<Currency />} />
      <p class="small muted" style={{ position: 'relative' }}>
        Tudo aqui é só visual e é comprado com Faíscas ganhas jogando. Nenhum item muda o equilíbrio das partidas.
      </p>
      <div class="seg" style={{ position: 'relative', alignSelf: 'flex-start' }}>
        {['todos', 'skin', 'bomb', 'trail', 'emote', 'victory', 'banner'].map((k) => (
          <button key={k} class={filter === k ? 'on' : ''} onClick={() => (sfx.click(), setFilter(k))}>
            {k === 'todos' ? 'Tudo' : KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div class="shop-grid scroll">
        {list.map((c) => {
          const own = p.inventory.includes(c.id);
          return (
            <div key={c.id} class={'card shop-item' + (own ? ' owned' : '')} style={{ '--rc': RARITY_INFO[c.rarity].color } as any}>
              <span class="rarity" />
              <div class="shop-art">
                {c.kind === 'skin' && c.char ? <CharPortrait char={c.char} size={110} skin={c.id} pedestal still /> : c.kind === 'bomb' ? <BombPreview skin={c.id} size={90} /> : c.kind === 'emote' ? <span class="emo big">{c.data?.glyph}</span> : c.kind === 'banner' ? <span class="ban" style={{ background: `linear-gradient(135deg, ${c.data?.a}, ${c.data?.b})` }} /> : <span class="emo big">✦</span>}
              </div>
              <div class="col" style={{ gap: '3px' }}>
                <span class="tiny" style={{ color: RARITY_INFO[c.rarity].color, fontWeight: 800 }}>
                  {RARITY_INFO[c.rarity].name} · {KIND_LABEL[c.kind]}
                  {c.char ? ` · ${CHARACTERS[c.char].name}` : ''}
                </span>
                <b>{c.name}</b>
                <small class="muted">{c.desc}</small>
              </div>
              {own ? (
                <span class="chip chip-ok">{Icon.check({ size: 14 })} Na coleção</span>
              ) : (
                <Btn kind={p.sparks >= (c.price ?? 0) ? 'gold' : 'ghost'} size="sm" icon={Icon.coin({ size: 16 })} onClick={() => buy(c)}>
                  {c.price}
                </Btn>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
