"use client";

/** Brand mascot from Little Lovely Pets design system (SVG, species `brand` only). */
export function BrandMascot({ size = 42 }: { size?: number }) {
  const c = {
    face: "var(--primary-bright, #ff8da1)",
    faceD: "#f06d85",
    ear: "var(--primary, #9c3f53)",
    inner: "#ffd1d9",
    nose: "#7a2336",
  };
  return (
    <svg
      aria-label="Little Lovely Pets mascot"
      role="img"
      height={size}
      viewBox="0 0 100 100"
      width={size}
      className="shrink-0 overflow-visible"
      style={{ animation: "llp-float-y 5s ease-in-out infinite" }}
    >
      <g>
        <ellipse
          cx="30"
          cy="26"
          fill={c.ear}
          rx="13"
          ry="15"
          transform="rotate(-18 30 26)"
        />
        <ellipse
          cx="70"
          cy="26"
          fill={c.ear}
          rx="13"
          ry="15"
          transform="rotate(18 70 26)"
        />
      </g>
      <ellipse cx="50" cy="58" fill={c.face} rx="36" ry="33" />
      <ellipse cx="50" cy="58" fill="url(#llp-mg)" rx="36" ry="33" />
      <defs>
        <radialGradient cx="50%" cy="35%" id="llp-mg" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="100%" stopColor={c.faceD} stopOpacity="0.25" />
        </radialGradient>
      </defs>
      <ellipse cx="30" cy="66" fill="#ff90a6" opacity="0.44" rx="8" ry="5" />
      <ellipse cx="70" cy="66" fill="#ff90a6" opacity="0.44" rx="8" ry="5" />
      <g
        style={{
          transformOrigin: "center",
          animation: "llp-blink 5.5s infinite",
        }}
      >
        <circle cx="38" cy="54" fill="#2a2024" r="4.6" />
        <circle cx="62" cy="54" fill="#2a2024" r="4.6" />
        <circle cx="39.6" cy="52.4" fill="#fff" r="1.5" />
        <circle cx="63.6" cy="52.4" fill="#fff" r="1.5" />
      </g>
      <path d="M46 64 Q50 68 54 64 Q50 67 46 64 Z" fill={c.nose} />
      <path
        d="M50 67 Q50 72 45 73 M50 67 Q50 72 55 73"
        fill="none"
        stroke={c.nose}
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}
