export function DistributionIllustration() {
  return (
    <svg
      viewBox="0 0 520 410"
      role="img"
      aria-label="Caixas, garrafas e uma rota de entrega"
      className="distribution-art"
    >
      <circle cx="270" cy="208" r="173" fill="var(--gold)" opacity=".45" />
      <path
        d="M49 270c-60-146 129-223 267-192s215 214 118 255"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeDasharray="6 9"
        fill="none"
        opacity=".4"
      />
      <ellipse cx="262" cy="358" rx="166" ry="19" fill="var(--primary)" opacity=".09" />
      <path d="M114 200l147-56 145 57-146 63z" fill="#d6bb96" stroke="#684e39" strokeWidth="2" />
      <path d="M114 200v111l146 60V264z" fill="#e7d2b5" stroke="#684e39" strokeWidth="2" />
      <path d="M260 264l146-63v110l-146 60z" fill="#c09d73" stroke="#684e39" strokeWidth="2" />
      <path
        d="M114 200l-24-45 147-56 24 45m145 57 26-46-145-57-26 46"
        fill="#efe0c9"
        stroke="#684e39"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <g transform="rotate(-9 198 160)">
        <rect x="166" y="96" width="59" height="130" rx="18" fill="var(--primary)" />
        <path d="M179 101V68h32v33" fill="var(--primary)" />
        <rect x="176" y="64" width="38" height="16" rx="5" fill="#c4de86" />
        <rect x="168" y="144" width="55" height="52" rx="4" fill="#fcfaf7" />
        <path d="m181 160 13 20 15-26" fill="none" stroke="var(--primary)" strokeWidth="6" />
      </g>
      <g transform="rotate(12 294 168)">
        <rect
          x="264"
          y="109"
          width="67"
          height="119"
          rx="11"
          fill="#9caf78"
          stroke="#51633b"
          strokeWidth="2"
        />
        <rect x="265" y="115" width="65" height="9" rx="4" fill="#e0e8ca" />
        <path d="M282 138v62m11-68v74" stroke="#fff" opacity=".55" strokeWidth="3" />
        <circle cx="310" cy="177" r="9" fill="#e8edda" />
      </g>
      <path d="M115 201l145 63v107l-145-60z" fill="#e7d2b5" stroke="#684e39" strokeWidth="2" />
      <path d="M260 264l146-63v110l-146 60z" fill="#c09d73" stroke="#684e39" strokeWidth="2" />
      <path
        d="m149 251 24 51 33-30"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m317 273 43-19m-43 28 43-19m-43 29 24-11" stroke="#76532f" strokeWidth="4" />
      <g transform="translate(388 74)">
        <circle r="31" fill="var(--primary)" />
        <path
          d="m-13 0 9 10 18-21"
          fill="none"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
      <path d="m70 110 6-17 6 17 17 6-17 6-6 17-6-17-17-6z" fill="var(--primary)" />
    </svg>
  );
}
