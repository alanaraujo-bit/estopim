import { useEffect, useRef, useState } from 'preact/hooks';
import {
  B,
  BOSS_INFO,
  CHARACTERS,
  COSMETIC_BY_ID,
  F,
  MAP_BY_ID,
  MISSION_BY_ID,
  MODES,
  T,
  createMissionGame,
  type Game,
  type MatchStart,
  type MatchSummary,
  type MissionDef,
  type PStats,
} from '@estopim/shared';
import { LocalMatch, type MatchConfig } from '../../game/match';
import { OnlineSession } from '../../game/online';
import { Renderer } from '../../game/renderer';
import { input, keyLabel } from '../../game/input';
import { music, biomeTrack } from '../../audio/music';
import { playEvents, sfx } from '../../audio/sfx';
import { audio } from '../../audio/engine';
import { effectiveQuality, reportFps, settings, updateSettings } from '../../state/settings';
import { back, confirmModal, go, isTouch, portrait, profile, resetTo, toast } from '../../state/store';
import { doOp, latency, send } from '../../net/client';
import { Hud } from '../Hud';
import { TouchControls } from '../TouchControls';
import { Btn, Slider } from '../components';
import { Icon } from '../icons';

export type GameParams =
  | { kind: 'local'; cfg: MatchConfig; backTo?: string }
  | { kind: 'mission'; id: string; char: import('@estopim/shared').CharId }
  | { kind: 'online'; start: MatchStart };

interface Banner {
  text: string;
  sub?: string;
  kind: 'round' | 'win' | 'lose' | 'draw' | 'info' | 'done' | 'fail';
  id: number;
}

let bannerId = 1;

