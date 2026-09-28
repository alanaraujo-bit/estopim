import type { CharId } from './characters';

export type Rarity = 'comum' | 'raro' | 'epico' | 'lendario';
export type CosmeticKind = 'skin' | 'bomb' | 'trail' | 'emote' | 'victory' | 'banner' | 'frame' | 'title';

export interface CosmeticDef {
  id: string;
  kind: CosmeticKind;
  name: string;
  desc: string;
  rarity: Rarity;
  char?: CharId; // skins
  colors?: [string, string, string, string];
  price?: number; // Faíscas (moeda obtida jogando)
  source: 'inicial' | 'loja' | 'nivel' | 'temporada' | 'conquista' | 'campanha' | 'maestria' | 'ranqueada';
  collection?: string;
  data?: Record<string, any>;
}

const skin = (
  id: string,
  char: CharId,
  name: string,
  colors: [string, string, string, string],
  rarity: Rarity,
  source: CosmeticDef['source'],
  price?: number,
  collection?: string,
  desc = '',
): CosmeticDef => ({ id, kind: 'skin', char, name, colors, rarity, source, price, collection, desc: desc || `Visual alternativo para ${name.split(' ')[0]}.` });

export const COSMETICS: CosmeticDef[] = [
  // Skins
  skin('faisca-noturna', 'faisca', 'Faísca Noturna', ['#2b2d42', '#ff7a2f', '#111222', '#ffe1c4'], 'raro', 'loja', 600, 'Noite de São João'),
  skin('faisca-quadrilha', 'faisca', 'Faísca Quadrilheira', ['#e63946', '#ffd166', '#6b3f1d', '#ffe1c4'], 'epico', 'temporada', undefined, 'Arraiá do Pavio'),
  skin('faisca-ouro', 'faisca', 'Faísca Dourada', ['#ffcf3d', '#fff3c4', '#7a4a00', '#ffe1c4'], 'lendario', 'maestria'),
  skin('tuba-banda', 'tuba', 'Tuba da Banda', ['#1d3557', '#ffd166', '#0b1a2e', '#8d5a3b'], 'raro', 'loja', 600, 'Banda da Fundição'),
  skin('tuba-ferrugem', 'tuba', 'Tuba Ferrugem', ['#8a4b2a', '#d58a58', '#2f1a10', '#8d5a3b'], 'epico', 'campanha'),
  skin('tuba-ouro', 'tuba', 'Tuba Dourado', ['#ffcf3d', '#fff3c4', '#7a4a00', '#8d5a3b'], 'lendario', 'maestria'),
  skin('lume-eclipse', 'lume', 'Lume Eclipse', ['#1d1640', '#ffcf3d', '#07051a', '#f1e9ff'], 'epico', 'loja', 1200, 'Céu de Aurora'),
  skin('lume-aurora', 'lume', 'Lume Aurora', ['#5ef2d6', '#b69cff', '#0f3b3a', '#f1e9ff'], 'raro', 'temporada'),
  skin('lume-ouro', 'lume', 'Lume Dourada', ['#ffcf3d', '#fff3c4', '#7a4a00', '#f1e9ff'], 'lendario', 'maestria'),
  skin('mola-sucata', 'mola', 'Mola Sucata', ['#8a8f99', '#ff7a1a', '#2b2d33', '#e0fbfc'], 'raro', 'loja', 600),
  skin('mola-ouro', 'mola', 'Mola Dourado', ['#ffcf3d', '#fff3c4', '#7a4a00', '#e0fbfc'], 'lendario', 'maestria'),
  skin('geada-nevasca', 'geada', 'Geada Nevasca', ['#ffffff', '#7fd8ff', '#33485a', '#f0f7ff'], 'raro', 'loja', 600),
  skin('geada-ouro', 'geada', 'Geada Dourada', ['#ffcf3d', '#fff3c4', '#7a4a00', '#f0f7ff'], 'lendario', 'maestria'),
  skin('vulto-carmim', 'vulto', 'Vulto Carmim', ['#6a040f', '#ffba08', '#1a0004', '#ffd6d6'], 'epico', 'loja', 1200),
  skin('vulto-ouro', 'vulto', 'Vulto Dourado', ['#ffcf3d', '#2b2d42', '#7a4a00', '#fff3c4'], 'lendario', 'maestria'),
  skin('magna-cromo', 'magna', 'Magna Cromada', ['#8d99ae', '#edf2f4', '#2b2d42', '#ffddd2'], 'raro', 'loja', 600),
  skin('magna-ouro', 'magna', 'Magna Dourada', ['#ffcf3d', '#fff3c4', '#7a4a00', '#ffddd2'], 'lendario', 'maestria'),
  skin('pira-boto', 'pira', 'Pirá Boto-Cor-de-Rosa', ['#ff8fab', '#ffe5ec', '#590d22', '#f4c095'], 'epico', 'loja', 1200),
  skin('pira-ouro', 'pira', 'Pirá Dourado', ['#ffcf3d', '#fff3c4', '#7a4a00', '#f4c095'], 'lendario', 'maestria'),

  // Cargas
  { id: 'classica', kind: 'bomb', name: 'Clássica', desc: 'A carga de sempre.', rarity: 'comum', source: 'inicial' },
  { id: 'lanterna', kind: 'bomb', name: 'Lanterna Junina', desc: 'Papel de seda, bandeirinha e pólvora.', rarity: 'raro', source: 'loja', price: 400, collection: 'Arraiá do Pavio' },
  { id: 'cubo', kind: 'bomb', name: 'Cubo de Fundição', desc: 'Forjado na Esteira 7.', rarity: 'raro', source: 'campanha' },
  { id: 'estrela', kind: 'bomb', name: 'Estrela Cadente', desc: 'Caiu do céu de Aurora.', rarity: 'epico', source: 'loja', price: 900 },
  { id: 'cristal', kind: 'bomb', name: 'Cristal Boreal', desc: 'Frio por fora, quente por dentro.', rarity: 'epico', source: 'campanha' },
  { id: 'zabumba', kind: 'bomb', name: 'Zabumba', desc: 'Tum-tum-tum… BUM.', rarity: 'raro', source: 'nivel' },
  { id: 'caju', kind: 'bomb', name: 'Caju', desc: 'Sazonal e explosivo.', rarity: 'raro', source: 'temporada', collection: 'Arraiá do Pavio' },
  { id: 'orbe', kind: 'bomb', name: 'Orbe Neon', desc: 'Direto do Neon Subterrâneo.', rarity: 'lendario', source: 'ranqueada' },

  // Rastros
  { id: 'nenhum', kind: 'trail', name: 'Nenhum', desc: 'Discreto.', rarity: 'comum', source: 'inicial' },
  { id: 'brasas', kind: 'trail', name: 'Brasas', desc: 'Pequenas faíscas a cada passo.', rarity: 'comum', source: 'nivel', data: { color: '#ffb347', type: 'ember' } },
  { id: 'confete', kind: 'trail', name: 'Confete', desc: 'Toda hora é festa.', rarity: 'raro', source: 'loja', price: 500, data: { color: 'multi', type: 'confetti' } },
  { id: 'neve', kind: 'trail', name: 'Nevisco', desc: 'Flocos que somem no ar.', rarity: 'raro', source: 'campanha', data: { color: '#e8fbff', type: 'snow' } },
  { id: 'notas', kind: 'trail', name: 'Notas Musicais', desc: 'Cada passo, um compasso.', rarity: 'epico', source: 'temporada', data: { color: '#ffd23f', type: 'note' } },
  { id: 'estrelas', kind: 'trail', name: 'Poeira Estelar', desc: 'Direto da Órbita-9.', rarity: 'epico', source: 'loja', price: 1000, data: { color: '#fff3c4', type: 'star' } },

  // Emotes
  { id: 'aceno', kind: 'emote', name: 'Aceno', desc: 'Oi!', rarity: 'comum', source: 'inicial', data: { glyph: '👋', text: 'Oi!' } },
  { id: 'gg', kind: 'emote', name: 'Boa!', desc: 'Respeito.', rarity: 'comum', source: 'inicial', data: { glyph: '🤝', text: 'Boa!' } },
  { id: 'risada', kind: 'emote', name: 'Risada', desc: 'Kkkkk', rarity: 'comum', source: 'inicial', data: { glyph: '😂', text: 'Kkkk' } },
  { id: 'susto', kind: 'emote', name: 'Susto', desc: 'Essa foi por pouco.', rarity: 'comum', source: 'inicial', data: { glyph: '😱', text: 'Ufa!' } },
  { id: 'fogo', kind: 'emote', name: 'Tá pegando fogo', desc: 'Literalmente.', rarity: 'raro', source: 'nivel', data: { glyph: '🔥', text: 'Tá quente!' } },
  { id: 'coroa', kind: 'emote', name: 'Rei da Arena', desc: 'Humildade é para os fracos.', rarity: 'epico', source: 'conquista', data: { glyph: '👑', text: 'Reinando' } },
  { id: 'coracao', kind: 'emote', name: 'Coração', desc: 'Carinho explosivo.', rarity: 'raro', source: 'loja', price: 300, data: { glyph: '❤️', text: '<3' } },
  { id: 'pensando', kind: 'emote', name: 'Hmm…', desc: 'Calculando a próxima jogada.', rarity: 'raro', source: 'temporada', data: { glyph: '🤔', text: 'Hmm…' } },

  // Vitórias
  { id: 'danca', kind: 'victory', name: 'Dancinha', desc: 'Um passinho de forró.', rarity: 'comum', source: 'inicial' },
  { id: 'fogos', kind: 'victory', name: 'Queima de Fogos', desc: 'O céu inteiro comemora.', rarity: 'epico', source: 'loja', price: 1100 },
  { id: 'trono', kind: 'victory', name: 'Trono', desc: 'Sente-se. Você merece.', rarity: 'lendario', source: 'ranqueada' },

  // Faixas
  { id: 'faixa-pavio', kind: 'banner', name: 'Pavio Aceso', desc: 'Faixa inicial.', rarity: 'comum', source: 'inicial', data: { a: '#ff7a2f', b: '#3a1d4f', motif: 'fuse' } },
  { id: 'faixa-bandeirinhas', kind: 'banner', name: 'Bandeirinhas', desc: 'Festa na Vila Pavio.', rarity: 'raro', source: 'temporada', data: { a: '#ffd166', b: '#e63946', motif: 'flags' } },
  { id: 'faixa-fundicao', kind: 'banner', name: 'Metal Quente', desc: 'Vencedor da Fundição.', rarity: 'raro', source: 'campanha', data: { a: '#ff4d3d', b: '#23140f', motif: 'gears' } },
  { id: 'faixa-aurora', kind: 'banner', name: 'Aurora', desc: 'Luz que dobra.', rarity: 'epico', source: 'loja', price: 800, data: { a: '#5ef2d6', b: '#2a1f55', motif: 'waves' } },
  { id: 'faixa-orbita', kind: 'banner', name: 'Órbita', desc: 'Além da estratosfera.', rarity: 'epico', source: 'nivel', data: { a: '#6ef3ff', b: '#0b1026', motif: 'stars' } },
  { id: 'faixa-campeao', kind: 'banner', name: 'Supernova', desc: 'Para quem chegou ao topo.', rarity: 'lendario', source: 'ranqueada', data: { a: '#ffcf3d', b: '#3a0ca3', motif: 'burst' } },

  // Molduras
  { id: 'moldura-simples', kind: 'frame', name: 'Simples', desc: 'Clássica.', rarity: 'comum', source: 'inicial', data: { color: '#ffd9a8' } },
  { id: 'moldura-brasa', kind: 'frame', name: 'Brasa', desc: 'Acesa.', rarity: 'raro', source: 'nivel', data: { color: '#ff7a2f' } },
  { id: 'moldura-gelo', kind: 'frame', name: 'Gelo', desc: 'Fria como a Geada.', rarity: 'raro', source: 'campanha', data: { color: '#7fd8ff' } },
  { id: 'moldura-ouro', kind: 'frame', name: 'Ouro', desc: 'Brilho de campeão.', rarity: 'lendario', source: 'conquista', data: { color: '#ffcf3d' } },

  // Títulos
  { id: 'titulo-novato', kind: 'title', name: 'Pavio Novo', desc: 'Todo mundo começa em algum lugar.', rarity: 'comum', source: 'inicial' },
  { id: 'titulo-demolidor', kind: 'title', name: 'Demolidor', desc: 'Destrua 1.000 blocos.', rarity: 'raro', source: 'conquista' },
  { id: 'titulo-estrategista', kind: 'title', name: 'Estrategista', desc: 'Vença com cadeias de 4+.', rarity: 'epico', source: 'conquista' },
  { id: 'titulo-heroi', kind: 'title', name: 'Herói da Centelha', desc: 'Conclua a campanha.', rarity: 'lendario', source: 'campanha' },
  { id: 'titulo-intocavel', kind: 'title', name: 'Rei do Arraiá', desc: 'Recompensa final da Temporada 1.', rarity: 'epico', source: 'temporada' },
  { id: 'titulo-fogueteiro', kind: 'title', name: 'Fogueteiro', desc: 'Alcance o nível 20.', rarity: 'raro', source: 'nivel' },
];

export const COSMETIC_BY_ID: Record<string, CosmeticDef> = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));

export const SKINS: Record<string, CosmeticDef> = Object.fromEntries(COSMETICS.filter((c) => c.kind === 'skin').map((c) => [c.id, c]));

export const STARTER_INVENTORY = COSMETICS.filter((c) => c.source === 'inicial').map((c) => c.id);

export const RARITY_INFO: Record<Rarity, { name: string; color: string }> = {
  comum: { name: 'Comum', color: '#cfc6b8' },
  raro: { name: 'Raro', color: '#4cc9f0' },
  epico: { name: 'Épico', color: '#b69cff' },
  lendario: { name: 'Lendário', color: '#ffcf3d' },
};
