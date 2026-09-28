/** Logotipo ESTOPIM com pavio aceso animado. */
export function Logo({ size = 1, sub = true }: { size?: number; sub?: boolean }) {
  return (
    <div class="logo" style={{ '--ls': size } as any}>
      <div class="logo-word" aria-label="ESTOPIM">
        {'ESTOPIM'.split('').map((ch, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.06}s` }}>
            {ch}
          </span>
        ))}
      </div>
      <svg class="logo-fuse" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">
        <path id="fusepath" d="M4 10 C 60 34, 120 2, 170 22 S 260 30, 296 12" />
        <path class="burnt" d="M4 10 C 60 34, 120 2, 170 22 S 260 30, 296 12" />
      </svg>
      <div class="logo-spark" aria-hidden="true" />
      {sub && <div class="logo-sub">arena tática de explosivos</div>}
    </div>
  );
}
