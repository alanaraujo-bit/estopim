// Elenco original de ESTOPIM. Cada personagem = técnica ativa + passiva + limites
// de atributos diferentes (trade-offs). Nenhum é estritamente superior.

export type CharId = 'faisca' | 'tuba' | 'lume' | 'mola' | 'geada' | 'vulto' | 'magna' | 'pira';
export type AbilityId = 'arranque' | 'estrondo' | 'prisma' | 'salto' | 'congelar' | 'sombra' | 'ima' | 'detonar';

export interface CharacterDef {
  id: CharId;
  name: string;
  title: string;
  origin: string;
  bio: string;
  quote: string;
  role: string;
  difficulty: 1 | 2 | 3;
  /** Paleta base: [principal, secundária, detalhe, pele/visor] */
  colors: [string, string, string, string];
  ability: {
    id: AbilityId;
    name: string;
    desc: string;
    cooldown: number; // segundos
  };
  passive: { name: string; desc: string };
  start: { bombs: number; range: number; speed: number; kick: boolean };
  caps: { bombs: number; range: number; speed: number };
  fuseMul: number;
  unlock: { type: 'start' } | { type: 'level'; level: number } | { type: 'campaign'; mission: string };
}

export const CHARACTERS: Record<CharId, CharacterDef> = {
  faisca: {
    id: 'faisca',
    name: 'Faísca',
    title: 'A Entregadora Relâmpago',
    origin: 'Vila Pavio',
    bio: 'Cresceu entregando rojões pelos telhados da Vila Pavio. Nunca chegou atrasada — e nunca saiu de uma explosão pelo mesmo lugar que entrou.',
    quote: 'Se piscar, perdeu.',
    role: 'Mobilidade',
    difficulty: 1,
    colors: ['#ff7a2f', '#ffd166', '#2b2d42', '#ffe1c4'],
    ability: {
      id: 'arranque',
      name: 'Arranque',
      desc: 'Dispara 3 casas à frente em um instante. Durante o arranque, você atravessa chamas sem se ferir.',
      cooldown: 9,
    },
    passive: { name: 'Pés Ligeiros', desc: 'Começa com +1 de Ímpeto, mas o limite de velocidade é menor (4).' },
    start: { bombs: 1, range: 2, speed: 1, kick: false },
    caps: { bombs: 8, range: 8, speed: 4 },
    fuseMul: 1,
    unlock: { type: 'start' },
  },
  tuba: {
    id: 'tuba',
    name: 'Tuba',
    title: 'O Tambor da Fundição',
    origin: 'Fundição Rubra',
    bio: 'Ex-operário da Fundição Rubra, toca bumbo na banda da fábrica e resolve discussões com um único empurrão. Gentil, enorme e barulhento.',
    quote: 'Sente o grave!',
    role: 'Controle',
    difficulty: 1,
    colors: ['#c0392b', '#f4a261', '#3d2b1f', '#8d5a3b'],
    ability: {
      id: 'estrondo',
      name: 'Estrondo',
      desc: 'Bate no bumbo: todas as cargas num raio de 2 casas são arremessadas para longe e adversários colados em você são empurrados.',
      cooldown: 10,
    },
    passive: { name: 'Bico de Aço', desc: 'Chuta cargas desde o início, mas o limite de velocidade é 3.' },
    start: { bombs: 1, range: 2, speed: 0, kick: true },
    caps: { bombs: 8, range: 8, speed: 3 },
    fuseMul: 1,
    unlock: { type: 'start' },
  },
  lume: {
    id: 'lume',
    name: 'Lume',
    title: 'A Oráculo das Ruínas',
    origin: 'Ruínas de Aurora',
    bio: 'Guardiã dos espelhos das Ruínas de Aurora. Enxerga as chamas como luz — e luz, para ela, sempre pode ser dobrada.',
    quote: 'Toda chama tem um caminho.',
    role: 'Defesa',
    difficulty: 2,
    colors: ['#7b5cff', '#5ef2d6', '#1d1640', '#f1e9ff'],
    ability: {
      id: 'prisma',
      name: 'Prisma',
      desc: 'Ergue um prisma de cristal na casa à frente por 5 s. Bloqueia passagem e chamas.',
      cooldown: 12,
    },
    passive: { name: 'Refração', desc: 'Suas chamas atravessam 1 bloco destrutível. Alcance máximo limitado a 6.' },
    start: { bombs: 1, range: 2, speed: 0, kick: false },
    caps: { bombs: 8, range: 6, speed: 5 },
    fuseMul: 1,
    unlock: { type: 'start' },
  },
  mola: {
    id: 'mola',
    name: 'Mola',
    title: 'O Autômato Saltitante',
    origin: 'Estação Órbita-9',
    bio: 'Robô de manutenção que desenvolveu senso de humor depois de um curto-circuito. Pula por cima de tudo, inclusive das regras.',
    quote: 'Boing. Boing? BOING!',
    role: 'Agressão',
    difficulty: 2,
    colors: ['#2ec4b6', '#ffbf69', '#243447', '#e0fbfc'],
    ability: {
      id: 'salto',
      name: 'Salto',
      desc: 'Salta 2 casas à frente, por cima de paredes, blocos e cargas. No ar, nenhuma chama te alcança.',
      cooldown: 8,
    },
    passive: { name: 'Pavio Nervoso', desc: 'Suas cargas explodem 20% mais rápido.' },
    start: { bombs: 1, range: 2, speed: 0, kick: false },
    caps: { bombs: 7, range: 8, speed: 5 },
    fuseMul: 0.8,
    unlock: { type: 'level', level: 3 },
  },
  geada: {
    id: 'geada',
    name: 'Geada',
    title: 'A Cientista do Frio',
    origin: 'Laboratório Boreal',
    bio: 'Pesquisadora-chefe do Laboratório Boreal, estuda como parar o tempo de uma explosão. Por enquanto, consegue parar por três segundos.',
    quote: 'Calma. Frio. Calculado.',
    role: 'Controle',
    difficulty: 3,
    colors: ['#8ecae6', '#ffffff', '#1b3a4b', '#f0f7ff'],
    ability: {
      id: 'congelar',
      name: 'Congelar',
      desc: 'Congela todas as cargas num raio de 2 casas por 3 s: o pavio para e elas não detonam em cadeia.',
      cooldown: 11,
    },
    passive: { name: 'Rastro Gélido', desc: 'Onde suas chamas passam, o chão fica gelado e desacelera adversários por 2 s.' },
    start: { bombs: 1, range: 2, speed: 0, kick: false },
    caps: { bombs: 8, range: 7, speed: 5 },
    fuseMul: 1,
    unlock: { type: 'campaign', mission: '3-6' },
  },
  vulto: {
    id: 'vulto',
    name: 'Vulto',
    title: 'O Mensageiro das Sombras',
    origin: 'Neon Subterrâneo',
    bio: 'Ninguém sabe o nome verdadeiro dele. Entrega recados no Neon Subterrâneo e desaparece antes que alguém pergunte quem mandou.',
    quote: '…',
    role: 'Emboscada',
    difficulty: 3,
    colors: ['#3a0ca3', '#f72585', '#10002b', '#c8b6ff'],
    ability: {
      id: 'sombra',
      name: 'Sombra',
      desc: 'Fica invisível por 4 s. Adversários só percebem um leve tremular quando você se move.',
      cooldown: 14,
    },
    passive: { name: 'Pavio Oculto', desc: 'Adversários não veem o anel de contagem das suas cargas.' },
    start: { bombs: 1, range: 2, speed: 0, kick: false },
    caps: { bombs: 7, range: 7, speed: 6 },
    fuseMul: 1,
    unlock: { type: 'level', level: 8 },
  },
  magna: {
    id: 'magna',
    name: 'Magna',
    title: 'A Sucateira Magnética',
    origin: 'Fundição Rubra',
    bio: 'Montou a própria mochila-ímã com peças da sucata da Fundição. Coleciona tudo que é de metal — inclusive cargas alheias.',
    quote: 'Isso aí agora é meu.',
    role: 'Armadilha',
    difficulty: 2,
    colors: ['#e63946', '#a8dadc', '#1d3557', '#ffddd2'],
    ability: {
      id: 'ima',
      name: 'Ímã',
      desc: 'Puxa a primeira carga em linha reta à frente (até 7 casas) até ela parar perto de você.',
      cooldown: 9,
    },
    passive: { name: 'Coletora', desc: 'Coleta Brasas a 1 casa de distância.' },
    start: { bombs: 1, range: 2, speed: 0, kick: false },
    caps: { bombs: 8, range: 8, speed: 5 },
    fuseMul: 1,
    unlock: { type: 'level', level: 5 },
  },
  pira: {
    id: 'pira',
    name: 'Pirá',
    title: 'O Dançarino da Piracema',
    origin: 'Templo Verdejante',
    bio: 'Dança nas festas do rio do Templo Verdejante com fitas em chamas. Sabe exatamente quando cada fogo deve acender — e acende todos juntos.',
    quote: 'No meu tempo, no meu ritmo.',
    role: 'Explosivo',
    difficulty: 2,
    colors: ['#06d6a0', '#ffd23f', '#073b4c', '#f4c095'],
    ability: {
      id: 'detonar',
      name: 'Ritmo',
      desc: 'Detona na hora todas as suas cargas em campo, em sequência rápida.',
      cooldown: 12,
    },
    passive: { name: 'Fitas Longas', desc: 'Começa com alcance 3, mas carrega no máximo 6 cargas.' },
    start: { bombs: 1, range: 3, speed: 0, kick: false },
    caps: { bombs: 6, range: 8, speed: 5 },
    fuseMul: 1,
    unlock: { type: 'campaign', mission: '5-6' },
  },
};

export const CHAR_ORDER: CharId[] = ['faisca', 'tuba', 'lume', 'mola', 'magna', 'geada', 'vulto', 'pira'];
