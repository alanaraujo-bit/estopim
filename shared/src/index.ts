export * from './sim/constants';
export * from './sim/types';
export * from './sim/rng';
export * from './sim/map';
export * from './sim/game';
export * from './sim/modes';
export * from './content/characters';
export * from './content/items';
export * from './content/maps';
export * from './content/modes';
export * from './content/cosmetics';

import { Game, type GameSetup } from './sim/game';
import { controllerFor } from './sim/modes';
import { MODES } from './content/modes';
import { MissionCtl } from './sim/mission';
import type { MissionDef } from './content/campaign';
import type { PlayerSetup } from './sim/types';
import { I } from './sim/constants';
import './ai/enemies';
import './ai/bosses';

/** Cria uma rodada aplicando as regras do modo. */
export function createGame(setup: GameSetup): Game {
  const mode = MODES[setup.mode];
  const rules = { ...(mode?.rulesOverride ?? {}), ...(setup.rules ?? {}) };
  return new Game({ ...setup, rules }, setup.controller ?? controllerFor(setup.mode));
}
export * from './ai/danger';
export * from './ai/bot';
export * from './content/progression';

export * from './content/campaign';
export * from './content/ops';
export * from './sim/mission';
export * from './ai/enemies';
export * from './ai/bosses';
export * from './net/snapshot';
export * from './net/protocol';

/** Cria o jogo de uma missão da campanha. */
export function createMissionGame(def: MissionDef, players: PlayerSetup[], seed: number): Game {
  const items = def.items ?? { [I.BombUp]: 3, [I.RangeUp]: 3, [I.SpeedUp]: 1, [I.Heart]: 1 };
  const g = new Game(
    {
      map: def.map,
      mode: 'missao',
      seed,
      players,
      rules: {
        roundTime: 3600,
        suddenDeath: false,
        items: 1,
        itemPlan: items,
        friendlyFire: false,
        abilities: true,
        cartridges: true,
        curses: false,
        scatter: false,
        hp: def.hp,
        respawn: false,
      },
      countdown: 150,
    },
    MissionCtl(def),
  );
  if (def.cartPool) g.mstate.cartPool = def.cartPool;
  return g;
}
