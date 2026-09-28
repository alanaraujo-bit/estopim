import type { ModeId, Rules } from '../sim/game';

export interface ModeDef {
  id: ModeId;
  name: string;
  tagline: string;
  desc: string;
  rules: string[];
  teams: boolean;
  minPlayers: number;
  maxPlayers: number;
  roundsToWin: number;
  rulesOverride: Partial<Rules>;
  maps: string[] | 'all';
  icon: string; // id de ícone
  special?: boolean;
  coop?: boolean;
}

export const MODES: Record<string, ModeDef> = {
  classico: {
    id: 'classico',
    name: 'Clássico',
    tagline: 'Último de pé vence a rodada.',
    desc: 'A essência do Estopim: abra caminho, colete Brasas e encurrale seus adversários. Quando o relógio aperta, a arena começa a desmoronar.',
    rules: ['Cada golpe elimina (a menos que tenha Escudo).', 'Vence a rodada quem sobreviver por último.', 'Ao cair, suas Brasas se espalham pelo mapa.', 'Colapso nos últimos 45 s.'],
    teams: false,
    minPlayers: 2,
    maxPlayers: 4,
    roundsToWin: 3,
    rulesOverride: {},
    maps: 'all',
    icon: 'bomb',
  },
  equipes: {
    id: 'equipes',
    name: 'Equipes',
    tagline: 'Dois contra dois. Fogo amigo ligado.',
    desc: 'Coordene armadilhas com seu parceiro — mas cuidado: suas chamas também queimam aliados.',
    rules: ['Duas equipes de 2.', 'Vence a equipe com alguém de pé.', 'Fogo amigo ativado.'],
    teams: true,
    minPlayers: 4,
    maxPlayers: 4,
    roundsToWin: 3,
    rulesOverride: {},
    maps: 'all',
    icon: 'team',
  },
  coroa: {
    id: 'coroa',
    name: 'Coroa',
    tagline: 'Domine o trono no centro da arena.',
    desc: 'Fique sozinho na zona da coroa para marcar pontos. Quem cai volta em instantes. Primeiro a 30 pontos vence.',
    rules: ['Pontue ficando sozinho (ou só com aliados) na zona.', 'Renascimento em 3 s.', '30 pontos vencem; senão, maior placar no fim.'],
    teams: false,
    minPlayers: 2,
    maxPlayers: 4,
    roundsToWin: 1,
    rulesOverride: { respawn: true, respawnTime: 3, suddenDeath: false, roundTime: 180, scatter: false },
    maps: ['praca', 'esteira', 'espelhos', 'pista', 'mata', 'caldeira'],
    icon: 'crown',
    special: true,
  },
  chuva: {
    id: 'chuva',
    name: 'Chuva de Cargas',
    tagline: 'O céu está caindo. Literalmente.',
    desc: 'Cargas despencam do céu cada vez mais rápido. As sombras avisam onde vão cair. Sobreviva mais que todo mundo.',
    rules: ['Sombras no chão avisam as quedas.', 'A chuva acelera com o tempo.', 'Último de pé vence.'],
    teams: false,
    minPlayers: 1,
    maxPlayers: 4,
    roundsToWin: 2,
    rulesOverride: { suddenDeath: false, roundTime: 240, cartridges: false },
    maps: ['praca', 'esteira', 'pista', 'doca', 'subsolo'],
    icon: 'rain',
    special: true,
  },
  brasa: {
    id: 'brasa',
    name: 'Brasa Quente',
    tagline: 'Passe adiante antes que exploda.',
    desc: 'Um jogador carrega a Brasa Quente. Encoste em alguém para passá-la. Quando o tempo acaba, ela explode — com você junto.',
    rules: ['Quem carrega a Brasa fica mais rápido.', 'Encoste em outro jogador para passá-la.', 'Sem Brasas no mapa: só habilidade.'],
    teams: false,
    minPlayers: 3,
    maxPlayers: 4,
    roundsToWin: 2,
    rulesOverride: { items: 0, suddenDeath: false, roundTime: 300, cartridges: false, curses: false, scatter: false },
    maps: ['praca', 'pista', 'espelhos', 'doca'],
    icon: 'potato',
    special: true,
  },
  captura: {
    id: 'captura',
    name: 'Captura do Núcleo',
    tagline: 'Leve o Núcleo até a sua base.',
    desc: 'Um Núcleo de energia surge no centro. Carregue-o até o seu lado da arena. Quem carrega fica mais lento — proteja seu parceiro.',
    rules: ['Duas equipes.', 'Leve o Núcleo à sua base para marcar.', '3 capturas vencem.', 'Renascimento em 4 s.'],
    teams: true,
    minPlayers: 2,
    maxPlayers: 4,
    roundsToWin: 1,
    rulesOverride: { respawn: true, respawnTime: 4, suddenDeath: false, roundTime: 300, scatter: false },
    maps: ['praca', 'esteira', 'espelhos', 'mata', 'caldeira'],
    icon: 'core',
    special: true,
  },
  horda: {
    id: 'horda',
    name: 'Horda',
    tagline: 'Cooperativo: segurem a linha.',
    desc: 'Até 4 jogadores contra ondas de máquinas do Apagão. Cada onda traz inimigos mais espertos. Sobrevivam a 10 ondas.',
    rules: ['Cooperativo contra IA.', 'Cada jogador tem 3 vidas por onda.', 'Aliados caídos voltam na próxima onda.'],
    teams: false,
    minPlayers: 1,
    maxPlayers: 4,
    roundsToWin: 1,
    rulesOverride: { hp: 3, suddenDeath: false, roundTime: 900, friendlyFire: false, scatter: false, curses: false },
    maps: ['praca', 'esteira', 'pista', 'mata', 'caldeira', 'doca'],
    icon: 'horde',
    coop: true,
    special: true,
  },
};

export const MODE_ORDER = ['classico', 'equipes', 'coroa', 'chuva', 'brasa', 'captura', 'horda'];
