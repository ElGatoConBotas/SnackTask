import confetti from 'canvas-confetti';

const COLORS = ['#8DB59F', '#F2B8A0', '#C7C1E4', '#A8CBE6', '#F2DE9F', '#E79A8C'];

function reduced(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Big burst for an on-time finish, a small puff otherwise. */
export function celebrate(big: boolean) {
  if (reduced()) return;
  if (big) {
    confetti({ particleCount: 140, spread: 90, startVelocity: 42, origin: { y: 0.65 }, colors: COLORS, disableForReducedMotion: true });
  } else {
    confetti({ particleCount: 30, spread: 50, startVelocity: 25, scalar: 0.8, origin: { y: 0.7 }, colors: COLORS, disableForReducedMotion: true });
  }
}
