import type { CharId } from '../content/characters';
import type { MatchRewards, Profile } from '../content/progression';
import type { ModeId, Rules } from '../sim/game';
import type { Cosmetics, PlayerSetup, RoundResult } from '../sim/types';
import type { Snapshot } from './snapshot';

export const PROTOCOL_VERSION = 1;

export interface RoomConfig {
  mode: ModeId;
  map: string; // id ou 'aleatorio'
  roundsToWin: number;
  bots: number; // bots para completar
  botLevel: 1 | 2 | 3;
  items: 0 | 1 | 2;
  abilities: boolean;
  cartridges: boolean;
  curses: boolean;
  friendlyFire: boolean;
  roundTime: number;
  maxPlayers: number;
  isPublic: boolean;
}

export const DEFAULT_ROOM: RoomConfig = {
  mode: 'classico',
  map: 'aleatorio',
  roundsToWin: 3,
  bots: 0,
  botLevel: 2,
  items: 1,
  abilities: true,
  cartridges: true,
  curses: true,
  friendlyFire: true,
  roundTime: 150,
  maxPlayers: 4,
  isPublic: false,
};

export interface RoomMember {
  id: string; // id da conta (ou bot:n)
  name: string;
  char: CharId;
  team: number;
  ready: boolean;
  bot: 0 | 1 | 2 | 3;
  host: boolean;
  online: boolean;
  level: number;
  cosmetics: Cosmetics;
  title?: string;
}

export interface RoomInfo {
  code: string;
  cfg: RoomConfig;
  members: RoomMember[];
  state: 'lobby' | 'playing' | 'results';
  kind: 'private' | 'casual' | 'ranked';
  rematch: string[];
}

export interface MatchStart {
  matchId: string;
  mode: ModeId;
  map: string;
  seed: number;
  round: number;
  roundsToWin: number;
  players: PlayerSetup[];
  rules: Partial<Rules>;
  you: number; // índice do jogador
  wins: Record<number, number>;
  ranked: boolean;
}

export interface MatchEndInfo {
  matchId: string;
  winnerTeam: number;
  wins: Record<number, number>;
  players: { name: string; char: CharId; team: number; kills: number; deaths: number; blocks: number; items: number; bot: number; accountId?: string }[];
  rewards?: MatchRewards;
  events?: string[];
  profile?: Profile;
  mmr?: { before: number; after: number };
  ranked: boolean;
}

export type ClientMsg =
  | { t: 'hello'; v: number }
  | { t: 'ping'; ts: number }
  | { t: 'queue'; kind: 'casual' | 'ranked'; char: CharId; mode?: ModeId }
  | { t: 'unqueue' }
  | { t: 'room.create'; cfg?: Partial<RoomConfig>; char: CharId }
  | { t: 'room.join'; code: string; char: CharId }
  | { t: 'room.leave' }
  | { t: 'room.cfg'; cfg: Partial<RoomConfig> }
  | { t: 'room.char'; char: CharId }
  | { t: 'room.team'; team: number }
  | { t: 'room.ready'; ready: boolean }
  | { t: 'room.start' }
  | { t: 'room.kick'; id: string }
  | { t: 'room.chat'; phrase: number }
  | { t: 'rematch' }
  | { t: 'in'; i: [number, number, number][] } // [seq, dir, flags(bit0 carga, bit1 técnica, bit2 cartucho)]
  | { t: 'emote'; id: string }
  | { t: 'invite'; to: string }
  | { t: 'resume' };

export type ServerMsg =
  | { t: 'welcome'; you: { id: string; name: string }; time: number; online: number }
  | { t: 'pong'; ts: number; st: number }
  | { t: 'error'; code: string; msg: string }
  | { t: 'queue.status'; searching: boolean; elapsed: number; inQueue: number; kind: 'casual' | 'ranked' }
  | { t: 'room'; room: RoomInfo | null }
  | { t: 'start'; m: MatchStart }
  | { t: 'snap'; s: Snapshot }
  | { t: 'round'; result: RoundResult; wins: Record<number, number>; next: boolean }
  | { t: 'end'; info: MatchEndInfo }
  | { t: 'emote'; p: number; id: string }
  | { t: 'chat'; from: string; name: string; phrase: number }
  | { t: 'invite'; from: { id: string; name: string }; code: string }
  | { t: 'presence'; friends: { id: string; status: 'online' | 'offline' | 'playing' }[] }
  | { t: 'notice'; msg: string };

/** Frases rápidas (chat seguro sem texto livre). */
export const QUICK_CHAT = ['Boa partida!', 'Pronto!', 'Mais uma?', 'Bora!', 'Essa foi por pouco!', 'Belo movimento!', 'Ops…', 'Valeu!', 'Aguenta aí!', 'GG'];

export const INPUT_FLAG = { bomb: 1, ability: 2, cart: 4 };
