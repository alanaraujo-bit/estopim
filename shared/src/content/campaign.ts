import type { CharId } from './characters';
import type { Biome, MapDef } from './maps';
import type { Reward } from './progression';

// Legenda extra de missões (além da legenda de mapas):
//  inimigos: r rastejo · f farejador · m minador · q bastião · a acólito · s sentinela · e esporo
//            w vigia · d reparador · k piscante · z salamandra · G gatuno · N escolta/estrutura
//  n ponto de reforço (ondas) · O âncora do chefe · H chefe
//  itens: i bloco com fragmento · j fragmento no chão · U parede rachada com relíquia
//         y coração no chão · Y cartucho no chão · R bloco c/ alcance · K bloco c/ chute · $ bloco c/ carga extra

export type Goal =
  | { k: 'exit' }
  | { k: 'targets'; n?: number; label: string }
  | { k: 'collect'; n: number; label: string }
  | { k: 'kill'; n?: number; type?: string; label: string }
  | { k: 'survive'; s: number; label: string }
  | { k: 'protect'; label: string; hp: number }
  | { k: 'escort'; label: string; hp: number }
  | { k: 'thief'; label: string; escapeAfter: number }
  | { k: 'boss'; label: string }
  | { k: 'plates'; label: string };

export type StarDef =
  | { k: 'time'; s: number }
  | { k: 'nodamage' }
  | { k: 'relic' }
  | { k: 'unseen' }
  | { k: 'bombs'; n: number }
  | { k: 'kills'; n: number }
  | { k: 'intact' };

export interface Line {
  who: string;
  text: string;
}

export interface Tip {
  when: 'start' | 'near-block' | 'bomb' | 'item' | 'enemy' | 'barrel' | 'exit-open' | 'damage' | 'ability' | 'kick' | 'ice' | 'mirror' | 'plate';
  text: string;
  touch?: string;
}

export interface MissionDef {
  id: string;
  chapter: number;
  index: number;
  name: string;
  summary: string;
  briefing: string;
  intro: Line[];
  outro?: Line[];
  map: MapDef;
  hp: number;
  start?: { bombs?: number; range?: number; speed?: number; kick?: boolean; cart?: number; charges?: number };
  items?: Record<number, number>;
  cartPool?: number[];
  goals: Goal[];
  stars: [StarDef, StarDef];
  timeLimit?: number;
  budget?: number; // limite de cargas
  boss?: string;
  requires?: string;
  reward?: Reward;
  tips?: Tip[];
  special?: Record<string, any>;
}

export interface ChapterDef {
  n: number;
  name: string;
  biome: Biome;
  blurb: string;
  villain: string;
}

export const CHAPTERS: ChapterDef[] = [
  { n: 1, name: 'A Festa Interrompida', biome: 'vila', blurb: 'Na noite de abertura do Circuito Estopim, a Grande Centelha se apaga. Alguém a roubou.', villain: 'Rojão-Mor' },
  { n: 2, name: 'Ferrugem', biome: 'fundicao', blurb: 'As máquinas da Fundição Rubra acordaram com fragmentos da Centelha no peito — e com más intenções.', villain: 'Caldeirão' },
  { n: 3, name: 'Criostase', biome: 'boreal', blurb: 'O Laboratório Boreal congelou por dentro. A cientista Geada ficou presa com a IA que ela mesma criou.', villain: 'Criostase' },
  { n: 4, name: 'A Luz Dobrada', biome: 'aurora', blurb: 'Nas Ruínas de Aurora, um oráculo partido guarda o maior fragmento. Ele só pode ser ferido pela luz refletida.', villain: 'Oráculo Partido' },
  { n: 5, name: 'Raízes', biome: 'verdejante', blurb: 'O Templo Verdejante foi engolido por uma planta faminta de fogo. O povo do rio precisa de ajuda.', villain: 'Mãe-Raiz' },
  { n: 6, name: 'O Apagão', biome: 'magma', blurb: 'Na Fortaleza Magma, o Arconte do Apagão quer uma noite que nunca termine. Traga a Centelha de volta.', villain: 'O Arconte' },
];

const m = (id: string, name: string, biome: Biome, rows: string[], extra: Partial<MapDef> = {}): MapDef => ({
  id: 'm' + id,
  name,
  biome,
  desc: '',
  mechanic: '',
  rows,
  density: 0.55,
  ...extra,
});

const GRID = (r1: string, r3: string, r5: string, r7: string, r9: string, r11: string): string[] => [
  '#################',
  r1,
  '#.x.x.x.x.x.x.x.#',
  r3,
  '#.x.x.x.x.x.x.x.#',
  r5,
  '#.x.x.x.x.x.x.x.#',
  r7,
  '#.x.x.x.x.x.x.x.#',
  r9,
  '#.x.x.x.x.x.x.x.#',
  r11,
  '#################',
];

