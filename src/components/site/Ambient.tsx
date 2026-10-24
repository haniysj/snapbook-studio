/**
 * Slow, subtle animated background: the theme's pattern drifting diagonally plus
 * soft glowing orbs in the theme's gradient colors. Purely decorative, behind all content.
 */
export function Ambient() {
  return (
    <div aria-hidden className="ambient">
      <div className="ambient-glow" />
      <div className="ambient-pattern" />
      <div className="ambient-orb ambient-orb-1" />
      <div className="ambient-orb ambient-orb-2" />
      <div className="ambient-orb ambient-orb-3" />
    </div>
  );
}
