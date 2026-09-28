import { B, CURSES, I } from '../sim/constants';

export interface ItemDef {
  id: number;
  name: string;
  desc: string;
  good: boolean;
  glyph: string; // símbolo curto usado no HUD e nos ícones
}

export const ITEMS: Record<number, ItemDef> = {
  [I.BombUp]: { id: I.BombUp, name: 'Carga Extra', desc: '+1 carga simultânea.', good: true, glyph: '+1' },
  [I.RangeUp]: { id: I.RangeUp, name: 'Pavio Longo', desc: '+1 de alcance das chamas.', good: true, glyph: '↔' },
  [I.SpeedUp]: { id: I.SpeedUp, name: 'Ímpeto', desc: '+1 de velocidade.', good: true, glyph: '»' },
  [I.Kick]: { id: I.Kick, name: 'Bota de Chute', desc: 'Andar contra uma carga a chuta até ela bater em algo.', good: true, glyph: 'K' },
  [I.Shield]: { id: I.Shield, name: 'Escudo de Brasa', desc: 'Absorve um golpe.', good: true, glyph: '◆' },
  [I.Cartridge]: { id: I.Cartridge, name: 'Cartucho', desc: 'Concede cargas especiais para o botão secundário.', good: true, glyph: '✦' },
  [I.Curse]: { id: I.Curse, name: 'Brasa Corrompida', desc: 'Um efeito caótico por 10 s. Passe para outro jogador encostando nele.', good: false, glyph: '☠' },
  [I.RangeMax]: { id: I.RangeMax, name: 'Supernova', desc: 'Alcance no máximo.', good: true, glyph: '✸' },
  [I.Fragment]: { id: I.Fragment, name: 'Fragmento da Centelha', desc: 'Um pedaço da grande Centelha.', good: true, glyph: '◇' },
  [I.Relic]: { id: I.Relic, name: 'Relíquia', desc: 'Um segredo bem guardado.', good: true, glyph: '★' },
  [I.Heart]: { id: I.Heart, name: 'Coração de Brasa', desc: 'Recupera 1 de vida.', good: true, glyph: '♥' },
  [I.Spark]: { id: I.Spark, name: 'Faíscas', desc: 'Moeda da Vila Pavio.', good: true, glyph: '¤' },
};

export interface CartDef {
  kind: number;
  name: string;
  short: string;
  desc: string;
  charges: number;
  color: string;
}

export const CARTRIDGES: Record<number, CartDef> = {
  [B.Pierce]: { kind: B.Pierce, name: 'Carga Perfurante', short: 'Perfurante', desc: 'Chamas atravessam todos os blocos destrutíveis na linha.', charges: 3, color: '#ff4d6d' },
  [B.Frag]: { kind: B.Frag, name: 'Carga Estilhaço', short: 'Estilhaço', desc: 'Explode em cruz curta e também nas diagonais.', charges: 3, color: '#ffb703' },
  [B.Mine]: { kind: B.Mine, name: 'Mina de Contato', short: 'Mina', desc: 'Some de vista após armar e explode quando um adversário se aproxima.', charges: 2, color: '#8ac926' },
  [B.Pulse]: { kind: B.Pulse, name: 'Carga de Pulso', short: 'Pulso', desc: 'Não fere: empurra jogadores e cargas próximos para longe.', charges: 3, color: '#4cc9f0' },
  [B.Frost]: { kind: B.Frost, name: 'Carga Gélida', short: 'Gélida', desc: 'Congela quem atinge por 1,2 s e deixa o chão escorregadio.', charges: 3, color: '#a2d2ff' },
  [B.Remote]: { kind: B.Remote, name: 'Carga Remota', short: 'Remota', desc: 'Só explode quando você apertar o botão de novo.', charges: 3, color: '#f15bb5' },
  [B.Cluster]: { kind: B.Cluster, name: 'Carga Cacho', short: 'Cacho', desc: 'Explode e espalha quatro minicargas nas pontas das chamas.', charges: 2, color: '#fb5607' },
};

export const CART_POOL = [B.Pierce, B.Frag, B.Mine, B.Pulse, B.Frost, B.Remote, B.Cluster];

export const CURSE_DEFS: Record<number, { name: string; desc: string }> = {
  [CURSES.ShortFuse]: { name: 'Pavio Curto', desc: 'Suas cargas explodem em 1 segundo.' },
  [CURSES.Slow]: { name: 'Passos de Chumbo', desc: 'Velocidade mínima.' },
  [CURSES.Hyper]: { name: 'Disparada', desc: 'Velocidade máxima e descontrolada.' },
  [CURSES.Leaky]: { name: 'Mão Furada', desc: 'Você solta cargas sem querer.' },
  [CURSES.Reverse]: { name: 'Contramão', desc: 'Controles invertidos.' },
  [CURSES.Jammed]: { name: 'Pavio Molhado', desc: 'Não consegue soltar cargas.' },
};
