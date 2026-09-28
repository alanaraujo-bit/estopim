// Constantes fundamentais da simulação. Coordenadas em "tiles": o centro do
// tile (tx, ty) fica exatamente em (tx, ty).
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const secs = (s: number) => Math.round(s * TICK_RATE);

/** Camada sólida do grid. */
export const T = {
  Empty: 0,
  Wall: 1, // indestrutível
  Block: 2, // destrutível
  Hard: 3, // reforçado: vira Block ao ser atingido
  Barrel: 4, // barril volátil: explode ao ser atingido
  MirrorA: 5, // espelho "/" — desvia chamas
  MirrorB: 6, // espelho "\" — desvia chamas
  Crystal: 7, // prisma temporário (Lume)
  Vine: 8, // trepadeira: destrutível e renasce
  Target: 9, // alvo de missão (gerador, bulbo, etc.)
  Door: 10, // portão fechado de missão
  Cracked: 11, // parede rachada (segredo): destrutível
  Pillar: 12, // coluna indestrutível (variante de parede)
} as const;
export type TileId = (typeof T)[keyof typeof T];

/** Camada de piso. */
export const F = {
  Normal: 0,
  Ice: 1,
  ConvU: 2,
  ConvR: 3,
  ConvD: 4,
  ConvL: 5,
  Teleport: 6,
  Vent: 7, // respiradouro periódico (lava / criogenia)
  Zone: 8, // zona da coroa
  Exit: 9, // saída de missão
  Plate: 10, // placa de pressão
  BaseA: 11,
  BaseB: 12,
  Pit: 13, // abismo: bloqueia passagem, engole cargas chutadas
  Deco: 14, // piso decorado (sem efeito)
} as const;

/** Itens (Brasas). */
export const I = {
  None: 0,
  BombUp: 1,
  RangeUp: 2,
  SpeedUp: 3,
  Kick: 4,
  Shield: 5,
  Cartridge: 6,
  Curse: 7,
  RangeMax: 8,
  Fragment: 9, // fragmento de missão
  Relic: 10, // relíquia secreta
  Heart: 11, // vida (campanha)
  Spark: 12, // moeda de missão
} as const;
export type ItemId = (typeof I)[keyof typeof I];

/** Tipos de carga. */
export const B = {
  Normal: 0,
  Pierce: 1,
  Frag: 2,
  Mine: 3,
  Pulse: 4,
  Frost: 5,
  Remote: 6,
  Cluster: 7,
  Mini: 8,
  Barrel: 9,
  Enemy: 10,
  Rain: 11,
  Potato: 12,
} as const;
export type BombKind = (typeof B)[keyof typeof B];

export const CURSES = {
  None: 0,
  ShortFuse: 1, // pavio curto
  Slow: 2, // passos de chumbo
  Hyper: 3, // disparada
  Leaky: 4, // cargas escapam sozinhas
  Reverse: 5, // controles invertidos
  Jammed: 6, // não consegue soltar cargas
} as const;

/** Direções: 0 cima, 1 direita, 2 baixo, 3 esquerda. -1 = parado. */
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const opposite = (d: number) => (d + 2) & 3;

export const SPEEDS = [3.25, 3.75, 4.2, 4.65, 5.05, 5.45, 5.8];
export const BASE_FUSE = secs(2.5);
export const FLAME_TIME = secs(0.55);
export const CHAIN_DELAY = 3;
export const KICK_SPEED = 9.5;
export const CONVEYOR_SPEED = 1.7;
export const MAX_PLAYERS = 4;
