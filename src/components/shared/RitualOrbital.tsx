interface RitualOrbitalProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
  showNodes?: boolean;
}

/**
 * RitualOrbital — Fine-line orbital and ritual geometry for SANKALPA.
 * Visual representation of an intention -> a path -> a completed commitment.
 * Extremely subtle, low opacity, purely decorative and accessible.
 */
export function RitualOrbital({
  size = 'md',
  className = '',
  showNodes = true,
}: RitualOrbitalProps) {
  const dimensions = {
    sm: { width: 120, height: 120, r1: 52, r2: 36, r3: 20 },
    md: { width: 220, height: 220, r1: 98, r2: 68, r3: 38 },
    lg: { width: 340, height: 340, r1: 154, r2: 108, r3: 62 },
    hero: { width: 440, height: 440, r1: 200, r2: 140, r3: 80 },
  }[size];

  const center = dimensions.width / 2;

  return (
    <svg
      width={dimensions.width}
      height={dimensions.height}
      viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    >
      {/* Outer subtle orbital path */}
      <circle
        cx={center}
        cy={center}
        r={dimensions.r1}
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 6"
        className="opacity-20 dark:opacity-25"
      />

      {/* Middle ring */}
      <circle
        cx={center}
        cy={center}
        r={dimensions.r2}
        stroke="currentColor"
        strokeWidth="1"
        className="opacity-15 dark:opacity-20"
      />

      {/* Inner core circle */}
      <circle
        cx={center}
        cy={center}
        r={dimensions.r3}
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 4"
        className="opacity-25 dark:opacity-30"
      />

      {/* Center anchor point */}
      <circle
        cx={center}
        cy={center}
        r="2"
        fill="currentColor"
        className="opacity-40"
      />

      {showNodes && (
        <>
          {/* Intention node: top */}
          <circle
            cx={center}
            cy={center - dimensions.r1}
            r="3.5"
            fill="currentColor"
            className="opacity-40"
          />
          <circle
            cx={center}
            cy={center - dimensions.r1}
            r="1.5"
            className="fill-white dark:fill-neutral-900"
          />

          {/* Practice node: right */}
          <circle
            cx={center + dimensions.r2}
            cy={center}
            r="3"
            fill="currentColor"
            className="opacity-35"
          />

          {/* Witness node: bottom left */}
          <circle
            cx={center - dimensions.r2 * 0.707}
            cy={center + dimensions.r2 * 0.707}
            r="3"
            fill="currentColor"
            className="opacity-35"
          />

          {/* Trust node: outer arc */}
          <circle
            cx={center + dimensions.r1 * 0.866}
            cy={center - dimensions.r1 * 0.5}
            r="2.5"
            fill="currentColor"
            className="opacity-30"
          />
        </>
      )}
    </svg>
  );
}