export function GameScreen({ params }: { params: GameParams }) {
  const host = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const sessRef = useRef<LocalMatch | OnlineSession | null>(null);
  const [, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [count, setCount] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const pausedRef = useRef(false);
  const touch = isTouch.value;
  const mission: MissionDef | null = params.kind === 'mission' ? MISSION_BY_ID[params.id] : null;

  const showBanner = (text: string, kind: Banner['kind'], sub?: string, ms = 2200) => {
    const b = { text, kind, sub, id: bannerId++ };
    setBanner(b);
    setTimeout(() => setBanner((cur) => (cur?.id === b.id ? null : cur)), ms);
  };

  useEffect(() => {
    const r = new Renderer(cv.current!);
    const st = settings.value;
    r.settings = { quality: effectiveQuality(), shake: st.shake, reducedMotion: st.reducedMotion, flashes: st.flashes, markers: st.markers };
    r.minTile = touch ? 34 : 30;
    const p = profile.value;

    // ───── criação da sessão ─────
    let sess: LocalMatch | OnlineSession;
    let localIds: number[] = [0];
    if (params.kind === 'online') {
      sess = new OnlineSession(params.start);
      localIds = [params.start.you];
    } else if (params.kind === 'mission') {
      const def = MISSION_BY_ID[params.id];
      const cfg: MatchConfig = {
        mode: 'missao',
        mapId: def.map.id,
        players: [{ name: p.name || 'Você', char: params.char, team: 0, cosmetics: cosmeticsFor(params.char) }],
        roundsToWin: 1,
        local: [{ id: 0, source: { type: 'any' } }],
        factory: (seed) => createMissionGame(def, [{ name: p.name || 'Você', char: params.char, team: 0, cosmetics: cosmeticsFor(params.char) }], seed),
      };
      sess = new LocalMatch(cfg);
    } else {
      sess = new LocalMatch(params.cfg);
      localIds = params.cfg.local.map((l) => l.id);
    }
    sessRef.current = sess;
    sess.attach(r);
    r.view = { local: localIds, localTeam: sess.game.players[localIds[0]]?.team ?? 0 };
    if (import.meta.env.DEV) (window as any).__match = sess;

    // ───── layout ─────
    const fit = () => {
      const el = host.current!;
      const w = el.clientWidth,
        h = el.clientHeight;
      const port = h > w;
      const small = Math.min(w, h) < 600;
      r.hudInsetTop = mission ? (small ? 8 : 0) : small ? 58 : 74;
      r.hudInsetBottom = touch && port ? Math.min(h * 0.34, 260) : 0;
      (r as any).hudInsetX = touch && !port ? Math.min(w * 0.2, 200) : 0;
      r.resize(w, h);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host.current!);

    // ───── áudio ─────
    const g0 = sess.game;
    music.play(biomeTrack(g0.map.biome, !!mission?.boss), (g0.map.id.length * 7) % 97);
    music.setIntensity(1);

    // ───── dicas ─────
    const shownTips = new Set<string>();
    const tips = mission?.tips ?? [];
    const showTip = (when: string) => {
      if (!settings.value.tips && params.kind !== 'mission') return;
      if (shownTips.has(when)) return;
      const t = tips.find((x) => x.when === when);
      if (!t) return;
      shownTips.add(when);
      setTip(touch && t.touch ? t.touch : t.text);
      setTimeout(() => setTip((cur) => (cur === (touch && t.touch ? t.touch : t.text) ? null : cur)), 6000);
    };

    // ───── eventos ─────
    sess.onEvents = (g: Game) => {
      playEvents(g, g.events, localIds);
      for (const ev of g.events) {
        if (ev.e === 'obj') {
          if (ev.kind === 'done' || ev.kind === 'fail') showBanner(ev.msg, ev.kind === 'done' ? 'done' : 'fail', undefined, 2000);
          else if (g.tick > 200) toast(ev.msg, ev.kind === 'progress' ? 'ok' : 'info', undefined, ev.kind === 'progress' ? '✦' : '•', 2200);
        }
        if (ev.e === 'place' && localIds.includes(ev.p)) showTip('bomb');
        if (ev.e === 'block' && ev.item) setTimeout(() => showTip('item'), 700);
        if (ev.e === 'hit' && localIds.includes(ev.p)) showTip('damage');
        if (ev.e === 'kick' && localIds.includes(ev.p)) showTip('kick');
        if (ev.e === 'sudden') showBanner('COLAPSO!', 'fail', 'A arena está desmoronando', 1800);
        if (ev.e === 'death' && localIds.includes(ev.p) && !mission && g.phase === 'play') {
          const by = g.players[ev.by];
          showBanner('Você caiu!', 'lose', by && by.id !== ev.p ? `por ${by.name}` : ev.by === ev.p ? 'pela própria carga…' : undefined, 1600);
        }
        if (ev.e === 'enemyHit' && ev.dead && ev.boss) showBanner(`${BOSS_INFO[g.enemies.find((e) => e.boss)?.type ?? '']?.name ?? 'Chefe'} derrotado!`, 'done', undefined, 2600);
      }
      if (localIds.length === 1) {
        const me = g.players[localIds[0]];
        if (me && Math.abs(me.stats.bombs) === 0) {
          // perto de blocos?
          const cx = Math.round(me.x),
            cy = Math.round(me.y);
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ])
            if (g.tileAt(cx + dx, cy + dy) === T.Block) showTip('near-block');
        }
      }
    };
    let lastPhase = sess.game.phase;
    let lastCount = -1;
    let frames = 0;
    let fpsAcc = 0;
    let fpsT = performance.now();
    sess.onFrame = (g: Game) => {
      frames++;
      if (frames % 4 === 0) setTick((t) => t + 1);
      const now = performance.now();
      fpsAcc++;
      if (now - fpsT > 1000) {
        const f = (fpsAcc * 1000) / (now - fpsT);
        setFps(Math.round(f));
        reportFps(f);
        fpsAcc = 0;
        fpsT = now;
      }
      if (g.phase === 'countdown') {
        const n = Math.ceil(g.phaseT / 60);
        if (n !== lastCount && n > 0 && n <= 3) {
          lastCount = n;
          setCount(String(n));
          sfx.countdown(n);
        }
      }
      if (g.phase !== lastPhase) {
        if (g.phase === 'play' && (lastPhase === 'countdown' || lastPhase === 'intro')) {
          setCount('JÁ!');
          sfx.countdown(0);
          setTimeout(() => setCount(null), 700);
          showTip('start');
        }
        lastPhase = g.phase;
      }
      // intensidade da música
      const aliveHumans = g.players.filter((q) => q.alive).length;
      const boss = g.enemies.find((e) => e.boss && e.alive);
      const tense = g.sudden || (g.players.length > 2 && aliveHumans === 2) || (boss && boss.hp <= boss.maxHp / 3);
      music.setIntensity(tense ? 2 : 1);
      // dicas contextuais
      if (mission && frames % 20 === 0) {
        const me = g.players[localIds[0]];
        if (me?.alive) {
          const cx = Math.round(me.x),
            cy = Math.round(me.y);
          if (g.enemies.some((e) => e.alive && !e.boss && e.spawnT === 0 && !(e.flags & 2) && Math.abs(e.x - me.x) + Math.abs(e.y - me.y) < 6)) showTip('enemy');
          for (let dy = -3; dy <= 3; dy++)
            for (let dx = -3; dx <= 3; dx++) {
              const t = g.tileAt(cx + dx, cy + dy);
              if (t === T.Barrel) showTip('barrel');
              if (t === T.MirrorA || t === T.MirrorB) showTip('mirror');
              if (g.inb(cx + dx, cy + dy)) {
                const fl = g.floor[g.idx(cx + dx, cy + dy)];
                if (fl === F.Ice) showTip('ice');
                if (fl === F.Plate) showTip('plate');
              }
            }
          if (g.mstate.exitOpen) showTip('exit-open');
        }
      }
    };

    sess.onRoundOver = (g, stt) => {
      const res = g.result!;
      const meTeam = g.players[localIds[0]]?.team ?? 0;
      if (mission) {
        if (res.success) {
          sfx.roundWin();
          showBanner('MISSÃO CONCLUÍDA!', 'win', undefined, 2400);
        } else {
          sfx.roundLose();
          showBanner('MISSÃO FALHOU', 'lose', res.reason, 2400);
        }
        setTimeout(() => finishMission(g), 2500);
        return;
      }
      if (res.winnerTeam < 0) {
        sfx.roundLose();
        showBanner('EMPATE!', 'draw', res.reason, 2400);
      } else {
        const won = localIds.some((id) => g.players[id]?.team === res.winnerTeam);
        const names = res.winners.map((i) => g.players[i]?.name).join(' e ');
        if (won || localIds.length > 1) sfx.roundWin();
        else sfx.roundLose();
        showBanner(stt.over ? (won && localIds.length === 1 ? 'VITÓRIA!' : `${names} VENCE!`) : `${names} leva a rodada`, won ? 'win' : localIds.length > 1 ? 'win' : 'lose', stt.over ? 'Fim de partida' : `Placar: ${Object.entries(stt.wins).filter(([t]) => g.players.some((q) => q.team === +t)).map(([, w]) => w).join(' × ')}`, 2600);
      }
      void meTeam;
      if (params.kind === 'online') return; // servidor conduz
      setTimeout(() => {
        if (stt.over) finishLocal();
        else {
          (sess as LocalMatch).newRound();
          lastCount = -1;
          showBanner(`RODADA ${stt.round + 1}`, 'round', MAP_BY_ID[(sess as LocalMatch).game.map.id]?.name ?? '', 1800);
        }
      }, 2800);
    };

    const finishMission = (g: Game) => {
      const def = mission!;
      const res = g.result!;
      const me = g.players[0];
      const time = Math.round(g.tick / 60);
      let opRes = null;
      if (res.success) opRes = doOp({ k: 'mission', id: def.id, stars: res.stars as [boolean, boolean, boolean], time, relic: !!g.mstate.relicFound, at: Date.now() });
      resetTo('results', {
        kind: 'mission',
        id: def.id,
        char: params.kind === 'mission' ? params.char : 'faisca',
        success: !!res.success,
        reason: res.reason,
        stars: res.stars ?? [false, false, false],
        time,
        stats: me.stats,
        rewards: opRes?.missionRewards,
        events: opRes?.events ?? [],
      });
    };

    const finishLocal = () => {
      const m = sess as LocalMatch;
      const g = m.game;
      const meId = localIds[0];
      const me = g.players[meId];
      const tot = m.totals[meId];
      const humans = m.cfg.players.filter((x) => !x.bot).length;
      const summary: MatchSummary = {
        mode: m.cfg.mode,
        char: me.char,
        won: m.state.winnerTeam === me.team,
        rounds: m.state.round,
        roundWins: m.state.wins[me.team] ?? 0,
        kills: tot.kills,
        deaths: tot.deaths,
        blocks: tot.blocks,
        items: tot.items,
        bombs: tot.bombs,
        chain: tot.chains,
        abilities: tot.abilities,
        nearMiss: tot.nearMiss,
        flawless: m.flawless[meId] ?? 0,
        seconds: Math.round(m.tickCount / 60),
        online: false,
        ranked: false,
        vsBots: humans <= 1,
        players: g.players.length,
      };
      const r = doOp({ k: 'match', s: summary, at: Date.now() });
      resetTo('results', {
        kind: 'local',
        summary,
        rewards: r.rewards,
        events: r.events,
        players: g.players.map((pl, i) => ({ name: pl.name, char: pl.char, team: pl.team, bot: pl.bot, ...m.totals[i] })),
        winnerTeam: m.state.winnerTeam,
        wins: m.state.wins,
        cfg: m.cfg,
        local: localIds,
      });
    };

    if (params.kind === 'online') {
      (sess as OnlineSession).onEnd = (info) => resetTo('results', { kind: 'online', info, local: localIds });
      (sess as OnlineSession).onRoundStart = (round) => showBanner(`RODADA ${round}`, 'round', MAP_BY_ID[sess.game.map.id]?.name ?? '', 1800);
    }

    // ───── pausa / emotes ─────
    const togglePause = () => {
      pausedRef.current = !pausedRef.current;
      setPaused(pausedRef.current);
      if (params.kind !== 'online') sess.paused = pausedRef.current;
      music.muffle(pausedRef.current);
      input.enabled = !pausedRef.current;
      sfx.click();
    };
    input.onPause = togglePause;
    let emoteIdx = 0;
    input.onEmote = () => doEmote();
    const doEmote = () => {
      const list = profile.value.equipped.emotes;
      if (!list.length) return;
      const id = list[emoteIdx++ % list.length];
      const def = COSMETIC_BY_ID[id];
      if (!def) return;
      r.emotes.set(localIds[0], { glyph: def.data?.glyph ?? '!', text: def.data?.text ?? def.name, t: r.time });
      sfx.click();
      if (params.kind === 'online') send({ t: 'emote', id });
    };
    (window as any).__doEmote = doEmote;
    (window as any).__togglePause = togglePause;

    const onVis = () => {
      if (document.visibilityState === 'hidden' && params.kind !== 'online' && !pausedRef.current) togglePause();
      if (settings.value.muteInBackground && audio.ctx) {
        if (document.visibilityState === 'hidden') audio.ctx.suspend();
        else audio.ctx.resume();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    const onBlur = () => {
      if (params.kind !== 'online' && !pausedRef.current && sess.game.phase === 'play') togglePause();
    };
    window.addEventListener('blur', onBlur);

    sess.start();
    if (params.kind !== 'mission') showBanner(`RODADA ${sess.game.round}`, 'round', MAP_BY_ID[sess.game.map.id]?.name ?? '', 1800);
    else showBanner(mission!.name, 'round', mission!.summary, 2400);

    return () => {
      sess.stop();
      ro.disconnect();
      input.onPause = null;
      input.onEmote = null;
      input.enabled = true;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      music.muffle(false);
    };
  }, []);

  const sess = sessRef.current;
  const g = sess?.game;
  const local = sess ? (params.kind === 'online' ? [params.start.you] : params.kind === 'local' ? params.cfg.local.map((l) => l.id) : [0]) : [0];
  const me = g?.players[local[0]] ?? null;
  const togglePause = () => (window as any).__togglePause?.();

  return (
    <div class={'game-root' + (touch ? ' is-touch' : '') + (portrait.value ? ' is-portrait' : '')} ref={host}>
      <canvas ref={cv} />
      {g && (
        <Hud
          g={g}
          local={local}
          wins={sess && 'state' in sess ? sess.state.wins : undefined}
          roundsToWin={params.kind === 'local' ? params.cfg.roundsToWin : params.kind === 'online' ? params.start.roundsToWin : 1}
          mission={!!mission}
          compact={touch}
          onPause={togglePause}
          showPause={!touch}
          ping={params.kind === 'online' ? latency.value : undefined}
        />
      )}
      {touch && g && local.length === 1 && <TouchControls player={me} onPause={togglePause} onEmote={() => (window as any).__doEmote?.()} />}
      {count && (
        <div class="countdown" key={count}>
          {count}
        </div>
      )}
      {banner && (
        <div class={'banner banner-' + banner.kind} key={banner.id}>
          <span class="display">{banner.text}</span>
          {banner.sub && <small>{banner.sub}</small>}
        </div>
      )}
      {tip && (
        <div class="tip" role="status">
          <span class="tip-ico">!</span>
          {tip}
        </div>
      )}
      {settings.value.showFps && <span class="fps">{fps} FPS</span>}
      {paused && <PauseMenu params={params} onResume={togglePause} mission={mission} />}
    </div>
  );
}

function cosmeticsFor(char: import('@estopim/shared').CharId) {
  const e = profile.value.equipped;
  return { skin: e.skins[char] ?? 'base', bomb: e.bomb, trail: e.trail };
}

function PauseMenu({ params, onResume, mission }: { params: GameParams; onResume: () => void; mission: MissionDef | null }) {
  const [tab, setTab] = useState<'menu' | 'som' | 'controles'>('menu');
  const s = settings.value;
  const b = s.bindings.solo;
  return (
    <div class="overlay pause-menu" onClick={(e) => e.target === e.currentTarget && onResume()}>
      <div class="panel col" style={{ width: 'min(92vw, 420px)' }}>
        <div class="row between">
          <h2 class="h2">{params.kind === 'online' ? 'Menu' : 'Pausado'}</h2>
          <Btn kind="ghost" title="Fechar" icon={Icon.close({ size: 20 })} onClick={onResume} />
        </div>
        {params.kind === 'online' && <p class="muted small">A partida online continua rolando enquanto este menu está aberto.</p>}
        {tab === 'menu' && (
          <div class="col">
            <Btn kind="fire" size="lg" icon={Icon.play({ size: 20 })} onClick={onResume} autofocus>
              Continuar
            </Btn>
            {params.kind !== 'online' && (
              <Btn
                kind="ghost"
                icon={Icon.refresh({ size: 20 })}
                onClick={() => {
                  resetTo('game', { ...params });
                }}
              >
                {mission ? 'Reiniciar missão' : 'Reiniciar partida'}
              </Btn>
            )}
            <Btn kind="ghost" icon={Icon.sound({ size: 20 })} onClick={() => setTab('som')}>
              Som e imagem
            </Btn>
            <Btn kind="ghost" icon={Icon.keyboard({ size: 20 })} onClick={() => setTab('controles')}>
              Controles
            </Btn>
            <Btn
              kind="danger"
              icon={Icon.door({ size: 20 })}
              onClick={async () => {
                const ok = await confirmModal(params.kind === 'online' ? 'Abandonar partida?' : 'Sair da partida?', params.kind === 'online' ? 'Abandonar partidas online conta como derrota.' : 'O progresso desta partida será perdido.', 'Sair', true);
                if (!ok) return;
                if (params.kind === 'online') send({ t: 'room.leave' });
                music.play('menu', 3);
                if (mission) resetTo('campaign');
                else resetTo('home');
              }}
            >
              {params.kind === 'online' ? 'Abandonar' : 'Sair para o menu'}
            </Btn>
          </div>
        )}
        {tab === 'som' && (
          <div class="col">
            <label class="field">
              <span>Música</span>
              <Slider value={s.music} onChange={(v) => updateSettings({ music: v })} label="Volume da música" />
            </label>
            <label class="field">
              <span>Efeitos</span>
              <Slider value={s.sfx} onChange={(v) => updateSettings({ sfx: v })} label="Volume dos efeitos" />
            </label>
            <label class="field">
              <span>Tremor de tela</span>
              <Slider value={s.shake} onChange={(v) => updateSettings({ shake: v })} label="Tremor de tela" />
            </label>
            <Btn kind="ghost" icon={Icon.back({ size: 18 })} onClick={() => setTab('menu')}>
              Voltar
            </Btn>
          </div>
        )}
        {tab === 'controles' && (
          <div class="col small">
            {[
              ['Mover', `${keyLabel(b.up[0])} ${keyLabel(b.left[0])} ${keyLabel(b.down[0])} ${keyLabel(b.right[0])} / setas`],
              ['Soltar carga', b.bomb.map(keyLabel).join(' / ')],
              ['Técnica', b.ability.map(keyLabel).join(' / ')],
              ['Cartucho', b.cart.map(keyLabel).join(' / ')],
              ['Emote', b.emote.map(keyLabel).join(' / ')],
              ['Pausar', b.pause.map(keyLabel).join(' / ')],
              ['Controle', 'A carga · B/X técnica · Y/RB cartucho · Start pausa'],
            ].map(([a, k]) => (
              <div class="row between" key={a}>
                <b>{a}</b>
                <span class="muted">{k}</span>
              </div>
            ))}
            <Btn kind="ghost" icon={Icon.back({ size: 18 })} onClick={() => setTab('menu')}>
              Voltar
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

export { B, CHARACTERS, MODES, go, back };
