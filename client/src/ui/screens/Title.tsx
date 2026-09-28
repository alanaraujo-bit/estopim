import { useEffect } from 'preact/hooks';
import { audio } from '../../audio/engine';
import { music } from '../../audio/music';
import { sfx } from '../../audio/sfx';
import { go, profile, resetTo } from '../../state/store';
import { Backdrop } from '../Backdrop';
import { CharPortrait } from '../components';
import { Logo } from '../Logo';

export function Title() {
  useEffect(() => {
    const start = () => {
      audio.unlock();
      sfx.confirm();
      music.play('menu', 3);
      const p = profile.value;
      if (!p.name || !p.tutorialDone) go('onboarding', undefined, true);
      else resetTo('home');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      start();
    };
    const pad = setInterval(() => {
      const pads = navigator.getGamepads?.() ?? [];
      if (pads.some((p) => p && p.buttons.some((b) => b.pressed))) start();
    }, 120);
    window.addEventListener('keydown', onKey);
    (window as any).__titleStart = start;
    return () => {
      window.removeEventListener('keydown', onKey);
      clearInterval(pad);
    };
  }, []);
  return (
    <div class="screen title-screen" onClick={() => (window as any).__titleStart?.()}>
      <Backdrop intensity={1.4} />
      <div style={{ position: 'relative' }}>
        <Logo size={1.1} />
        <div class="title-cast">
          <CharPortrait char="tuba" size={110} dir={2} />
          <CharPortrait char="faisca" size={130} dir={2} emote="cheer" />
          <CharPortrait char="lume" size={110} dir={2} />
        </div>
        <div class="press">Toque ou pressione qualquer tecla</div>
      </div>
      <div class="foot">v0.1 • Feito com fogo no Brasil</div>
    </div>
  );
}
