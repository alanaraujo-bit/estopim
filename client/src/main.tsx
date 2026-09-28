import { render } from 'preact';
import '@fontsource/bungee/400.css';
import '@fontsource-variable/rubik';
import './styles/global.css';
import './styles/ui.css';
import './styles/screens.css';
import './styles/menus.css';
import './styles/game.css';
import { App } from './ui/App';

render(<App />, document.getElementById('app')!);
const boot = document.getElementById('boot');
if (boot) {
  boot.style.opacity = '0';
  setTimeout(() => boot.remove(), 450);
}

// Evita zoom por gesto e menu de contexto durante a partida em aparelhos de toque
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => {
  if ((e.target as HTMLElement)?.closest?.('.game-root')) e.preventDefault();
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
