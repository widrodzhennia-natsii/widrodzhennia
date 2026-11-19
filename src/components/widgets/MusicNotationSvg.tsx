import React, { useId } from 'react';
import { NoteDurationId, RhythmBeatType } from '../../core/audio/musicTheory';

interface BeatNotationSvgProps {
  kind: RhythmBeatType;
  durationId?: NoteDurationId;
  active?: boolean;
  size?: number;
}

/**
 * Crisp international musical notation SVG glyph (oval noteheads, stems, accent mark,
 * beamed eighth note, real quarter-rest path) with monochrome-safe SVG hatch patterns.
 */
export const BeatNotationSvg: React.FC<BeatNotationSvgProps> = ({
  kind,
  durationId,
  active = false,
  size = 28,
}) => {
  const uid = useId().replace(/:/g, '');
  const hatchId = `music_hatch_${uid}`;
  const effectiveDuration: NoteDurationId | 'rest' =
    kind === 'rest' ? 'rest' : durationId ?? (kind === 'sub' ? 'eighth' : 'quarter');

  const fillToken = active ? `url(#${hatchId})` : 'currentColor';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <pattern id={hatchId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="4" fill="currentColor" fillOpacity="0.32" />
          <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="1.6" />
        </pattern>
      </defs>

      {effectiveDuration === 'rest' ? (
        /* Real musical quarter-rest squiggle glyph */
        <path
          d="M14.5 6.5 L19 11.2 L14.8 15.8 L19.2 20.5 C16.4 20.2 14.4 21.8 15.2 24.5 C15.7 25.8 17 26.5 18 26.5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : effectiveDuration === 'whole' ? (
        <ellipse
          cx="16"
          cy="17"
          rx="6.2"
          ry="4.2"
          transform="rotate(-14 16 17)"
          stroke="currentColor"
          strokeWidth="2.3"
          fill={active ? `url(#${hatchId})` : 'none'}
        />
      ) : effectiveDuration === 'half' ? (
        <g>
          <ellipse
            cx="13"
            cy="22"
            rx="5.4"
            ry="3.8"
            transform="rotate(-18 13 22)"
            stroke="currentColor"
            strokeWidth="2.2"
            fill={active ? `url(#${hatchId})` : 'none'}
          />
          <line x1="17.8" y1="21.5" x2="17.8" y2="6.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        </g>
      ) : effectiveDuration === 'eighth' ? (
        <g>
          <ellipse
            cx="12.5"
            cy="22"
            rx="5.2"
            ry="3.7"
            transform="rotate(-18 12.5 22)"
            fill={fillToken}
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <line x1="17.1" y1="21.2" x2="17.1" y2="6.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          <path
            d="M17.1 6.8 C21.8 8.8 23.2 12.6 21 16.5"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      ) : effectiveDuration === 'sixteenth' ? (
        <g>
          <ellipse
            cx="12"
            cy="22"
            rx="5.0"
            ry="3.5"
            transform="rotate(-18 12 22)"
            fill={fillToken}
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <line x1="16.5" y1="21.2" x2="16.5" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M16.5 6.2 C21.2 8 22.8 11.4 20.8 14.5 M16.5 11.2 C21.2 13 22.8 16.2 20.8 19.2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      ) : (
        /* Quarter note (1/4), with international '>' accent mark for strong downbeat */
        <g>
          {kind === 'strong' && (
            <path
              d="M7.5 3.5 L15.5 6.2 L7.5 8.8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
          <ellipse
            cx="13"
            cy="22"
            rx="5.3"
            ry="3.8"
            transform="rotate(-18 13 22)"
            fill={fillToken}
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <line x1="17.6" y1="21.2" x2="17.6" y2="6.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
};

interface MiniStaffNoteSvgProps {
  /** Diatonic step relative to C4 (C4 = 0, D4 = 1, E4 = 2, F4 = 3, G4 = 4, A4 = 5, B4 = 6, C5 = 7) */
  staffStep: number;
  isFlat?: boolean;
  active?: boolean;
}

/**
 * Compact 5-line Treble Musical Staff (Нотний стан) showing the exact note position
 * from C4 (with ledger line) up to C5, aiding cross-literacy in UA and international notation.
 */
export const MiniStaffNoteSvg: React.FC<MiniStaffNoteSvgProps> = ({
  staffStep,
  isFlat = false,
  active = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const hatchId = `staff_hatch_${uid}`;
  // Five staff lines correspond to steps 2(E4), 4(G4), 6(B4), 8(D5), 10(F5)
  // Step spacing = 3.2px; bottom line E4 (step 2) sits at y = 29
  const stepSpacing = 3.2;
  const noteY = 29 - (staffStep - 2) * stepSpacing;
  const staffLines = [2, 4, 6, 8, 10].map((s) => 29 - (s - 2) * stepSpacing);

  return (
    <svg viewBox="0 0 64 42" className="w-full h-11" aria-hidden="true">
      <defs>
        <pattern id={hatchId} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="3" fill="var(--accent)" fillOpacity="0.35" />
          <line x1="0" y1="0" x2="0" y2="3" stroke="var(--accent)" strokeWidth="1.2" />
        </pattern>
      </defs>

      {staffLines.map((y, idx) => (
        <line
          key={idx}
          x1="6"
          y1={y}
          x2="58"
          y2={y}
          stroke="var(--border-hover)"
          strokeWidth="1"
        />
      ))}

      {/* Ledger line for До / C4 (staffStep === 0) */}
      {staffStep <= 0 && (
        <line
          x1="25"
          y1={noteY}
          x2="43"
          y2={noteY}
          stroke="var(--text-muted)"
          strokeWidth="1.2"
        />
      )}

      {/* Flat accidental ♭ */}
      {isFlat && (
        <text
          x="21"
          y={noteY + 3.5}
          fontSize="10"
          fontWeight="800"
          fill="var(--primary-dark)"
          textAnchor="middle"
        >
          ♭
        </text>
      )}

      {/* Notehead + Stem */}
      <ellipse
        cx="34"
        cy={noteY}
        rx="4.6"
        ry="3.1"
        transform={`rotate(-15 34 ${noteY})`}
        fill={active ? `url(#${hatchId})` : 'var(--accent)'}
        stroke="var(--primary-dark)"
        strokeWidth="1.2"
      />
      <line
        x1={staffStep >= 6 ? 29.7 : 38.3}
        y1={noteY}
        x2={staffStep >= 6 ? 29.7 : 38.3}
        y2={staffStep >= 6 ? noteY + 13 : noteY - 13}
        stroke="var(--primary-dark)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
};
