import { useRef } from "react";
import { useReducedMotion } from "framer-motion";
export function HeroDocumentScene({
  compact = false,
  staticScene = false,
}: {
  compact?: boolean;
  staticScene?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const motionReduced = useReducedMotion();
  const reduced = staticScene || motionReduced;
  return (
    <svg
      ref={ref}
      className={"hero-scene" + (compact ? " compact-scene" : "")}
      viewBox="0 0 900 300"
      role="img"
      aria-label="层叠纸张与合规盾牌"
      onPointerMove={(e) => {
        if (!reduced && ref.current) {
          const r = ref.current.getBoundingClientRect();
          ref.current.style.setProperty(
            "--px",
            `${((e.clientX - r.x) / r.width - 0.5) * (compact ? 2 : 6)}px`,
          );
          ref.current.style.setProperty(
            "--py",
            `${((e.clientY - r.y) / r.height - 0.5) * (compact ? 1 : 4)}px`,
          );
        }
      }}
      onPointerLeave={() => {
        ref.current?.style.setProperty("--px", "0px");
        ref.current?.style.setProperty("--py", "0px");
      }}
    >
      <defs>
        <linearGradient id="paper" x2="1" y2="1">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#f4eee5" />
        </linearGradient>
        <linearGradient id="gold" x2=".85" y2="1">
          <stop stopColor="#f4dfbc" />
          <stop offset=".55" stopColor="#c4a37a" />
          <stop offset="1" stopColor="#ab865b" />
        </linearGradient>
        <radialGradient id="haze">
          <stop stopColor="#e3d7c8" stopOpacity=".55" />
          <stop offset="1" stopColor="#e3d7c8" stopOpacity="0" />
        </radialGradient>
        <filter id="paperShadow">
          <feDropShadow
            dx="0"
            dy="9"
            stdDeviation="8"
            floodColor="#a99a86"
            floodOpacity=".12"
          />
        </filter>
      </defs>
      <ellipse cx="490" cy="170" rx="350" ry="190" fill="url(#haze)" />
      <path
        d="M-40 170 C210 30 290 320 565 180 S800 30 950 55"
        fill="none"
        stroke="#fff"
        strokeOpacity=".65"
        strokeWidth="36"
      />
      <path
        d="M-30 210 C180 100 390 330 690 150 S890 115 940 75"
        fill="none"
        stroke="#dfd6cb"
        strokeOpacity=".3"
        strokeWidth="24"
      />
      <path
        d="M-10 166 C225 78 290 272 555 215 S765 63 930 115"
        fill="none"
        stroke="#fff"
        strokeWidth="1.2"
      />
      <g className="paper-parallax">
        <g
          className="paper-layer paper-back"
          transform="translate(415 37) rotate(13)"
        >
          <rect
            x="0"
            y="0"
            width="203"
            height="231"
            rx="3"
            fill="#ede5da"
            fillOpacity=".3"
            stroke="#fff"
          />
        </g>
        <g className="paper-layer" transform="translate(465 26) rotate(9)">
          <rect
            width="198"
            height="235"
            rx="3"
            fill="#eee4d7"
            fillOpacity=".45"
            stroke="#fff"
          />
        </g>
        <g className="paper-layer paper-main" filter="url(#paperShadow)">
          <path d="M436 27 L628 52 L575 276 L381 249 Z" fill="url(#paper)" />
          <g stroke="#e5e0d8" strokeOpacity=".5" strokeWidth="6">
            <path d="M457 67 l117 15 M453 84 l105 14 M449 101 l115 15 M445 118 l89 12 M441 135 l117 15 M437 152 l111 15 M433 169 l72 10 M423 206 l95 12 M419 223 l113 15" />
          </g>
        </g>
        <g className="shield">
          <path
            d="M568 138 Q582 153 604 156 Q602 207 557 229 Q530 205 529 162 Q551 158 568 138Z"
            fill="#fff9ef"
            stroke="#e9d6ba"
            strokeWidth="2"
          />
          <path
            d="M568 147 Q582 160 595 163 Q592 201 558 219 Q539 199 538 169 Q554 162 568 147Z"
            fill="url(#gold)"
          />
          <path
            d="M551 180 l9 12 20 -18"
            fill="none"
            stroke="#fffaf1"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
      <g fill="none" stroke="#d7b589" strokeWidth=".8" opacity=".7">
        <path id="orbit" d="M220 235 C300 280 726 223 768 62" />
        <path d="M128 97 C256 137 438 279 695 245" />
        <path d="M318 273 C365 206 338 89 425 64" />
      </g>
      {
        <g fill="url(#gold)">
          <circle cx={reduced ? 220 : 0} cy={reduced ? 235 : 0} r="4">
            {!reduced && (
              <animateMotion
                dur="28s"
                repeatCount="indefinite"
                path="M220 235 C300 280 726 223 768 62"
              />
            )}
          </circle>
          <circle cx="768" cy="62" r="4" />
          <circle cx="318" cy="179" r="4" />
          <circle cx="657" cy="233" r="4" />
          <circle cx="195" cy="131" r="4" />
        </g>
      }
      {
        <g
          className="floating-tags"
          fontFamily="SimSun,serif"
          fontSize="16"
          fill="#8e897f"
        >
          <g transform="translate(206 57) rotate(5)">
            <rect
              width="105"
              height="61"
              rx="3"
              fill="#fff"
              fillOpacity=".24"
              stroke="#fff"
            />
            <text x="26" y="37">
              更合规
            </text>
          </g>
          <g transform="translate(127 111) rotate(5)">
            <rect
              width="107"
              height="70"
              rx="3"
              fill="#fff"
              fillOpacity=".22"
              stroke="#fff"
            />
            <text x="25" y="43">
              更专业
            </text>
          </g>
          <g transform="translate(248 155) rotate(5)">
            <rect
              width="110"
              height="66"
              rx="3"
              fill="#fff"
              fillOpacity=".2"
              stroke="#fff"
            />
            <text x="26" y="39">
              更安心
            </text>
          </g>
        </g>
      }
    </svg>
  );
}
