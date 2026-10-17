import { useId } from "react";
export function AcaiIllustration({
  className = "",
  simple = false,
}: {
  className?: string;
  simple?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 440 380" className={className} aria-hidden="true" fill="none">
      <defs>
        <linearGradient
          id={`${id}b`}
          x1="90"
          y1="200"
          x2="350"
          y2="350"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#e7d8f6" />
          <stop offset="1" stopColor="#b798d3" />
        </linearGradient>
        <linearGradient id={`${id}a`} x1="120" y1="80" x2="330" y2="220">
          <stop stopColor="#814b9e" />
          <stop offset="1" stopColor="#391249" />
        </linearGradient>
      </defs>
      <ellipse cx="218" cy="337" rx="134" ry="15" fill="#240931" opacity=".12" />
      <path d="M74 187c7 89 55 147 144 147s138-58 145-147H74Z" fill={`url(#${id}b)`} />
      <path
        d="M83 212c25 12 74 22 135 22 66 0 112-11 136-22"
        stroke="#fff"
        strokeOpacity=".45"
        strokeWidth="3"
      />
      <ellipse cx="218" cy="185" rx="146" ry="66" fill="#f4ebfa" />
      <ellipse cx="218" cy="180" rx="136" ry="56" fill={`url(#${id}a)`} />
      <path
        d="M105 179c19-35 81-47 123-32 30 11 42 33 91 21M109 196c51-34 82 13 133-3 42-14 51-10 78 2"
        stroke="#aa75be"
        strokeWidth="7"
        strokeLinecap="round"
        opacity=".6"
      />
      {!simple && (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i} transform={`translate(${123 + i * 30} ${153 + i * 6}) rotate(-22)`}>
              <ellipse rx="20" ry="13" fill="#f6e6a3" stroke="#ddc780" strokeWidth="2" />
              <ellipse rx="6" ry="4" fill="#c6a15b" opacity=".6" />
            </g>
          ))}
          <g transform="translate(282 148) rotate(18)">
            <path
              d="M-27-10C-30-36 31-36 28-10c-2 17-19 40-28 42-10-1-24-25-27-42Z"
              fill="#ed6b86"
            />
            <path d="M-21-22 0-11 21-23 7-33-8-33Z" fill="#84a74f" />
            {[-14, 0, 14].map((x, i) => (
              <path
                key={x}
                d={`M${x} ${i % 2 ? 2 : -5}v4`}
                stroke="#ffdda4"
                strokeWidth="3"
                strokeLinecap="round"
              />
            ))}
          </g>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <g key={i}>
              <circle
                cx={283 + (i % 3) * 19}
                cy={184 + Math.floor(i / 3) * 11}
                r="11"
                fill={i % 2 ? "#32134c" : "#53286c"}
              />
              <circle
                cx={279 + (i % 3) * 19}
                cy={180 + Math.floor(i / 3) * 11}
                r="3"
                fill="#b798d3"
                opacity=".5"
              />
            </g>
          ))}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <ellipse
              key={i}
              cx={140 + (i % 3) * 14}
              cy={192 + Math.floor(i / 3) * 7}
              rx="5"
              ry="3"
              fill={i % 2 ? "#dfb97d" : "#f4d79c"}
              transform={`rotate(${i * 13} 160 200)`}
            />
          ))}
          <path d="m295 109 34-75" stroke="#d1bb9d" strokeWidth="10" strokeLinecap="round" />
          <ellipse cx="333" cy="26" rx="13" ry="24" transform="rotate(25 333 26)" fill="#d1bb9d" />
        </>
      )}
      <path
        d="M176 266h82M192 279h50"
        stroke="#62377e"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".35"
      />
      <path d="m214 245 5-8 5 8-5 7-5-7Z" fill="#64377e" />
    </svg>
  );
}