export const MISSIONS: MissionDef[] = [
  // ═══════════════════════ CAPÍTULO 1 — VILA PAVIO ═══════════════════════
  {
    id: '1-1',
    chapter: 1,
    index: 1,
    name: 'Primeiro Pavio',
    summary: 'Abra caminho até o palco da festa.',
    briefing: 'A festa parou quando a Centelha se apagou. Atravesse a praça, abra caminho entre as caixas de rojão e chegue ao palco.',
    intro: [
      { who: 'Vó Candeia', text: 'Faísca! A Centelha apagou bem na abertura do Circuito. Alguém a arrancou da torre!' },
      { who: 'Faísca', text: 'Deixa comigo, Vó. Eu chego no palco antes do próximo rojão.' },
      { who: 'Vó Candeia', text: 'Lembre do básico: carga no chão, e você fora da cruz de fogo.' },
    ],
    outro: [{ who: 'Vó Candeia', text: 'Muito bem! Mas olhe só… as caixas de rojão estão corrompidas. Tem coisa pior vindo aí.' }],
    map: m('1-1', 'Praça do Coreto', 'vila', [
      '#################',
      '#1,,b,,b,,,b,,,,#',
      '#,x,x$x,xbx,xUx,#',
      '#b,,,,b,,,o,,,,,#',
      '#,x,xRx,x,x,x,x,#',
      '#,,b,,,,,oo,,,r,#',
      '#bxbx,x,x,x,x,x,#',
      '#,,,,,b,,,,,,,,,#',
      '#,x,x,xbx,xhx,x,#',
      '#,,,b,,,,,,,,r,,#',
      '#,x,x,x,x,x,x,x,#',
      '#,,,,,,b,,,,,,,E#',
      '#################',
    ]),
    hp: 3,
    goals: [{ k: 'exit' }],
    stars: [{ k: 'time', s: 75 }, { k: 'relic' }],
    tips: [
      { when: 'start', text: 'Ande com WASD ou as setas.', touch: 'Arraste o polegar esquerdo para andar.' },
      { when: 'near-block', text: 'Solte uma carga com ESPAÇO perto das caixas — e saia da linha do fogo!', touch: 'Toque no botão de carga perto das caixas — e saia da linha do fogo!' },
      { when: 'bomb', text: 'A explosão sai em cruz. Dobre a esquina para se proteger.' },
      { when: 'item', text: 'Brasas deixam você mais forte. Passe por cima para pegar.' },
      { when: 'barrel', text: 'Barris de rojão explodem em cadeia. Use isso a seu favor.' },
      { when: 'enemy', text: 'Inimigos te ferem ao encostar. Explosões resolvem.' },
      { when: 'exit-open', text: 'O palco está logo ali!' },
    ],
  },
  {
    id: '1-2',
    chapter: 1,
    index: 2,
    name: 'Barris na Praça',
    summary: 'Destrua os 5 rojões corrompidos.',
    briefing: 'Fragmentos da Centelha corromperam cinco caixas de rojão. Elas estão atraindo criaturas de ferrugem. Destrua todas.',
    intro: [
      { who: 'Tuba', text: 'Faísca! Os rojões da festa ficaram roxos e estão zumbindo. Isso não é normal.' },
      { who: 'Faísca', text: 'Então a gente estoura antes que eles estourem a gente.' },
    ],
    map: m(
      '1-2',
      'Praça dos Barris',
      'vila',
      GRID('#1,.....o.....*,#', '#......o*o......#', '#..*.......r....#', '#.......r.....o.#', '#.o.....*....f..#', '#r......o.....*r#'),
      { density: 0.5 },
    ),
    hp: 3,
    goals: [{ k: 'targets', label: 'Rojões corrompidos' }],
    stars: [{ k: 'time', s: 100 }, { k: 'nodamage' }],
    tips: [{ when: 'barrel', text: 'Um barril perto de um alvo resolve dois problemas de uma vez.' }],
  },
  {
    id: '1-3',
    chapter: 1,
    index: 3,
    name: 'Pega-Ladrão',
    summary: 'Encurrale o Gatuno antes que ele fuja.',
    briefing: 'Um robô ladrão está carregando um fragmento da Centelha. Ele é rápido e esperto: preveja o caminho dele e feche a saída com fogo.',
    intro: [
      { who: 'Vó Candeia', text: 'Ali! Aquele Gatuno está com um pedaço da Centelha!' },
      { who: 'Faísca', text: 'Correr atrás não adianta. Tenho que chegar onde ele vai estar.' },
    ],
    map: m('1-3', 'Becos da Vila', 'vila', [
      '#################',
      '#1,,..........,E#',
      '#,x.x.x.x.x.x.x,#',
      '#,......o......,#',
      '#.x.x.xbx.x.x.x.#',
      '#.....,,,,,.....#',
      '#.x.x,x,G,x,x.x.#',
      '#.....,,,,,.....#',
      '#.x.x.xbx.x.x.x.#',
      '#,......o......,#',
      '#,x.x.x.x.x.x.x,#',
      '#,,............r#',
      '#################',
    ], { density: 0.45 }),
    hp: 3,
    start: { bombs: 2, range: 2 },
    goals: [{ k: 'thief', label: 'Capture o Gatuno', escapeAfter: 70 }],
    stars: [{ k: 'time', s: 45 }, { k: 'nodamage' }],
    tips: [{ when: 'start', text: 'O Gatuno foge de você. Solte cargas onde ele VAI passar.' }],
  },
  {
    id: '1-4',
    chapter: 1,
    index: 4,
    name: 'Noite Sem Luz',
    summary: 'Acenda os 6 lampiões no escuro.',
    briefing: 'Sem a Centelha, a Vila mergulhou no breu. Acenda os lampiões com explosões — cada um ilumina um pedaço da praça.',
    intro: [
      { who: 'Tuba', text: 'Não enxergo nem meu bumbo. Cadê a luz?' },
      { who: 'Faísca', text: 'Os lampiões ainda têm pavio. Uma faísca em cada um e a gente volta a ver.' },
    ],
    map: m(
      '1-4',
      'Praça Escura',
      'vila',
      ['#################', '#1,....*.......*#', '#,x.x.x.x.x.x.x.#', '#.......r.......#', '#*x.x.x.x.x.x.x.#', '#.....o...o.....#', '#.x.x.x*x.x.x.x.#', '#...f.......f...#', '#.x.x.x.x.x.x.x*#', '#.......o.......#', '#.x.x.x.x.x.x.x.#', '#*.....r.......r#', '#################'],
      { dark: true, density: 0.45 },
    ),
    hp: 3,
    goals: [{ k: 'targets', label: 'Lampiões acesos' }],
    stars: [{ k: 'time', s: 120 }, { k: 'nodamage' }],
    special: { lamps: true },
  },
  {
    id: '1-5',
    chapter: 1,
    index: 5,
    name: 'Defenda o Coreto',
    summary: 'Proteja o coreto por 90 segundos.',
    briefing: 'O coreto guarda a banda da Vila. Máquinas de ferrugem vão tentar derrubá-lo. Cuidado: suas explosões também o atingem.',
    intro: [
      { who: 'Tuba', text: 'A banda se escondeu no coreto! Se ele cair, adeus forró.' },
      { who: 'Faísca', text: 'Ninguém encosta no coreto. Nem eu.' },
    ],
    map: m('1-5', 'Coreto', 'vila', ['#################', '#1.............,#', '#.x.x.x.x.x.x.x.#', '#.......,.......#', '#.x.x.x,x,x.x.x.#', '#.....,,,,,.....#', '#.x.x,x,N,x,x.x.#', '#.....,,,,,.....#', '#.x.x.x,x,x.x.x.#', '#.......,.......#', '#.x.x.x.x.x.x.x.#', '#n,...........,n#', '#################'], {
      density: 0.4,
    }),
    hp: 3,
    start: { bombs: 2, range: 2 },
    goals: [
      { k: 'survive', s: 90, label: 'Resista' },
      { k: 'protect', label: 'Coreto', hp: 6 },
    ],
    stars: [{ k: 'intact' }, { k: 'nodamage' }],
    special: { waves: [['rastejo', 'rastejo'], ['farejador', 'rastejo'], ['minador', 'rastejo', 'rastejo'], ['farejador', 'farejador', 'minador'], ['rastejo', 'rastejo', 'farejador', 'minador']], waveEvery: 16, npc: 'coreto' },
  },
  {
    id: '1-6',
    chapter: 1,
    index: 6,
    name: 'Rojão-Mor',
    summary: 'Chefe: derrube o gigante pirotécnico.',
    briefing: 'Um foguete gigante corrompido desceu do céu. Ele dispara rojões e mergulha sobre você. Quando pousar, fica tonto: é a sua chance.',
    intro: [
      { who: '???', text: 'FSSSSSSSSSS…' },
      { who: 'Vó Candeia', text: 'É o Rojão-Mor, o foguete da abertura! O fragmento dentro dele o enlouqueceu!' },
      { who: 'Faísca', text: 'Onde ele pousar, eu deixo um presente esperando.' },
    ],
    outro: [
      { who: 'Vó Candeia', text: 'O fragmento… está quente. Veio da Fundição Rubra. Quem roubou a Centelha espalhou os pedaços pelo mundo.' },
      { who: 'Tuba', text: 'A Fundição? É minha casa. Eu vou junto.' },
    ],
    map: m('1-6', 'Céu da Vila', 'vila', ['#################', '#,,,,,,,H,,,,,,,#', '#,x,,,x,,,x,,,x,#', '#,,,b,,,,,,,b,,,#', '#,,,,,,,,,,,,,,,#', '#,x,,,x,,,x,,,x,#', '#,,b,,,,,,,,,b,,#', '#,,,,,,,,,,,,,,,#', '#,x,,,x,,,x,,,x,#', '#,,,b,,,,,,,b,,,#', '#,,,,,,,,,,,,,,,#', '#,,,,,,,1,,,,,,,#', '#################']),
    hp: 4,
    start: { bombs: 3, range: 3, speed: 1 },
    goals: [{ k: 'boss', label: 'Rojão-Mor' }],
    stars: [{ k: 'time', s: 150 }, { k: 'nodamage' }],
    boss: 'rojao',
    reward: { sparks: 300 },
    tips: [{ when: 'start', text: 'O alvo no chão mostra onde ele vai pousar. Deixe uma carga lá!' }],
  },

  // ═══════════════════════ CAPÍTULO 2 — FUNDIÇÃO RUBRA ═══════════════════════
  {
    id: '2-1',
    chapter: 2,
    index: 1,
    name: 'Linha de Montagem',
    summary: 'Destrua os 4 geradores usando as esteiras.',
    briefing: 'Os geradores alimentam as máquinas corrompidas. Chute cargas nas esteiras e deixe a fábrica entregá-las para você.',
    intro: [
      { who: 'Tuba', text: 'Essas esteiras levam qualquer coisa pra qualquer lugar. Inclusive cargas acesas.' },
      { who: 'Faísca', text: 'Entrega expressa de fogo. Gostei.' },
    ],
    map: m('2-1', 'Esteira Principal', 'fundicao', [
      '#################',
      '#1,,..>>>>>>v..*#',
      '#,x.x.x.x.x.xvx.#',
      '#............v..#',
      '#.x.x.x.x.x.xvx.#',
      '#*.<<<<<<<<<<v..#',
      '#.x.x.x.x.x.xvx.#',
      '#.......r....v..#',
      '#.x.x.x.x.x.xvx.#',
      '#..>>>>>>>>>>>*.#',
      '#.x.x.x.x.x.x.x.#',
      '#*.............f#',
      '#################',
    ], { density: 0.4 }),
    hp: 3,
    start: { bombs: 2, range: 2, kick: true },
    goals: [{ k: 'targets', label: 'Geradores' }],
    stars: [{ k: 'time', s: 110 }, { k: 'bombs', n: 12 }],
    tips: [{ when: 'start', text: 'Você está com a Bota de Chute: ande contra uma carga para chutá-la.' }],
  },
  {
    id: '2-2',
    chapter: 2,
    index: 2,
    name: 'Prensas',
    summary: 'Atravesse o salão das prensas.',
    briefing: 'As prensas batem num ritmo constante. Observe o aviso no chão e passe no intervalo.',
    intro: [{ who: 'Tuba', text: 'É só seguir o compasso: TUM… pausa… TUM. Igual forró.' }],
    map: m('2-2', 'Salão das Prensas', 'fundicao', [
      '#####################',
      '#,,,,#ccc#,,,#ccc#,E#',
      '#1,,,,ccc,,,,,ccc,,,#',
      '#,,b,#ccc#.b.#ccc#,,#',
      '#####,,,,#.r.#,,,,###',
      '#,ccc,,,,f,,,,,ccc,,#',
      '#,ccc,,,,,,,,,,ccc,,#',
      '####,,,#.b.#,,,,#####',
      '#,,,,,,#ccc#,,,m,,,,#',
      '#,,,o,,,ccc,,,,,,,,,#',
      '#####################',
    ], { density: 0.4 }),
    hp: 3,
    start: { bombs: 2, range: 2 },
    goals: [{ k: 'exit' }],
    stars: [{ k: 'time', s: 60 }, { k: 'nodamage' }],
    special: { presses: 3.2 },
  },
  {
    id: '2-3',
    chapter: 2,
    index: 3,
    name: 'Sucata Viva',
    summary: 'Derrote os 3 Bastiões blindados.',
    briefing: 'Bastiões têm um escudo na frente que bloqueia explosões. Ataque pelos lados ou por trás.',
    intro: [
      { who: 'Tuba', text: 'Esses aí eram as empilhadeiras da fábrica. Agora têm escudo e raiva.' },
      { who: 'Faísca', text: 'Todo escudo tem costas.' },
    ],
    map: m('2-3', 'Pátio de Sucata', 'fundicao', GRID('#1,.....q.......#', '#.....r.........#', '#.....f.....q...#', '#...............#', '#..r......f.....#', '#......q.......,#'), { density: 0.45 }),
    hp: 3,
    start: { bombs: 2, range: 2 },
    goals: [{ k: 'kill', type: 'bastiao', n: 3, label: 'Bastiões' }],
    stars: [{ k: 'time', s: 150 }, { k: 'nodamage' }],
    reward: { item: 'cubo' },
    tips: [{ when: 'enemy', text: 'O escudo do Bastião bloqueia chamas vindas da frente. Flanqueie!' }],
  },
  {
    id: '2-4',
    chapter: 2,
    index: 4,
    name: 'Turno da Noite',
    summary: 'Sobreviva 120 segundos.',
    briefing: 'A fábrica inteira acordou. Segure a posição até o turno acabar.',
    intro: [{ who: 'Tuba', text: 'Sirene de turno! Vem aí todo mundo de uma vez!' }],
    map: m('2-4', 'Anel de Esteiras', 'fundicao', [
      '#################',
      '#1.............n#',
      '#.x.x.x.x.x.x.x.#',
      '#....>>>>>>v....#',
      '#.x.x^x.x.xvx.x.#',
      '#....^.....v....#',
      '#.x.x^x.x.xvx.x.#',
      '#....^.....v....#',
      '#.x.x^x.x.xvx.x.#',
      '#....^<<<<<<....#',
      '#.x.x.x.x.x.x.x.#',
      '#n.............n#',
      '#################',
    ], { density: 0.35 }),
    hp: 3,
    start: { bombs: 2, range: 2 },
    goals: [{ k: 'survive', s: 120, label: 'Resista' }],
    stars: [{ k: 'nodamage' }, { k: 'kills', n: 12 }],
    special: { waves: [['rastejo', 'rastejo'], ['farejador', 'rastejo'], ['bastiao', 'rastejo'], ['farejador', 'farejador'], ['minador', 'rastejo', 'rastejo'], ['bastiao', 'farejador'], ['farejador', 'farejador', 'minador'], ['bastiao', 'bastiao', 'rastejo']], waveEvery: 14 },
  },
  {
    id: '2-5',
    chapter: 2,
    index: 5,
    name: 'Esteira de Fuga',
    summary: 'Fuja antes que a fábrica desabe!',
    briefing: 'O teto da fundição está caindo atrás de você. Não pare de correr.',
    intro: [{ who: 'Tuba', text: 'O TETO! CORRE, FAÍSCA, CORRE!' }],
    map: m('2-5', 'Corredor de Fuga', 'fundicao', ['#########################', '#1,.b..b...>>>>..b...,,E#', '#,x.x.x.x.x.x.x.x.x.x.x,#', '#,..b...<<<<....b..r...,#', '#,x.x.x.x.x.x.x.x.x.x.x,#', '#,....b....f...>>>>...b,#', '#,x.x.x.x.x.x.x.x.x.x.x,#', '#,,.........b.........,,#', '#########################'], { density: 0.45 }),
    hp: 3,
    start: { bombs: 2, range: 3, speed: 1 },
    goals: [{ k: 'exit' }],
    stars: [{ k: 'time', s: 60 }, { k: 'nodamage' }],
    special: { chase: { dir: 'right', start: 4, every: 2.3 } },
  },
  {
    id: '2-6',
    chapter: 2,
    index: 6,
    name: 'Caldeirão',
    summary: 'Chefe: esfrie o coração da Fundição.',
    briefing: 'O Caldeirão é a fornalha-mãe da Fundição. Quando superaquece, abre as grelhas e fica vulnerável. Acerte uma explosão nele nessa hora.',
    intro: [
      { who: 'Tuba', text: 'O Caldeirão… meu avô ajudou a construir. Agora tem um fragmento no lugar do coração.' },
      { who: 'Faísca', text: 'Vamos devolver ele ao normal. Com carinho. E muita pólvora.' },
    ],
    outro: [
      { who: 'Tuba', text: 'Ele esfriou. Obrigado, amigo velho.' },
      { who: 'Faísca', text: 'O fragmento está gelado. Isso veio do Norte… do Laboratório Boreal.' },
    ],
    map: m('2-6', 'Coração da Fundição', 'fundicao', ['#################', '#,,,,,,,,,,,,,,,#', '#,x,x,x,H,x,x,x,#', '#,,,,,,,,,,,,,,,#', '#,x,x,x,,,x,x,x,#', '#,,,b,,,,,,,b,,,#', '#,x,x,x,x,x,x,x,#', '#,,,,,,,,,,,,,,,#', '#,x,xbx,x,xbx,x,#', '#,,,,,,,,,,,,,,,#', '#,x,x,x,x,x,x,x,#', '#,,,,,,,1,,,,,,,#', '#################']),
    hp: 4,
    start: { bombs: 3, range: 3, speed: 1, kick: true },
    goals: [{ k: 'boss', label: 'Caldeirão' }],
    stars: [{ k: 'time', s: 160 }, { k: 'nodamage' }],
    boss: 'caldeirao',
    reward: { item: 'tuba-ferrugem' },
  },

  // ═══════════════════════ CAPÍTULO 3 — LABORATÓRIO BOREAL ═══════════════════════
  {
    id: '3-1',
    chapter: 3,
    index: 1,
    name: 'Pista de Testes',
    summary: 'Recolha 5 fragmentos no gelo.',
    briefing: 'No gelo você desliza até bater em algo. Planeje cada movimento e use os obstáculos como freio.',
    intro: [
      { who: 'Lume', text: 'Vocês vieram pelo fragmento frio? Eu também. As Ruínas sentem quando a luz some.' },
      { who: 'Faísca', text: 'Mais uma! Bem-vinda à equipe, Lume. Cuidado com o chão.' },
    ],
    map: m('3-1', 'Pista Polida', 'boreal', ['#################', '#1,~~~~~j~~~~~,j#', '#,x~x~x~x~x~x~x~#', '#~~~~~~~~~~~b~~~#', '#~x~x~x~x~x~x~x~#', '#~~~b~~~~j~~~~~~#', '#~x~x~x~x~x~x~x~#', '#~~~~~~~r~~~~b~~#', '#~x~x~x~x~x~x~x~#', '#j~~~~b~~~~~~~~~#', '#~x~x~x~x~x~x~x~#', '#~~~~~~~~~~~r~~j#', '#################'], { density: 0.18 }),
    hp: 3,
    start: { bombs: 2, range: 2 },
    goals: [{ k: 'collect', n: 5, label: 'Fragmentos' }],
    stars: [{ k: 'time', s: 60 }, { k: 'nodamage' }],
    tips: [{ when: 'ice', text: 'No gelo você só para quando bate. Use colunas e blocos como freio.' }],
  },
  {
    id: '3-2',
    chapter: 3,
    index: 2,
    name: 'Contenção',
    summary: 'Liberte os 4 pesquisadores das cápsulas.',
    briefing: 'Acólitos do Frio mantêm pesquisadores presos em cápsulas. Eles disparam estilhaços de gelo em linha reta: não fique alinhado por muito tempo.',
    intro: [{ who: 'Lume', text: 'Aqueles encapuzados… estão carregando gelo nas mãos. Saia da mira deles.' }],
    map: m('3-2', 'Ala de Contenção', 'boreal', GRID('#1,......*.....a#', '#...a...........#', '#*.......r.....*#', '#...............#', '#......a....r...#', '#,.......*......#'), { density: 0.45 }),
    hp: 3,
    start: { bombs: 2, range: 2 },
    goals: [{ k: 'targets', label: 'Cápsulas abertas' }],
    stars: [{ k: 'time', s: 120 }, { k: 'nodamage' }],
    tips: [{ when: 'enemy', text: 'Acólitos brilham antes de atirar. Saia da linha deles!' }],
  },
  {
    id: '3-3',
    chapter: 3,
    index: 3,
    name: 'Câmaras Frias',
    summary: 'Quebre 6 cristais com no máximo 8 cargas.',
    briefing: 'Recursos contados. Use barris e reações em cadeia para quebrar os cristais sem desperdiçar cargas.',
    intro: [{ who: 'Lume', text: 'Aqui não tem Brasa sobrando. Pense antes de acender.' }],
    map: m('3-3', 'Câmara Fria', 'boreal', ['#################', '#1,,,,,o,*,,,,,,#', '#,x,x,x,x,xox,x,#', '#,,,*,o,,,,,,,,,#', '#,x,x,x,x,x,x,x,#', '#,,,,,,,,o,,*,,,#', '#,xox,x,x,x,x,x,#', '#,,*,,,,,o,,,,,,#', '#,x,x,x,x,x,x,x,#', '#,,,,,,o,,,,,,*,#', '#,x,x,x,x,x,x,x,#', '#,,,,,,,,,*,,,,,#', '#################']),
    hp: 3,
    start: { bombs: 2, range: 3 },
    items: {},
    goals: [{ k: 'targets', label: 'Cristais' }],
    budget: 8,
    stars: [{ k: 'bombs', n: 6 }, { k: 'time', s: 70 }],
  },
  {
    id: '3-4',
    chapter: 3,
    index: 4,
    name: 'Sentinelas',
    summary: 'Chegue ao terminal sem ser visto.',
    briefing: 'Sentinelas giram e vigiam em linha reta. Se te virem, disparam o alarme e chamam reforços. Use os blocos como cobertura.',
    intro: [{ who: 'Lume', text: 'Aqueles olhos vermelhos giram devagar. Conte o tempo e passe por trás.' }],
    map: m('3-4', 'Corredor Vigiado', 'boreal', ['#################', '#1,,b,,,,,,,,s,E#', '#,x,x,x,xbx,x,x,#', '#,,,,,s,,,,,,,,,#', '#bx,x,xbx,x,x,x,#', '#,,,,,,,,,b,,,,,#', '#,x,xbx,x,x,x,xb#', '#,,,,,,,,s,,,,,,#', '#,xbx,x,x,x,xbx,#', '#,,,,,,b,,,,,,,,#', '#,x,x,x,x,x,xbx,#', '#,,,,s,,,,,,,,,,#', '#################']),
    hp: 3,
    start: { bombs: 2, range: 2 },
    goals: [{ k: 'exit' }],
    stars: [{ k: 'unseen' }, { k: 'time', s: 90 }],
    reward: { item: 'neve' },
    tips: [{ when: 'start', text: 'O feixe da sentinela mostra para onde ela olha. Fique fora dele.' }],
  },
  {
    id: '3-5',
    chapter: 3,
    index: 5,
    name: 'Degelo',
    summary: 'Escolte o drone aquecedor até a saída.',
    briefing: 'O drone aquecedor derrete o caminho até a Criostase, mas não consegue atravessar paredes de gelo. Abra passagem e proteja-o dos Acólitos — e das suas próprias chamas.',
    intro: [
      { who: 'Geada (rádio)', text: 'Alguém aí? Aqui é a Geada, presa no núcleo! Mandei o Aquecedor ao seu encontro. Por favor, não explodam ele.' },
      { who: 'Faísca', text: 'Não prometo nada, mas vou tentar!' },
    ],
    map: m('3-5', 'Corredores Congelados', 'boreal', ['#################', '#1N,h,,,,,,,,,,,#', '#,x,x,xhx,x,x,x,#', '#,,,,,,,,,hh,a,,#', '#hx,x,x,x,x,x,x,#', '#,,,a,,,h,,,,,,h#', '#,x,x,x,x,xhx,x,#', '#,,,h,,,,,,,,a,,#', '#,xhx,x,x,x,x,x,#', '#,,,,,,,h,,,,,,,#', '#,x,x,x,x,x,x,xh#', '#,,,,,,a,,,,,,,E#', '#################']),
    hp: 3,
    start: { bombs: 2, range: 2 },
    goals: [{ k: 'escort', label: 'Drone aquecedor', hp: 5 }],
    stars: [{ k: 'intact' }, { k: 'time', s: 150 }],
    special: { npc: 'aquecedor' },
  },
  {
    id: '3-6',
    chapter: 3,
    index: 6,
    name: 'Criostase',
    summary: 'Chefe: desligue a IA congelante.',
    briefing: 'A Criostase congela qualquer carga colocada perto dela. Chute cargas de longe pelo gelo: cargas em movimento não congelam.',
    intro: [
      { who: 'Criostase', text: 'TEMPERATURA IDEAL: ZERO ABSOLUTO. MOVIMENTO: DESNECESSÁRIO.' },
      { who: 'Geada (rádio)', text: 'Ela congela tudo que para perto dela. Mas o que desliza… passa!' },
    ],
    outro: [
      { who: 'Geada', text: 'Obrigada. Eu criei a Criostase para proteger o laboratório, não para isso.' },
      { who: 'Geada', text: 'O fragmento dentro dela era luz pura. Ele veio das Ruínas de Aurora. Eu vou com vocês.' },
    ],
    map: m('3-6', 'Núcleo Criogênico', 'boreal', ['#################', '#1,,,,,,,,,,,,,,#', '#,x,x,x,x,x,x,x,#', '#,,___________,,#', '#,x_x_x___x_x_x,#', '#,,___________,,#', '#,x_____H_____x,#', '#,,___________,,#', '#,x_x_x___x_x_x,#', '#,,___________,,#', '#,x,x,x,x,x,x,x,#', '#,,,,,,,,,,,,,,,#', '#################']),
    hp: 4,
    start: { bombs: 3, range: 3, speed: 1, kick: true },
    goals: [{ k: 'boss', label: 'Criostase' }],
    stars: [{ k: 'time', s: 170 }, { k: 'nodamage' }],
    boss: 'criostase',
    reward: { char: 'geada', item: 'cristal' },
  },

  // ═══════════════════════ CAPÍTULO 4 — RUÍNAS DE AURORA ═══════════════════════
  {
    id: '4-1',
    chapter: 4,
    index: 1,
    name: 'Espelhos Antigos',
    summary: 'Atinja 4 alvos só alcançáveis por reflexo.',
    briefing: 'Os espelhos de Aurora dobram as chamas em 90°. Os alvos estão atrás de abismos: só a luz refletida chega até eles.',
    intro: [
      { who: 'Lume', text: 'Estas são as minhas ruínas. Cada espelho tem um ângulo. Leia o ângulo, e o fogo obedece.' },
      { who: 'Geada', text: 'Ótica aplicada a explosivos. Finalmente uma aula interessante.' },
    ],
    map: m('4-1', 'Galeria dos Espelhos', 'aurora', ['#################', '#1,,,,......,,,\\#', '#,x.x.x.x.x.x.xP#', '#,.....#*#..k.#*#', '#.U.x.x.P.x.x.x##', '#,,,,,,,/,,,,,,,#', '#.x.x.x.P.x.x.x.#', '#.r....#*#......#', '##x.x.x.x.x.x.x.#', '#*#.....k.......#', '#Px.x.x.x.x.x.x.#', '#\\,,,,,,,,,,,,,,#', '#################'], { density: 0.35 }),
    hp: 3,
    start: { bombs: 2, range: 3 },
    goals: [{ k: 'targets', label: 'Alvos de luz' }],
    stars: [{ k: 'time', s: 100 }, { k: 'relic' }],
    tips: [{ when: 'mirror', text: 'Chamas que batem num espelho viram 90°. Siga a linha com os olhos antes de acender.' }],
  },
  {
    id: '4-2',
    chapter: 4,
    index: 2,
    name: 'Portais',
    summary: 'Recolha 4 fragmentos nas câmaras seladas.',
    briefing: 'As câmaras das Ruínas só se conectam por portais. Descubra para onde cada um leva.',
    intro: [{ who: 'Lume', text: 'Os portais foram feitos para os sacerdotes. Hoje, para nós.' }],
    map: m('4-2', 'Câmaras Seladas', 'aurora', ['#################', '#1,,..t,#,t....j#', '#,x.x.x.#.x.x.x.#', '#.....j.#...k...#', '#.x.x.x.#.x.x.x.#', '#..r....#......t#', '#################', '#.......#......t#', '#.x.x.x.#.x.x.x.#', '#...j...#..k....#', '#.x.x.x.#.x.x.x.#', '#.....,t#t,..j..#', '#################'], { density: 0.4 }),
    hp: 3,
    start: { bombs: 2, range: 2 },
    goals: [{ k: 'collect', n: 4, label: 'Fragmentos' }],
    stars: [{ k: 'time', s: 90 }, { k: 'nodamage' }],
  },
  {
    id: '4-3',
    chapter: 4,
    index: 3,
    name: 'Espectros',
    summary: 'Elimine os 6 Piscantes.',
    briefing: 'Piscantes se teleportam para perto de você de tempos em tempos. Um brilho roxo avisa onde vão surgir.',
    intro: [{ who: 'Geada', text: 'Leituras instáveis. Eles não andam — eles pulam no espaço.' }],
    map: m(
      '4-3',
      'Salão dos Espectros',
      'aurora',
      ['#################', '#1,......k......#', '#,x.x./.x.x.\\.x.#', '#...k...........#', '#.x.x.x.x.x.x.x.#', '#...........k...#', '#.x.\\.x.x.x./.x.#', '#.....k.........#', '#.x.x.x.x.x.x.x.#', '#..........k....#', '#.x.x./.x.\\.x.x.#', '#,.......k......#', '#################'],
      { density: 0.4 },
    ),
    hp: 3,
    start: { bombs: 2, range: 2 },
    goals: [{ k: 'kill', type: 'piscante', n: 6, label: 'Piscantes' }],
    stars: [{ k: 'time', s: 120 }, { k: 'nodamage' }],
  },
  {
    id: '4-4',
    chapter: 4,
    index: 4,
    name: 'Relicário',
    summary: 'Encontre as 3 relíquias no escuro e saia.',
    briefing: 'As relíquias estão escondidas em colunas rachadas. Nem toda rachadura esconde algo — explore com cuidado no escuro.',
    intro: [{ who: 'Lume', text: 'Meus ancestrais escondiam tesouros nas colunas. Procure as rachaduras.' }],
    map: m(
      '4-4',
      'Cripta',
      'aurora',
      ['#################', '#1,.............#', '#.x.x.x.x.C.x.x.#', '#.......r.......#', '#.x.U.x.x.x.x.x.#', '#...k.......f...#', '#.x.x.x.x.x.U.x.#', '#...............#', '#.C.x.x.x.x.x.x.#', '#.......k....r..#', '#.x.x.U.x.x.x.x.#', '#..............E#', '#################'],
      { dark: true, density: 0.4 },
    ),
    hp: 3,
    start: { bombs: 2, range: 2 },
    goals: [{ k: 'collect', n: 3, label: 'Relíquias' }, { k: 'exit' }],
    stars: [{ k: 'time', s: 150 }, { k: 'nodamage' }],
    special: { collectItem: 'relic' },
  },
  {
    id: '4-5',
    chapter: 4,
    index: 5,
    name: 'O Salão Partido',
    summary: 'Sobreviva 100 s enquanto os espelhos giram.',
    briefing: 'Os espelhos do salão giram sozinhos a cada poucos segundos. O que era seguro agora pode não ser.',
    intro: [{ who: 'Lume', text: 'O Oráculo está perto. Os espelhos sentem a raiva dele.' }],
    map: m(
      '4-5',
      'Salão Partido',
      'aurora',
      ['#################', '#1.............n#', '#.x./.x.x.x.\\.x.#', '#...............#', '#./.x.x.x.x.x.\\.#', '#.......,.......#', '#.x.x.\\,/.x.x.x.#', '#.......,.......#', '#.\\.x.x.x.x.x./.#', '#...............#', '#.x.\\.x.x.x./.x.#', '#n.............n#', '#################'],
      { density: 0.35 },
    ),
    hp: 3,
    start: { bombs: 2, range: 3 },
    goals: [{ k: 'survive', s: 100, label: 'Resista' }],
    stars: [{ k: 'nodamage' }, { k: 'kills', n: 10 }],
    special: { rotateMirrors: 6, waves: [['piscante'], ['rastejo', 'rastejo'], ['piscante', 'farejador'], ['piscante', 'piscante'], ['farejador', 'rastejo', 'piscante'], ['piscante', 'piscante', 'farejador']], waveEvery: 15 },
  },
  {
    id: '4-6',
    chapter: 4,
    index: 6,
    name: 'Oráculo Partido',
    summary: 'Chefe: fira-o apenas com luz refletida.',
    briefing: 'O Oráculo repele qualquer chama direta. Só as chamas que passaram por um espelho o atingem. Ele se teleporta entre quatro pedestais.',
    intro: [
      { who: 'Oráculo Partido', text: 'Vocês trazem fogo à casa da luz. Fogo cego. Fogo reto.' },
      { who: 'Lume', text: 'Então vamos dobrar o fogo, mestre.' },
    ],
    outro: [
      { who: 'Lume', text: 'Ele era o guardião das Ruínas. O fragmento o enlouqueceu… como a todos.' },
      { who: 'Geada', text: 'Os sinais apontam para o Templo Verdejante. Algo lá está crescendo rápido demais.' },
    ],
    map: m('4-6', 'Observatório', 'aurora', ['#################', '#1,,,,,,,,,,,,,,#', '#,x,,,x,x,x,,,x,#', '#,,,/,,,O,,,\\,,,#', '#,x,,,x,x,x,,,x,#', '#,,,,,,,,,,,,,,,#', '#,x,O,x,x,x,O,x,#', '#,,,,,,,,,,,,,,,#', '#,x,,,x,x,x,,,x,#', '#,,,\\,,,O,,,/,,,#', '#,x,,,x,x,x,,,x,#', '#,,,,,,,,,,,,,,,#', '#################']),
    hp: 4,
    start: { bombs: 3, range: 5, speed: 1 },
    goals: [{ k: 'boss', label: 'Oráculo Partido' }],
    stars: [{ k: 'time', s: 180 }, { k: 'nodamage' }],
    boss: 'oraculo',
    reward: { item: 'estrela' },
  },

  // ═══════════════════════ CAPÍTULO 5 — TEMPLO VERDEJANTE ═══════════════════════
  {
    id: '5-1',
    chapter: 5,
    index: 1,
    name: 'Mata Fechada',
    summary: 'Chegue ao templo antes que a mata feche.',
    briefing: 'As trepadeiras crescem de volta alguns segundos depois de queimadas. Não perca tempo.',
    intro: [
      { who: 'Pirá (voz distante)', text: 'Viajantes! A mata virou contra nós. Venham pelo rio, até o templo!' },
      { who: 'Tuba', text: 'Essas plantas estão… respirando?' },
    ],
    map: m('5-1', 'Trilha do Rio', 'verdejante', ['#####################', '#1,gggg.gggg.gggg..E#', '#,xgxgx.xgxgx.xgxgx,#', '#g.ggg.r.ggg.g.ggg.g#', '#gxgx.xgxgx.xgx.xgxg#', '#.ggg.gggg.e.gggg.g.#', '#gx.xgxgx.xgxgx.xgx,#', '#g.gggg.gg.r.gggg.gg#', '#gxgx.xgxgx.xgxgx.x,#', '#gggg.gggg.ggggg.ggg#', '#####################'], { density: 0.4, vineRatio: 1 }),
    hp: 3,
    start: { bombs: 3, range: 3 },
    goals: [{ k: 'exit' }],
    timeLimit: 150,
    stars: [{ k: 'time', s: 70 }, { k: 'nodamage' }],
  },
  {
    id: '5-2',
    chapter: 5,
    index: 2,
    name: 'Esporos',
    summary: 'Elimine a infestação de esporos.',
    briefing: 'Esporos se dividem em dois quando atingidos. Os menores são rápidos, mas frágeis.',
    intro: [{ who: 'Pirá', text: 'Cuidado! Cada esporo que estoura vira dois menores.' }],
    map: m('5-2', 'Jardim Infestado', 'verdejante', GRID('#1,......e......#', '#...e...........#', '#...........e...#', '#.....e.........#', '#..........e....#', '#,.......e......#'), { density: 0.45, vineRatio: 0.4 }),
    hp: 3,
    start: { bombs: 2, range: 2 },
    goals: [{ k: 'kill', type: 'esporo', label: 'Esporos' }],
    stars: [{ k: 'time', s: 120 }, { k: 'nodamage' }],
  },
  {
    id: '5-3',
    chapter: 5,
    index: 3,
    name: 'Emboscada',
    summary: 'Recupere 4 fragmentos. Nem todo bloco é bloco.',
    briefing: 'Vigias se disfarçam de blocos e atacam quando você chega perto. Um olho vermelho às vezes os denuncia.',
    intro: [{ who: 'Pirá', text: 'Meu povo chama eles de Vigias. Parecem pedra, mas mordem.' }],
    map: m('5-3', 'Clareira', 'verdejante', GRID('#1,......w....i.#', '#..w......i.....#', '#.i.........w...#', '#......w........#', '#...f.......i...#', '#,......w.......#'), { density: 0.45, vineRatio: 0.3 }),
    hp: 3,
    start: { bombs: 2, range: 2 },
    goals: [{ k: 'collect', n: 4, label: 'Fragmentos' }],
    stars: [{ k: 'time', s: 120 }, { k: 'nodamage' }],
  },
  {
    id: '5-4',
    chapter: 5,
    index: 4,
    name: 'Oferenda',
    summary: 'Pressione as 3 placas ao mesmo tempo.',
    briefing: 'Os portões do templo abrem quando as três placas de oferenda são pressionadas juntas. Uma carga parada também conta como peso.',
    intro: [
      { who: 'Pirá', text: 'Três placas, uma pessoa. O templo gosta de enigmas.' },
      { who: 'Faísca', text: 'Uma pessoa… e duas cargas.' },
    ],
    map: m('5-4', 'Portões do Templo', 'verdejante', ['#################', '#1,,,,,,,,,,,,,,#', '#,x,x,x,x,x,x,x,#', '#,,,,p,,,,,p,,,,#', '#,x,x,x,x,x,x,x,#', '#,,,,,,,p,,,,,,,#', '#bxbxbxbxbxbxbxb#', '#####D#####D#####', '#,,,,,,,,,,,,,,,#', '#,x,x,x,x,x,x,x,#', '#,,,,,,,,,,,,,,,#', '#,,,r,,,,E,,,,r,#', '#################']),
    hp: 3,
    start: { bombs: 2, range: 2, speed: 1 },
    items: {},
    goals: [{ k: 'plates', label: 'Placas' }, { k: 'exit' }],
    stars: [{ k: 'time', s: 60 }, { k: 'nodamage' }],
    tips: [{ when: 'plate', text: 'Cargas paradas pesam nas placas. A placa segura o peso por um segundo depois.' }],
  },
  {
    id: '5-5',
    chapter: 5,
    index: 5,
    name: 'Cheia do Rio',
    summary: 'Suba antes que a enchente te alcance.',
    briefing: 'O rio transbordou e o templo está afundando de baixo para cima. Suba até a saída no topo.',
    intro: [{ who: 'Pirá', text: 'A água vem aí! Para cima, para cima!' }],
    map: m('5-5', 'Escadaria Alagada', 'verdejante', ['###############', '#,,,,,,E,,,,,,#', '#,x.x.x.x.x.x,#', '#....g...g....#', '#.x.x.xgx.x.x.#', '#..e.......e..#', '#.x.x.x.x.x.x.#', '#.............#', '#.xgx.x.x.xgx.#', '#.....r.......#', '#.x.x.x.x.x.x.#', '#..g.......g..#', '#.x.x.xgx.x.x.#', '#.......e.....#', '#.x.x.x.x.x.x.#', '#.............#', '#.x.x.x.x.x.x.#', '#,,,,,,1,,,,,,#', '###############'], { density: 0.4, vineRatio: 0.5 }),
    hp: 3,
    start: { bombs: 3, range: 3 },
    goals: [{ k: 'exit' }],
    stars: [{ k: 'time', s: 65 }, { k: 'nodamage' }],
    special: { chase: { dir: 'up', start: 8, every: 6 } },
  },
  {
    id: '5-6',
    chapter: 5,
    index: 6,
    name: 'Mãe-Raiz',
    summary: 'Chefe: destrua os bulbos e acerte o coração.',
    briefing: 'A Mãe-Raiz se protege com quatro bulbos. Destrua todos em sequência rápida — antes que rebrotem — e o coração dela se abre.',
    intro: [
      { who: 'Mãe-Raiz', text: 'Crescer… crescer… consumir a luz…' },
      { who: 'Pirá', text: 'Os bulbos! Queimem os quatro juntos e ela se abre!' },
    ],
    outro: [
      { who: 'Pirá', text: 'O rio voltou ao leito. O templo agradece — e eu também. Minhas fitas estão com vocês.' },
      { who: 'Vó Candeia (rádio)', text: 'Faísca… todos os fragmentos apontam para a Fortaleza Magma. É lá que está o ladrão.' },
    ],
    map: m('5-6', 'Coração do Templo', 'verdejante', ['#################', '#1,,,,,,,,,,,,,,#', '#,x,g,x,g,x,g,x,#', '#,,*,,,,,,,,,*,,#', '#,x,x,x,,,x,x,x,#', '#,,,,,,,,,,,,,,,#', '#,xgx,x,H,x,xgx,#', '#,,,,,,,,,,,,,,,#', '#,x,x,x,,,x,x,x,#', '#,,*,,,,,,,,,*,,#', '#,x,g,x,g,x,g,x,#', '#,,,,,,,,,,,,,,,#', '#################']),
    hp: 4,
    start: { bombs: 4, range: 3, speed: 1 },
    goals: [{ k: 'boss', label: 'Mãe-Raiz' }],
    stars: [{ k: 'time', s: 180 }, { k: 'nodamage' }],
    boss: 'maeraiz',
    reward: { char: 'pira' },
  },

  // ═══════════════════════ CAPÍTULO 6 — FORTALEZA MAGMA ═══════════════════════
  {
    id: '6-1',
    chapter: 6,
    index: 1,
    name: 'Portões de Basalto',
    summary: 'Atravesse o campo de respiradouros.',
    briefing: 'O chão da fortaleza cospe fogo em ritmo. Observe o brilho e atravesse no compasso.',
    intro: [
      { who: 'O Arconte (eco)', text: 'Pequenas faíscas. Vieram até a minha noite eterna.' },
      { who: 'Faísca', text: 'Viemos devolver a luz para quem gosta de festa.' },
    ],
    map: m('6-1', 'Campo de Respiradouros', 'magma', ['#####################', '#1,.V..V.#.V..V.#..E#', '#,x.x.x.x#x.x.x.#.x.#', '#..V..V...V..V..V...#', '#.x.x.x.x.x.x.x.x.x.#', '#.V..V..f..V..V..V..#', '#.x.x.x.x.x.x.x.x.x.#', '#...V...V.m.V...V...#', '#.x.x.x.#.x.x.#.x.x.#', '#..V...V...V...V...,#', '#####################'], { density: 0.4, ventPeriod: 5 }),
    hp: 3,
    start: { bombs: 3, range: 3 },
    goals: [{ k: 'exit' }],
    stars: [{ k: 'time', s: 80 }, { k: 'nodamage' }],
  },
  {
    id: '6-2',
    chapter: 6,
    index: 2,
    name: 'Salamandras',
    summary: 'Derrote 4 salamandras imunes ao fogo.',
    briefing: 'Salamandras não sentem fogo. Congele-as com Cargas Gélidas e, enquanto estiverem geladas, acerte uma explosão.',
    intro: [{ who: 'Geada', text: 'Criaturas de lava. Fogo não serve. Frio serve. Peguem meus cartuchos.' }],
    map: m('6-2', 'Galerias de Lava', 'magma', GRID('#1,.....z.....Y.#', '#...Y...........#', '#.z.........z...#', '#.......r.......#', '#...r.......Y...#', '#,.....z........#'), { density: 0.4 }),
    hp: 3,
    start: { bombs: 2, range: 2, cart: 5, charges: 4 },
    cartPool: [5],
    goals: [{ k: 'kill', type: 'salamandra', n: 4, label: 'Salamandras' }],
    stars: [{ k: 'time', s: 150 }, { k: 'nodamage' }],
    tips: [{ when: 'start', text: 'Cartucho (botão secundário): Carga Gélida. Congele e depois exploda!' }],
  },
  {
    id: '6-3',
    chapter: 6,
    index: 3,
    name: 'A Forja',
    summary: 'Recupere 6 fragmentos da forja.',
    briefing: 'O Arconte está fundindo os fragmentos. Resgate-os antes que virem uma arma.',
    intro: [{ who: 'Tuba', text: 'Uma forja… usando a Centelha como combustível. Isso é crime contra o forró.' }],
    map: m('6-3', 'Forja Negra', 'magma', GRID('#1,...i....V..i.#', '#..V.....m....V.#', '#.i.....V.....i.#', '#...m.......V...#', '#.V....i.....m..#', '#,...V.....i..f.#'), { density: 0.45, ventPeriod: 6 }),
    hp: 3,
    start: { bombs: 2, range: 2 },
    goals: [{ k: 'collect', n: 6, label: 'Fragmentos' }],
    stars: [{ k: 'time', s: 140 }, { k: 'nodamage' }],
  },
  {
    id: '6-4',
    chapter: 6,
    index: 4,
    name: 'A Queda',
    summary: 'Suba enquanto a fortaleza desmorona.',
    briefing: 'O Arconte derrubou os andares de baixo. Suba até o salão do trono.',
    intro: [{ who: 'O Arconte (eco)', text: 'Se não aceitam a escuridão, que caiam nela.' }],
    map: m('6-4', 'Torre Desabando', 'magma', ['###############', '#,,,,,,E,,,,,,#', '#,x.x.x.x.x.x,#', '#...V.....V...#', '#.x.x.x.x.x.x.#', '#.....m.......#', '#.x.xVx.xVx.x.#', '#..V.......V..#', '#.x.x.x.x.x.x.#', '#......f......#', '#.x.xVx.xVx.x.#', '#.............#', '#.x.x.x.x.x.x.#', '#..V...m...V..#', '#.x.x.x.x.x.x.#', '#.............#', '#.x.x.x.x.x.x.#', '#,,,,,,1,,,,,,#', '###############'], { density: 0.4, ventPeriod: 4 }),
    hp: 3,
    start: { bombs: 3, range: 3, speed: 1 },
    goals: [{ k: 'exit' }],
    stars: [{ k: 'time', s: 60 }, { k: 'nodamage' }],
    special: { chase: { dir: 'up', start: 6, every: 4.5 } },
  },
  {
    id: '6-5',
    chapter: 6,
    index: 5,
    name: 'Guarda de Elite',
    summary: 'Derrote os Bastiões de elite.',
    briefing: 'Dois Bastiões de elite guardam o trono, protegidos por drones Reparadores que os blindam. Derrube os drones primeiro.',
    intro: [{ who: 'Geada', text: 'Aqueles drones reforçam os escudos. Tirem os drones de cena e os brutamontes ficam expostos.' }],
    map: m('6-5', 'Antecâmara', 'magma', ['#################', '#1,,,,,,,,,,,,,,#', '#,x,x,x,x,x,x,x,#', '#,,,,,,,d,,,,,,,#', '#,x,x,x,x,x,x,x,#', '#,,,.,,q,,q,,.,,#', '#,x,x,x,x,x,x,x,#', '#,,.,,,,d,,,,.,,#', '#,x,x,x,x,x,x,x,#', '#,.,,,,,,,,,,,.,#', '#,x,x,x,x,x,x,x,#', '#,,,,,,,,,,,,,,,#', '#################'], { density: 0.6 }),
    hp: 4,
    start: { bombs: 3, range: 3, speed: 1 },
    goals: [{ k: 'kill', type: 'bastiao', n: 2, label: 'Bastiões de elite' }],
    stars: [{ k: 'time', s: 120 }, { k: 'nodamage' }],
    special: { elite: true },
  },
  {
    id: '6-6',
    chapter: 6,
    index: 6,
    name: 'O Arconte',
    summary: 'Chefe final: devolva a luz ao mundo.',
    briefing: 'O Arconte absorveu o poder dos outros guardiões. Ele muda de forma três vezes. A cada acerto, a Centelha volta a brilhar.',
    intro: [
      { who: 'O Arconte', text: 'Luz é barulho. Festa é barulho. Eu trago o silêncio perfeito.' },
      { who: 'Faísca', text: 'A Vila Pavio não fica em silêncio. Nem por um segundo.' },
      { who: 'Tuba', text: 'E o forró não para!' },
    ],
    outro: [
      { who: 'Vó Candeia', text: 'A Centelha voltou! Olhe o céu, Faísca… é a noite mais bonita que a Vila já viu.' },
      { who: 'Faísca', text: 'Então que comece o Circuito Estopim. De verdade, agora.' },
    ],
    map: m('6-6', 'Trono do Apagão', 'magma', ['#################', '#1,,,,,,,,,,,,,,#', '#,x,x,x,x,x,x,x,#', '#,,,O,,,,,,,,O,,#', '#,x,x,xVx,x,x,x,#', '#,,,,,,,,,,,,,,,#', '#,x,xVx,H,xVx,x,#', '#,,,,,,,,,,,,,,,#', '#,x,x,x,xVx,x,x,#', '#,,,O,,,,,,,,O,,#', '#,x,x,x,x,x,x,x,#', '#,,,,,,,,,,,,,,,#', '#################'], { ventPeriod: 6 }),
    hp: 5,
    start: { bombs: 4, range: 4, speed: 2, kick: true },
    goals: [{ k: 'boss', label: 'O Arconte' }],
    stars: [{ k: 'time', s: 240 }, { k: 'nodamage' }],
    boss: 'arconte',
    reward: { sparks: 1000, item: 'faixa-campeao' },
  },
];

// pré-requisitos encadeados
MISSIONS.forEach((mm, i) => {
  if (i > 0) mm.requires = MISSIONS[i - 1].id;
});

export const MISSION_BY_ID: Record<string, MissionDef> = Object.fromEntries(MISSIONS.map((mm) => [mm.id, mm]));

export function starText(s: StarDef): string {
  switch (s.k) {
    case 'time':
      return `Concluir em até ${s.s} s`;
    case 'nodamage':
      return 'Não sofrer dano';
    case 'relic':
      return 'Encontrar a relíquia secreta';
    case 'unseen':
      return 'Não ser visto pelas sentinelas';
    case 'bombs':
      return `Usar no máximo ${s.n} cargas`;
    case 'kills':
      return `Eliminar ${s.n} inimigos`;
    case 'intact':
      return 'Proteger sem perder vida';
  }
}

export const CharFor = (c: CharId) => c;
