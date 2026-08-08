interface VinylBadgeProps {
  size?: number
  label?: string
  spinning?: boolean
  className?: string
}

/** The app's signature motif: a record disc used as a badge / "now playing" indicator. */
function VinylBadge({ size = 64, label, spinning = false, className = '' }: VinylBadgeProps) {
  const r = size / 2
  const grooveRadii = [r - 6, r - 12, r - 18, r - 24].filter((gr) => gr > r * 0.42)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`${spinning ? 'animate-spin-record' : ''} ${className}`}
      role="img"
      aria-label={label ? `${label} vinyl badge` : 'vinyl record'}
    >
      <circle cx={r} cy={r} r={r - 2} fill="var(--color-ink)" stroke="var(--color-ink)" strokeWidth={3} />
      {grooveRadii.map((gr) => (
        <circle key={gr} cx={r} cy={r} r={gr} fill="none" stroke="var(--color-paper)" strokeOpacity={0.18} strokeWidth={1} />
      ))}
      <circle cx={r} cy={r} r={r * 0.4} fill="var(--color-rose)" stroke="var(--color-ink)" strokeWidth={2} />
      <circle cx={r} cy={r} r={r * 0.06} fill="var(--color-paper)" />
      {label && (
        <text
          x={r}
          y={r}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-display)"
          fontSize={r * 0.42}
          fill="var(--color-paper)"
          letterSpacing="0.02em"
        >
          {label}
        </text>
      )}
    </svg>
  )
}

export default VinylBadge
