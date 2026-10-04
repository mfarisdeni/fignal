import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import type { Language } from "@/lib/i18n";

/**
 * Language flags drawn as inline SVG.
 *
 * The source art shipped as WebP, but a flag is the one image that is always
 * on screen and always tiny - decoding a 3840px US flag to paint an 18px swatch
 * is wasted work. Both flags are flat geometry, so vector is the cheaper form:
 * no request, no decode, crisp at any size.
 *
 * Geometry follows each flag's own specification. The US flag is
 * 76 by 40 (1.9:1) with thirteen stripes and a union two fifths of the length and seven stripes tall, carrying 50 stars in nine rows alternating six and five. Indonesia is a plain bicolour.
 *
 * One star outline is defined once and reused for all 50; a row of stars is a <use> of one row, so the whole flag is a few kilobytes of markup rather than fifty paths.
 *
 * The hairline ring is not decoration. Half of the Indonesian flag is white,
 * and without it the flag dissolves into a light card.
 */

/** Where the first star column sits, and how far apart the columns are. */
const STAR_X0 = 4.310;
const STAR_STEP = 2.178;

/** One 5-point star, point up, centred on the origin. */
const STAR =
  "M0.000 -0.980L0.220 -0.303L0.932 -0.303L0.356 0.116L0.576 0.793L0.000 0.374L-0.576 0.793L-0.356 0.116L-0.932 -0.303L-0.220 -0.303Z";

/**
 * One row of stars. Six-star rows take the even columns and five-star rows the
 * odd ones, which is what offsets them from each other by half a step.
 */
function starRow(columns: number[]) {
  return columns.map((column, i) => (
    <path
      key={i}
      d={STAR}
      transform={`translate(${(STAR_X0 + column * STAR_STEP).toFixed(2)} 0)`}
    />
  ));
}

const US = (
  <>
    <rect width="76" height="40" fill="#FFFFFF" />
    <path fill="#B31942" d="M0 0.000h76v3.077h-76z" />
    <path fill="#B31942" d="M0 6.154h76v3.077h-76z" />
    <path fill="#B31942" d="M0 12.308h76v3.077h-76z" />
    <path fill="#B31942" d="M0 18.462h76v3.077h-76z" />
    <path fill="#B31942" d="M0 24.615h76v3.077h-76z" />
    <path fill="#B31942" d="M0 30.769h76v3.077h-76z" />
    <path fill="#B31942" d="M0 36.923h76v3.077h-76z" />
    <rect width="30.400" height="21.538" fill="#0A3161" />
    <defs>
      <g fill="#FFFFFF">
        <g id="fignal-us-row6">{starRow([0, 2, 4, 6, 8, 10])}</g>
        <g id="fignal-us-row5">{starRow([1, 3, 5, 7, 9])}</g>
      </g>
    </defs>
    <use href="#fignal-us-row6" y={2.06} />
    <use href="#fignal-us-row5" y={4.24} />
    <use href="#fignal-us-row6" y={6.41} />
    <use href="#fignal-us-row5" y={8.59} />
    <use href="#fignal-us-row6" y={10.77} />
    <use href="#fignal-us-row5" y={12.95} />
    <use href="#fignal-us-row6" y={15.13} />
    <use href="#fignal-us-row5" y={17.30} />
    <use href="#fignal-us-row6" y={19.48} />
  </>
);

const ID = (
  <>
    <rect width="30" height="10" fill="#FF0000" />
    <rect y="10" width="30" height="10" fill="#FFFFFF" />
  </>
);

const GEOMETRY: Record<Language, { viewBox: string; flag: ReactElement }> = {
  en: { viewBox: "0 0 76 40", flag: US },
  id: { viewBox: "0 0 30 20", flag: ID },
};

export function Flag({
  language,
  className,
}: {
  language: Language;
  className?: string;
}) {
  const { viewBox, flag } = GEOMETRY[language];
  const name = language === "en" ? "English" : "Bahasa Indonesia";
  return (
    <span
      className={cn(
        "inline-flex overflow-hidden rounded-[3px] ring-1 ring-black/15 dark:ring-white/20",
        className,
      )}
      title={name}
    >
      <svg viewBox={viewBox} className="h-full w-full" role="img" aria-label={name}>
        {flag}
      </svg>
    </span>
  );
}
