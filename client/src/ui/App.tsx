import { useEffect } from 'preact/hooks';
import { go, profile, resetTo, route } from '../state/store';
import { onMsg, send } from '../net/client';
import { applySettings } from '../state/settings';
import { ModalHost, ToastHost } from './components';
import { useMenuNavigation } from './menuNav';
import { Title } from './screens/Title';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Play } from './screens/Play';
import { Setup } from './screens/Setup';
import { GameScreen } from './screens/GameScreen';
import { Results } from './screens/Results';
import { Campaign } from './screens/Campaign';
import { Briefing } from './screens/Briefing';
import { Online } from './screens/Online';
import { Lobby } from './screens/Lobby';
import { Queue } from './screens/Queue';
import { Locker } from './screens/Locker';
import { Shop } from './screens/Shop';
import { Season } from './screens/Season';
import { Challenges } from './screens/Challenges';
import { ProfileScreen } from './screens/Profile';
import { Rankings } from './screens/Rankings';
import { Friends } from './screens/Friends';
import { SettingsScreen } from './screens/Settings';
import { Credits } from './screens/Credits';
import { initNet } from '../net/client';
export { go };

export function App() {
  useEffect(() => {
    applySettings();
    initNet();
    // início de partida online: navega para o jogo a partir de qualquer tela (fila, lobby, resultados)
    const off = onMsg((m) => {
      if (m.t === 'start' && route.value.id !== 'game') resetTo('game', { kind: 'online', start: m.m });
    });
    // link de convite ?sala=CODIGO
    const code = new URLSearchParams(location.search).get('sala');
    if (code) {
      history.replaceState(null, '', location.pathname);
      const tryJoin = () => {
        if (send({ t: 'room.join', code: code.toUpperCase(), char: profile.value.favoriteChar })) go('lobby', {});
        else setTimeout(tryJoin, 1000);
      };
      setTimeout(tryJoin, 1200);
    }
    return off;
  }, []);
  useMenuNavigation();
  const r = route.value;
  let screen;
  switch (r.id) {
    case 'title':
      screen = <Title />;
      break;
    case 'onboarding':
      screen = <Onboarding />;
      break;
    case 'home':
      screen = <Home />;
      break;
    case 'play':
      screen = <Play />;
      break;
    case 'setup':
      screen = <Setup params={r.params} />;
      break;
    case 'game':
      screen = <GameScreen params={r.params} />;
      break;
    case 'results':
      screen = <Results params={r.params} />;
      break;
    case 'campaign':
      screen = <Campaign params={r.params} />;
      break;
    case 'briefing':
      screen = <Briefing params={r.params} />;
      break;
    case 'online':
      screen = <Online />;
      break;
    case 'lobby':
      screen = <Lobby />;
      break;
    case 'queue':
      screen = <Queue params={r.params} />;
      break;
    case 'locker':
      screen = <Locker />;
      break;
    case 'shop':
      screen = <Shop />;
      break;
    case 'season':
      screen = <Season />;
      break;
    case 'challenges':
      screen = <Challenges params={r.params} />;
      break;
    case 'profile':
      screen = <ProfileScreen params={r.params} />;
      break;
    case 'rankings':
      screen = <Rankings />;
      break;
    case 'friends':
      screen = <Friends />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    case 'credits':
      screen = <Credits />;
      break;
  }
  return (
    <>
      <div key={r.id} style={{ position: 'absolute', inset: 0 }}>
        {screen}
      </div>
      <ToastHost />
      <ModalHost />
    </>
  );
}
