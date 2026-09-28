// Mapas de arena. Legenda:
//  #  parede       x  coluna        .  piso (pode receber bloco aleatório)
//  ,  piso livre   b  bloco fixo    h  bloco reforçado   o  barril
//  /  \  espelhos  ~  gelo (aleatório) _ gelo livre
//  ^ > v <  esteiras   t  teletransporte (pares em ordem)   V  respiradouro
//  Z  zona da coroa    P  abismo    g  trepadeira    A/B  bases   1..4  nascimentos
//  C  parede rachada   *  alvo      E  saída         D  portão    p  placa  $ item fixo

export type Biome = 'vila' | 'fundicao' | 'boreal' | 'aurora' | 'verdejante' | 'orbita' | 'magma' | 'neon';

export interface MapDef {
  id: string;
  name: string;
  biome: Biome;
  desc: string;
  mechanic: string;
  rows: string[];
  density: number; // chance de bloco em '.'
  vineRatio?: number; // parte dos blocos aleatórios que são trepadeiras
  hardRatio?: number;
  dark?: boolean;
  ventPeriod?: number; // segundos
}

export const BIOMES: Record<Biome, { name: string; desc: string; accent: string; bg: string }> = {
  vila: { name: 'Vila Pavio', desc: 'Telhados em festa, varais de bandeirinhas e caixas de rojões.', accent: '#ff8a3d', bg: '#2a1b3d' },
  fundicao: { name: 'Fundição Rubra', desc: 'Esteiras, prensas e metal incandescente.', accent: '#ff4d3d', bg: '#23140f' },
  boreal: { name: 'Laboratório Boreal', desc: 'Pisos congelados e experimentos que não deveriam estar ligados.', accent: '#7fd8ff', bg: '#0f2233' },
  aurora: { name: 'Ruínas de Aurora', desc: 'Espelhos antigos que dobram a luz — e as chamas.', accent: '#b69cff', bg: '#1a1433' },
  verdejante: { name: 'Templo Verdejante', desc: 'Trepadeiras que crescem de volta e segredos sob as raízes.', accent: '#5fe08a', bg: '#0f2418' },
  orbita: { name: 'Estação Órbita-9', desc: 'Gravidade artificial, abismos e portais de carga.', accent: '#6ef3ff', bg: '#0b1026' },
  magma: { name: 'Fortaleza Magma', desc: 'Respiradouros que cospem fogo em ritmo constante.', accent: '#ffb000', bg: '#2a0f0a' },
  neon: { name: 'Neon Subterrâneo', desc: 'Escuridão total. Só as explosões iluminam o caminho.', accent: '#ff3cac', bg: '#0a0614' },
};

