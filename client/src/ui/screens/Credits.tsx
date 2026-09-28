import { CHAR_ORDER } from '@estopim/shared';
import { Backdrop } from '../Backdrop';
import { BackBar, CharPortrait } from '../components';
import { Logo } from '../Logo';

export function Credits() {
  return (
    <div class="screen screen-anim">
      <Backdrop intensity={1.2} />
      <BackBar title="Créditos" />
      <div class="credits scroll">
        <Logo size={0.7} />
        <div class="row wrap center" style={{ gap: 0 }}>
          {CHAR_ORDER.map((c) => (
            <CharPortrait key={c} char={c} size={90} />
          ))}
        </div>
        <div class="panel col" style={{ maxWidth: 560, textAlign: 'center' }}>
          <p>
            <b>ESTOPIM</b> é um jogo original de arena tática, feito com carinho no Brasil.
          </p>
          <p class="small muted">Toda a arte, personagens, música e efeitos sonoros foram criados especialmente para o jogo — a arte é desenhada em tempo real e a trilha é composta e sintetizada ao vivo no seu navegador.</p>
          <p class="small muted">Tipografia: Bungee (David Jonathan Ross) e Rubik (Hubert &amp; Fischer), licença SIL Open Font.</p>
          <p class="small muted">Obrigado por jogar. Que o seu pavio nunca apague.</p>
        </div>
      </div>
    </div>
  );
}
