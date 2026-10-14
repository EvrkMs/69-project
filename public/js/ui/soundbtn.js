import { $ } from '../state.js';
import { isMuted, setMuted } from '../audio/sound.js';

// Round speaker button in the bottom-right corner; the M key does the same. The choice is remembered.
export function initSoundButton() {
  const btn = $('soundBtn');
  const paint = () => {
    btn.textContent = isMuted() ? '🔇' : '🔊';
    btn.setAttribute('aria-pressed', String(isMuted()));
  };
  const toggle = () => { setMuted(!isMuted()); paint(); };
  btn.addEventListener('click', toggle);
  addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'm' && !e.repeat && !e.ctrlKey && !e.metaKey) toggle(); });
  paint();
}