export const MAPS: MapDef[] = [
  {
    id: 'praca',
    name: 'Praça do Pavio',
    biome: 'vila',
    desc: 'O palco clássico do Circuito Estopim, montado no coração da Vila Pavio.',
    mechanic: 'Barris de rojão explodem em cadeia quando atingidos.',
    density: 0.72,
    rows: [
      '###############',
      '#1...........3#',
      '#.x.x.x.x.x.x.#',
      '#.............#',
      '#.x.x.x.x.x.x.#',
      '#.....o.o.....#',
      '#.x.x.x,x.x.x.#',
      '#.....o.o.....#',
      '#.x.x.x.x.x.x.#',
      '#.............#',
      '#.x.x.x.x.x.x.#',
      '#4...........2#',
      '###############',
    ],
  },
  {
    id: 'esteira',
    name: 'Esteira 7',
    biome: 'fundicao',
    desc: 'Linha de montagem desativada da Fundição Rubra. Quase desativada.',
    mechanic: 'Esteiras carregam jogadores e cargas. Chute uma carga numa esteira e deixe a fábrica trabalhar.',
    density: 0.68,
    hardRatio: 0.12,
    rows: [
      '###############',
      '#1...........3#',
      '#.x.x.x.x.x.x.#',
      '#.............#',
      '#.x>>>>>>>>>x.#',
      '#.............#',
      '#.x.x.x.x.x.x.#',
      '#.............#',
      '#.x<<<<<<<<<x.#',
      '#.............#',
      '#.x.x.x.x.x.x.#',
      '#4...........2#',
      '###############',
    ],
  },
  {
    id: 'espelhos',
    name: 'Salão dos Espelhos',
    biome: 'aurora',
    desc: 'O antigo observatório das Ruínas de Aurora, onde a luz nunca anda em linha reta.',
    mechanic: 'Espelhos desviam chamas em 90°. Portais ligam as laterais.',
    density: 0.66,
    rows: [
      '###############',
      '#1...........3#',
      '#.x.x.x.x.x.x.#',
      '#.............#',
      '#.x.x/...\\x.x.#',
      '#.....,,,.....#',
      '#t,x..,,,..x,t#',
      '#.....,,,.....#',
      '#.x.x\\.../x.x.#',
      '#.............#',
      '#.x.x.x.x.x.x.#',
      '#4...........2#',
      '###############',
    ],
  },
  {
    id: 'pista',
    name: 'Pista Congelada',
    biome: 'boreal',
    desc: 'O pátio de testes do Laboratório Boreal. O piso foi polido por acidente. Todo dia.',
    mechanic: 'No gelo você desliza até bater. Cargas chutadas no gelo vão longe.',
    density: 0.62,
    rows: [
      '###############',
      '#1...........3#',
      '#.x.x.x.x.x.x.#',
      '#...~~~~~~~...#',
      '#.x.x~x~x~x.x.#',
      '#...~~___~~...#',
      '#.x.x_x_x_x.x.#',
      '#...~~___~~...#',
      '#.x.x~x~x~x.x.#',
      '#...~~~~~~~...#',
      '#.x.x.x.x.x.x.#',
      '#4...........2#',
      '###############',
    ],
  },
  {
    id: 'mata',
    name: 'Coração da Mata',
    biome: 'verdejante',
    desc: 'O salão central do Templo Verdejante, tomado por raízes teimosas.',
    mechanic: 'Trepadeiras destruídas renascem depois de alguns segundos. O mapa nunca abre de vez.',
    density: 0.64,
    vineRatio: 0.45,
    rows: [
      '###############',
      '#1...........3#',
      '#.x.x.x.x.x.x.#',
      '#.....ggg.....#',
      '#.x.xgx,xgx.x.#',
      '#...g.,,,.g...#',
      '#.x.x,x,x,x.x.#',
      '#...g.,,,.g...#',
      '#.x.xgx,xgx.x.#',
      '#.....ggg.....#',
      '#.x.x.x.x.x.x.#',
      '#4...........2#',
      '###############',
    ],
  },
  {
    id: 'doca',
    name: 'Doca Orbital',
    biome: 'orbita',
    desc: 'Plataforma de carga da Estação Órbita-9. Não olhe para baixo.',
    mechanic: 'Abismos engolem cargas chutadas. Portais conectam as laterais.',
    density: 0.62,
    rows: [
      '###############',
      '#1...........3#',
      '#.x.x.x.x.x.x.#',
      '#.............#',
      '#.x.PP.x.PP.x.#',
      '#...PP.,.PP...#',
      '#t,.........,t#',
      '#...PP.,.PP...#',
      '#.x.PP.x.PP.x.#',
      '#.............#',
      '#.x.x.x.x.x.x.#',
      '#4...........2#',
      '###############',
    ],
  },
  {
    id: 'caldeira',
    name: 'Caldeira',
    biome: 'magma',
    desc: 'O salão de forja da Fortaleza Magma. O chão respira fogo em compasso.',
    mechanic: 'Respiradouros acendem a cada 7 s, alternando entre dois grupos. O brilho avisa antes.',
    density: 0.62,
    ventPeriod: 7,
    rows: [
      '###############',
      '#1...........3#',
      '#.x.x.x.x.x.x.#',
      '#.....V.V.....#',
      '#.x.xVx.xVx.x.#',
      '#...V.....V...#',
      '#.x.x.xVx.x.x.#',
      '#...V.....V...#',
      '#.x.xVx.xVx.x.#',
      '#.....V.V.....#',
      '#.x.x.x.x.x.x.#',
      '#4...........2#',
      '###############',
    ],
  },
  {
    id: 'subsolo',
    name: 'Neon Subterrâneo',
    biome: 'neon',
    desc: 'Uma arena clandestina sob a Vila Pavio. As luzes queimaram há anos.',
    mechanic: 'Escuridão: você só enxerga ao seu redor. Pavios e explosões iluminam o salão.',
    density: 0.64,
    dark: true,
    rows: [
      '###############',
      '#1....o.o....3#',
      '#.x.x.x.x.x.x.#',
      '#o...........o#',
      '#.x.x.x.x.x.x.#',
      '#......o......#',
      '#.x.x.xox.x.x.#',
      '#......o......#',
      '#.x.x.x.x.x.x.#',
      '#o...........o#',
      '#.x.x.x.x.x.x.#',
      '#4....o.o....2#',
      '###############',
    ],
  },
];

export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));
