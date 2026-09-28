import { BotBrain, MAPS, MISSIONS, MODES, createGame, createMissionGame, encodeSnapshot, applySnapshot, type Game, type PlayerInput } from '../src/index';

let fails = 0;
const fail = (msg: string) => {
  fails++;
  console.error('✗ ' + msg);
};

// 1. Validação estrutural dos mapas
for (const m of [...MAPS, ...MISSIONS.map((x) => x.map)]) {
  const w = m.rows[0].length;
  m.rows.forEach((r, i) => {
    if (r.length !== w) fail(`${m.id}: linha ${i} tem ${r.length} colunas (esperado ${w})`);
  });
  if (!m.rows.some((r) => r.includes('1'))) fail(`${m.id}: sem ponto de nascimento 1`);
  if (m.rows[0].replace(/#/g, '') !== '' || m.rows[m.rows.length - 1].replace(/#/g, '') !== '') fail(`${m.id}: borda superior/inferior aberta`);
  m.rows.forEach((r, i) => {
    if (r[0] !== '#' || r[r.length - 1] !== '#') fail(`${m.id}: borda lateral aberta na linha ${i}`);
  });
}
for (const ms of MISSIONS) {
  if (ms.goals.some((g) => g.k === 'exit') && !ms.map.rows.some((r) => r.includes('E'))) fail(`${ms.id}: objetivo de saída sem 'E'`);
  if (ms.goals.some((g) => g.k === 'targets') && !ms.map.rows.some((r) => r.includes('*'))) fail(`${ms.id}: objetivo de alvos sem '*'`);
}

// 2. Simulação de missões com um bot no controle
function runGame(g: Game, ticks: number, label: string) {
  const bots = g.players.map((p) => new BotBrain(p.id, 3, 7));
  try {
    for (let t = 0; t < ticks && g.phase !== 'over'; t++) {
      const inputs: PlayerInput[] = g.players.map((p, i) => bots[i].think(g));
      g.step(inputs);
      if (t % 97 === 0) {
        // serialização ida-e-volta
        const snap = encodeSnapshot(g, { tiles: true, floor: true, viewerTeam: 0, events: g.events });
        const json = JSON.stringify(snap);
        applySnapshot(g, JSON.parse(json));
      }
    }
  } catch (e) {
    fail(`${label}: exceção ${(e as Error).stack}`);
  }
  return g;
}

for (const ms of MISSIONS) {
  const g = createMissionGame(ms, [{ name: 'Teste', char: 'faisca', team: 0 }], 42);
  runGame(g, 60 * 90, 'missão ' + ms.id);
  console.log(`missão ${ms.id.padEnd(4)} fase=${g.phase.padEnd(7)} inimigos=${g.enemies.filter((e) => e.alive).length} resultado=${g.result?.reason ?? '-'}`);
}

// 3. Modos de arena com 4 bots
for (const mode of Object.keys(MODES)) {
  for (const map of MAPS) {
    const def = MODES[mode];
    if (def.maps !== 'all' && !def.maps.includes(map.id)) continue;
    const teams = def.teams ? [0, 0, 1, 1] : [0, 1, 2, 3];
    const g = createGame({
      map,
      mode: def.id,
      seed: 7,
      players: ['faisca', 'tuba', 'lume', 'mola'].map((c, i) => ({ name: 'Bot ' + i, char: c as any, team: mode === 'horda' ? 0 : teams[i], bot: 2 as const })),
    });
    runGame(g, 60 * 200, `${mode}/${map.id}`);
    if (mode === 'classico') console.log(`${mode}/${map.id}: fase=${g.phase} ${g.result?.reason ?? ''}`);
  }
}

console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo ✓');
process.exit(fails ? 1 : 0);
