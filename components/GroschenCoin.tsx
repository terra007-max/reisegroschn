/**
 * GroschenCoin — animated Austrian Schilling Groschen coin.
 * Spins on its Y-axis like a real coin tossed on a table.
 */

interface GroschenCoinProps {
  size?: number;
  className?: string;
}

export default function GroschenCoin({ size = 48, className = "" }: GroschenCoinProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: "inline-block",
        perspective: size * 4,
      }}
    >
      <style>{`
        @keyframes groschenSpin {
          0%   { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
        .groschen-spin {
          animation: groschenSpin 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          transform-style: preserve-3d;
          transform-origin: center center;
        }
      `}</style>

      <svg
        className="groschen-spin"
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gold radial gradient — coin face */}
          <radialGradient id="coinFace" cx="38%" cy="35%" r="60%">
            <stop offset="0%"   stopColor="#FFF0A0" />
            <stop offset="30%"  stopColor="#F5C842" />
            <stop offset="70%"  stopColor="#D4960A" />
            <stop offset="100%" stopColor="#A06800" />
          </radialGradient>

          {/* Darker gradient for the rim */}
          <radialGradient id="coinRim" cx="50%" cy="50%" r="50%">
            <stop offset="80%"  stopColor="#B8820C" />
            <stop offset="100%" stopColor="#7A5200" />
          </radialGradient>

          {/* Inner shadow for depth */}
          <radialGradient id="innerShadow" cx="60%" cy="65%" r="55%">
            <stop offset="0%"   stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
          </radialGradient>

          {/* Sheen highlight */}
          <radialGradient id="sheen" cx="35%" cy="28%" r="40%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* Outer rim */}
        <circle cx="50" cy="50" r="49" fill="url(#coinRim)" />

        {/* Coin face */}
        <circle cx="50" cy="50" r="44" fill="url(#coinFace)" />

        {/* Milled edge detail — small tick marks around rim */}
        {Array.from({ length: 36 }).map((_, i) => {
          const angle = (i * 10 * Math.PI) / 180;
          const x1 = 50 + 44 * Math.cos(angle);
          const y1 = 50 + 44 * Math.sin(angle);
          const x2 = 50 + 48 * Math.cos(angle);
          const y2 = 50 + 48 * Math.sin(angle);
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#A06800"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          );
        })}

        {/* Inner depth shadow */}
        <circle cx="50" cy="50" r="44" fill="url(#innerShadow)" />

        {/* ── Austrian Eagle (simplified heraldic silhouette) ── */}
        <g transform="translate(50,46) scale(0.78)" fill="#8B5E00">
          {/* Body */}
          <ellipse cx="0" cy="4" rx="9" ry="11" />
          {/* Head */}
          <circle cx="0" cy="-10" r="6" />
          {/* Beak */}
          <polygon points="4,-10 8,-8 4,-7" />
          {/* Crown outline (Habsburg crown hint) */}
          <rect x="-5" y="-17" width="10" height="4" rx="1" />
          <rect x="-6.5" y="-20" width="3.5" height="4" rx="1" />
          <rect x="-1.75" y="-21" width="3.5" height="5" rx="1" />
          <rect x="3" y="-20" width="3.5" height="4" rx="1" />
          {/* Left wing */}
          <path d="M -9 -2 C -22 -10 -26 2 -18 8 C -14 4 -9 6 -9 2 Z" />
          {/* Right wing */}
          <path d="M 9 -2 C 22 -10 26 2 18 8 C 14 4 9 6 9 2 Z" />
          {/* Tail feathers */}
          <path d="M -6 14 C -8 20 -4 22 0 20 C 4 22 8 20 6 14 Z" />
          {/* Talons */}
          <ellipse cx="-4" cy="16" rx="3" ry="1.5" />
          <ellipse cx="4"  cy="16" rx="3" ry="1.5" />
        </g>

        {/* Circular text — REPUBLIK ÖSTERREICH */}
        <path
          id="topArc"
          d="M 12,50 A 38,38 0 0,1 88,50"
          fill="none"
        />
        <text fontSize="7.2" fill="#7A5200" fontFamily="serif" letterSpacing="1.5">
          <textPath href="#topArc" startOffset="8%">
            REPUBLIK ÖSTERREICH
          </textPath>
        </text>

        {/* Bottom denomination */}
        <path
          id="bottomArc"
          d="M 18,62 A 38,38 0 0,0 82,62"
          fill="none"
        />
        <text fontSize="8.5" fill="#7A5200" fontFamily="serif" fontWeight="bold" letterSpacing="2">
          <textPath href="#bottomArc" startOffset="18%">
            10 GROSCHEN
          </textPath>
        </text>

        {/* Sheen highlight */}
        <circle cx="50" cy="50" r="44" fill="url(#sheen)" />
      </svg>
    </div>
  );
}
