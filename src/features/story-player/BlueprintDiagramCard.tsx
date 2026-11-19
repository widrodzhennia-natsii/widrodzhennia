import React, { useId } from 'react';
import { Blueprint } from '../../core/contracts/blueprint.schema';

interface BlueprintDiagramCardProps {
  blueprint?: Blueprint | Record<string, any>;
  geometry?: Record<string, any>;
  /** Keys hidden behind `?` until calculated by the student */
  maskedKeys?: string[];
  /** Keys unlocked during multi-component / progressive calculation */
  unlockedKeys?: string[];
  /** Optional claim shown in Logical Review mode */
  claimedBanner?: { label?: string; value: string | number };
}

const KEY_TRANSLATIONS: Record<string, { label: string; unit?: string }> = {
  totalWidthCm: { label: 'Загальна ширина', unit: 'см' },
  totalWidth: { label: 'Загальна ширина', unit: 'см' },
  widthCm: { label: 'Ширина', unit: 'см' },
  width: { label: 'Ширина' },
  doorLeftWidthCm: { label: 'Ліва стулка', unit: 'см' },
  doorRightWidthCm: { label: 'Права стулка', unit: 'см' },
  doorsSumCm: { label: 'Ширина обох стулок', unit: 'см' },
  leftWidthCm: { label: 'Ліва частина', unit: 'см' },
  rightWidthCm: { label: 'Права частина', unit: 'см' },
  beamThicknessCm: { label: 'Товщина бічної балки', unit: 'см' },
  thicknessCm: { label: 'Товщина елемента', unit: 'см' },
  archHeightCm: { label: 'Висота арки', unit: 'см' },
  heightCm: { label: 'Висота', unit: 'см' },
  height: { label: 'Висота' },
  heightMeters: { label: 'Висота', unit: 'м' },
  lengthCm: { label: 'Довжина', unit: 'см' },
  length: { label: 'Довжина' },
  depthCm: { label: 'Глибина', unit: 'см' },
  depth: { label: 'Глибина' },
  spanMeters: { label: 'Проліт', unit: 'м' },
  totalSpanMeters: { label: 'Загальний проліт', unit: 'м' },
  clearanceCm: { label: 'Внутрішній просвіт', unit: 'см' },
  centerGapCm: { label: 'Арковий просвіт', unit: 'см' },
  gapCm: { label: 'Монтажний зазор', unit: 'см' },
  pillars: { label: 'Кількість опор', unit: 'шт.' },
  beamsRequired: { label: 'Балки несучі', unit: 'шт.' },
  planksRequired: { label: 'Дошки обшивки', unit: 'шт.' },
  nailsRequired: { label: 'Кріплення', unit: 'шт.' },
  steelBolts: { label: 'Сталеві стяжки', unit: 'шт.' },
  loadCapacityTons: { label: 'Несуча здатність', unit: 'т' },
  angleDeg: { label: 'Кут нахилу', unit: '°' },
  radiusCm: { label: 'Радіус дуги', unit: 'см' },
};

function formatBlueprintSpec(rawKey: string, rawVal: unknown): { label: string; value: string; unit: string } {
  const mapped = KEY_TRANSLATIONS[rawKey];
  if (mapped) {
    const unit = mapped.unit || '';
    const valStr = unit && typeof rawVal === 'number' ? `${rawVal} ${unit}` : String(rawVal);
    return { label: mapped.label, value: valStr, unit };
  }

  let unit = '';
  let cleanKey = rawKey;
  if (/Cm$/i.test(cleanKey)) {
    unit = 'см';
    cleanKey = cleanKey.replace(/Cm$/i, '');
  } else if (/Meters?$/i.test(cleanKey)) {
    unit = 'м';
    cleanKey = cleanKey.replace(/Meters?$/i, '');
  } else if (/Mm$/i.test(cleanKey)) {
    unit = 'мм';
    cleanKey = cleanKey.replace(/Mm$/i, '');
  } else if (/Tons?$/i.test(cleanKey)) {
    unit = 'т';
    cleanKey = cleanKey.replace(/Tons?$/i, '');
  }

  const spaced = cleanKey
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  const capitalized = spaced.charAt(0).toUpperCase() + spaced.slice(1);
  return {
    label: capitalized || 'Параметр',
    value: typeof rawVal === 'number' && unit ? `${rawVal} ${unit}` : String(rawVal),
    unit,
  };
}

function toFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export const BlueprintDiagramCard: React.FC<BlueprintDiagramCardProps> = ({
  blueprint,
  geometry,
  maskedKeys = [],
  unlockedKeys = [],
  claimedBanner,
}) => {
  const uid = useId().replace(/:/g, '');
  const gridPatternId = `bp-grid-${uid}`;
  const hatchPatternId = `bp-hatch-${uid}`;
  const arrowStartId = `bp-arrow-start-${uid}`;
  const arrowEndId = `bp-arrow-end-${uid}`;

  const unlockedSet = new Set(unlockedKeys);
  const isMasked = (key: string) => maskedKeys.includes(key) && !unlockedSet.has(key);
  const isUnlocked = (key: string) => unlockedSet.has(key);

  const geo: Record<string, any> = {
    ...(geometry || {}),
    ...(blueprint?.geometry || {}),
  };
  const dims = (blueprint as Blueprint | undefined)?.dimensions;
  const materialEntries = Object.entries(blueprint?.materials || {});
  const geoEntries = Object.entries(geo);

  if (!blueprint && geoEntries.length === 0) return null;

  const isGateBlueprint =
    blueprint?.category === 'gate' ||
    blueprint?.id?.includes('gate') ||
    geo.doorLeftWidthCm !== undefined ||
    geo.doorRightWidthCm !== undefined ||
    geo.archHeightCm !== undefined;

  const isBridgeBlueprint =
    blueprint?.category === 'bridge' ||
    blueprint?.id?.includes('bridge') ||
    geo.spanMeters !== undefined ||
    geo.pillars !== undefined;

  const boxColors = (fieldKey: string) => {
    if (isMasked(fieldKey)) {
      return {
        fill: 'var(--hl-bg)',
        stroke: 'var(--hl-border)',
        textFill: 'var(--hl-text)',
        subFill: 'var(--hl-text)',
      };
    }
    if (isUnlocked(fieldKey)) {
      return {
        fill: 'var(--ok-bg)',
        stroke: 'var(--ok-border)',
        textFill: 'var(--ok-text)',
        subFill: 'var(--ok-text)',
      };
    }
    return {
      fill: 'var(--surface)',
      stroke: 'var(--border-hover)',
      textFill: 'var(--text)',
      subFill: 'var(--text-muted)',
    };
  };

  const renderGateElevationSvg = () => {
    const beamW = toFiniteNumber(geo.beamThicknessCm) ?? 30;
    const leftDoorW = toFiniteNumber(geo.doorLeftWidthCm) ?? 160;
    const rightDoorW = toFiniteNumber(geo.doorRightWidthCm) ?? leftDoorW;
    const fallbackSpanCm =
      blueprint?.totalSpanMeters !== undefined ? Math.round(Number(blueprint.totalSpanMeters) * 100) : 480;
    const totalW =
      toFiniteNumber(geo.totalWidthCm) ??
      toFiniteNumber(geo.totalWidth) ??
      Math.max(fallbackSpanCm, leftDoorW + rightDoorW + beamW * 2);
    const archH = toFiniteNumber(geo.archHeightCm) ?? toFiniteNumber(geo.heightCm) ?? 540;

    const innerContentW = leftDoorW + rightDoorW + beamW * 2;
    const centerGapW = Math.max(0, totalW - innerContentW);

    const drawX0 = 64;
    const drawW = 436;
    const groundY = 264;
    const topArchY = 64;
    const gateH = groundY - topArchY;

    const scaleX = drawW / Math.max(totalW, 1);
    const pxBeam = Math.max(20, beamW * scaleX);
    const pxRemaining = drawW - pxBeam * 2;
    const doorAndGapRaw = leftDoorW + rightDoorW + centerGapW;
    const pxLeftDoor = doorAndGapRaw > 0 ? (leftDoorW / doorAndGapRaw) * pxRemaining : pxRemaining / 2;
    const pxRightDoor = doorAndGapRaw > 0 ? (rightDoorW / doorAndGapRaw) * pxRemaining : pxRemaining / 2;
    const pxGap = Math.max(0, pxRemaining - pxLeftDoor - pxRightDoor);

    const xLeftBeam = drawX0;
    const xLeftDoor = xLeftBeam + pxBeam;
    const xGap = xLeftDoor + pxLeftDoor;
    const xRightDoor = xGap + pxGap;
    const xRightBeam = xRightDoor + pxRightDoor;
    const xEnd = drawX0 + drawW;

    const doorTopY = topArchY + 46;
    const doorH = groundY - doorTopY;
    const lintelH = 22;

    const totalColors = boxColors('totalWidthCm');
    const archColors = boxColors('archHeightCm');

    const totalWidthDisplay = isMasked('totalWidthCm')
      ? 'Повна ширина: ? см'
      : isUnlocked('totalWidthCm')
      ? `Повна ширина: ${totalW} см ✓`
      : `Повна ширина: ${totalW} см`;

    const archHeightDisplay = isMasked('archHeightCm')
      ? '? см'
      : isUnlocked('archHeightCm')
      ? `${archH} см ✓`
      : `${archH} см`;

    const leftDoorText = isMasked('doorLeftWidthCm') ? '? см' : `${leftDoorW} см`;
    const rightDoorText = isMasked('doorRightWidthCm') ? '? см' : `${rightDoorW} см`;
    const beamText = isMasked('beamThicknessCm') ? '?' : `${beamW}`;
    const gapText = isMasked('centerGapCm') || isMasked('clearanceCm') ? '? см' : `${centerGapW} см`;

    return (
      <svg
        viewBox="0 0 640 340"
        className="w-full h-auto block select-none"
        role="img"
        aria-label={`Технічне креслення: ${blueprint?.title || 'Захисна брама'}`}
      >
        <defs>
          <pattern id={gridPatternId} width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="var(--border)"
              strokeWidth="0.7"
              strokeOpacity="0.6"
            />
          </pattern>
          <pattern
            id={hatchPatternId}
            width="8"
            height="8"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
              strokeOpacity="0.48"
            />
          </pattern>
          <marker
            id={arrowStartId}
            viewBox="0 0 10 10"
            refX="2"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 9 1.5 L 1 5 L 9 8.5 z" fill="var(--text)" />
          </marker>
          <marker
            id={arrowEndId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 1 1.5 L 9 5 L 1 8.5 z" fill="var(--text)" />
          </marker>
        </defs>

        {/* Drafting sheet background & grid */}
        <rect
          x="1"
          y="1"
          width="638"
          height="338"
          rx="8"
          fill="var(--surface)"
          stroke="var(--border)"
          strokeWidth="1.2"
        />
        <rect x="10" y="10" width="620" height="320" rx="4" fill={`url(#${gridPatternId})`} />

        {/* Top Overall Width Dimension Line */}
        <line
          x1={drawX0}
          y1={topArchY - 6}
          x2={drawX0}
          y2={22}
          stroke="var(--text-muted)"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
        <line
          x1={xEnd}
          y1={topArchY - 6}
          x2={xEnd}
          y2={22}
          stroke="var(--text-muted)"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
        <line
          x1={drawX0 + 2}
          y1={32}
          x2={xEnd - 2}
          y2={32}
          stroke="var(--text)"
          strokeWidth="1.8"
          markerStart={`url(#${arrowStartId})`}
          markerEnd={`url(#${arrowEndId})`}
        />
        <rect
          x={drawX0 + drawW / 2 - 102}
          y={19}
          width="204"
          height="23"
          rx="4"
          fill="var(--surface)"
        />
        <rect
          x={drawX0 + drawW / 2 - 102}
          y={19}
          width="204"
          height="23"
          rx="4"
          fill={totalColors.fill}
          stroke={totalColors.stroke}
          strokeWidth="1.4"
        />
        <text
          x={drawX0 + drawW / 2}
          y={34}
          textAnchor="middle"
          fontSize="11.5"
          fontWeight="800"
          fill={totalColors.textFill}
          fontFamily="var(--font-family-mono)"
        >
          {totalWidthDisplay}
        </text>

        {/* Ground Datum Line */}
        <line
          x1={drawX0 - 24}
          y1={groundY}
          x2={xEnd + 24}
          y2={groundY}
          stroke="var(--text)"
          strokeWidth="2.2"
        />
        <text
          x={drawX0 - 22}
          y={groundY - 6}
          fontSize="9.5"
          fontWeight="700"
          fill="var(--text-muted)"
          fontFamily="var(--font-family-mono)"
        >
          0.00
        </text>

        {/* Left & Right Structural Timber Pillars */}
        <rect
          x={xLeftBeam}
          y={topArchY + 26}
          width={pxBeam}
          height={gateH - 26}
          fill={`url(#${hatchPatternId})`}
          stroke="var(--text)"
          strokeWidth="2"
        />
        <rect
          x={xRightBeam}
          y={topArchY + 26}
          width={pxBeam}
          height={gateH - 26}
          fill={`url(#${hatchPatternId})`}
          stroke="var(--text)"
          strokeWidth="2"
        />

        {/* Upper Arch Crown & Horizontal Lintel Beam */}
        <path
          d={`M ${xLeftBeam} ${topArchY + 26} Q ${drawX0 + drawW / 2} ${topArchY - 12} ${xEnd} ${topArchY + 26} L ${xEnd} ${doorTopY} L ${xLeftBeam} ${doorTopY} Z`}
          fill="var(--surface-alt)"
          stroke="var(--text)"
          strokeWidth="2"
        />
        <rect
          x={xLeftBeam + pxBeam}
          y={doorTopY - lintelH}
          width={pxRemaining}
          height={lintelH}
          fill={`url(#${hatchPatternId})`}
          stroke="var(--text)"
          strokeWidth="1.6"
        />
        <path
          d={`M ${xLeftDoor} ${doorTopY - lintelH} Q ${drawX0 + drawW / 2} ${topArchY + 2} ${xRightBeam} ${doorTopY - lintelH}`}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />

        {/* Left Door Leaf */}
        <g>
          <rect
            x={xLeftDoor}
            y={doorTopY}
            width={pxLeftDoor}
            height={doorH}
            fill="var(--surface-alt)"
            stroke="var(--text)"
            strokeWidth="2"
          />
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={`lp-${ratio}`}
              x1={xLeftDoor + pxLeftDoor * ratio}
              y1={doorTopY}
              x2={xLeftDoor + pxLeftDoor * ratio}
              y2={groundY}
              stroke="var(--border-hover)"
              strokeWidth="1"
            />
          ))}
          <line
            x1={xLeftDoor + 4}
            y1={doorTopY + 18}
            x2={xLeftDoor + pxLeftDoor - 4}
            y2={groundY - 18}
            stroke="var(--text)"
            strokeWidth="1.8"
            strokeOpacity="0.45"
          />
          <rect
            x={xLeftDoor}
            y={doorTopY + 14}
            width={pxLeftDoor}
            height="8"
            fill="var(--surface)"
            stroke="var(--text)"
            strokeWidth="1.2"
          />
          <rect
            x={xLeftDoor}
            y={groundY - 22}
            width={pxLeftDoor}
            height="8"
            fill="var(--surface)"
            stroke="var(--text)"
            strokeWidth="1.2"
          />
          <rect
            x={xLeftDoor + pxLeftDoor / 2 - 42}
            y={doorTopY + doorH / 2 - 11}
            width="84"
            height="20"
            rx="4"
            fill="var(--surface)"
            stroke="var(--border)"
            strokeWidth="1"
          />
          <text
            x={xLeftDoor + pxLeftDoor / 2}
            y={doorTopY + doorH / 2 + 3}
            textAnchor="middle"
            fontSize="10.5"
            fontWeight="800"
            fill="var(--text)"
          >
            {pxLeftDoor >= 85 ? 'Ліва стулка' : 'Ліва'}
          </text>
        </g>

        {/* Central Arch Gap / Clearance Zone */}
        {pxGap > 4 && (
          <g>
            <rect
              x={xGap}
              y={doorTopY}
              width={pxGap}
              height={doorH}
              fill="var(--bg)"
              stroke="var(--border-hover)"
              strokeWidth="1.4"
              strokeDasharray="5 3"
            />
            <line
              x1={xGap + pxGap / 2}
              y1={doorTopY + 8}
              x2={xGap + pxGap / 2}
              y2={groundY - 8}
              stroke="var(--text-muted)"
              strokeWidth="1"
              strokeDasharray="6 3 2 3"
            />
            <text
              x={xGap + pxGap / 2}
              y={doorTopY + doorH / 2 - 4}
              textAnchor="middle"
              fontSize="10"
              fontWeight="800"
              fill="var(--text-muted)"
            >
              Просвіт
            </text>
            <text
              x={xGap + pxGap / 2}
              y={doorTopY + doorH / 2 + 11}
              textAnchor="middle"
              fontSize="11"
              fontWeight="800"
              fill="var(--text)"
              fontFamily="var(--font-family-mono)"
            >
              {gapText}
            </text>
          </g>
        )}

        {/* Right Door Leaf */}
        <g>
          <rect
            x={xRightDoor}
            y={doorTopY}
            width={pxRightDoor}
            height={doorH}
            fill="var(--surface-alt)"
            stroke="var(--text)"
            strokeWidth="2"
          />
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={`rp-${ratio}`}
              x1={xRightDoor + pxRightDoor * ratio}
              y1={doorTopY}
              x2={xRightDoor + pxRightDoor * ratio}
              y2={groundY}
              stroke="var(--border-hover)"
              strokeWidth="1"
            />
          ))}
          <line
            x1={xRightDoor + pxRightDoor - 4}
            y1={doorTopY + 18}
            x2={xRightDoor + 4}
            y2={groundY - 18}
            stroke="var(--text)"
            strokeWidth="1.8"
            strokeOpacity="0.45"
          />
          <rect
            x={xRightDoor}
            y={doorTopY + 14}
            width={pxRightDoor}
            height="8"
            fill="var(--surface)"
            stroke="var(--text)"
            strokeWidth="1.2"
          />
          <rect
            x={xRightDoor}
            y={groundY - 22}
            width={pxRightDoor}
            height="8"
            fill="var(--surface)"
            stroke="var(--text)"
            strokeWidth="1.2"
          />
          <rect
            x={xRightDoor + pxRightDoor / 2 - 45}
            y={doorTopY + doorH / 2 - 11}
            width="90"
            height="20"
            rx="4"
            fill="var(--surface)"
            stroke="var(--border)"
            strokeWidth="1"
          />
          <text
            x={xRightDoor + pxRightDoor / 2}
            y={doorTopY + doorH / 2 + 3}
            textAnchor="middle"
            fontSize="10.5"
            fontWeight="800"
            fill="var(--text)"
          >
            {pxRightDoor >= 85 ? 'Права стулка' : 'Права'}
          </text>
        </g>

        {/* Bottom Segmented Dimension Chain */}
        {[
          { x1: xLeftBeam, x2: xLeftDoor, label: beamText, sub: 'балка' },
          { x1: xLeftDoor, x2: xGap, label: leftDoorText, sub: '' },
          ...(pxGap > 4 ? [{ x1: xGap, x2: xRightDoor, label: gapText, sub: '' }] : []),
          { x1: xRightDoor, x2: xRightBeam, label: rightDoorText, sub: '' },
          { x1: xRightBeam, x2: xEnd, label: beamText, sub: 'балка' },
        ].map((seg, i) => {
          const mid = (seg.x1 + seg.x2) / 2;
          return (
            <g key={i}>
              <line
                x1={seg.x1}
                y1={groundY + 2}
                x2={seg.x1}
                y2={groundY + 34}
                stroke="var(--text-muted)"
                strokeWidth="1"
              />
              <line
                x1={seg.x2}
                y1={groundY + 2}
                x2={seg.x2}
                y2={groundY + 34}
                stroke="var(--text-muted)"
                strokeWidth="1"
              />
              <line
                x1={seg.x1 + 2}
                y1={groundY + 24}
                x2={seg.x2 - 2}
                y2={groundY + 24}
                stroke="var(--text)"
                strokeWidth="1.3"
                markerStart={`url(#${arrowStartId})`}
                markerEnd={`url(#${arrowEndId})`}
              />
              <text
                x={mid}
                y={groundY + 42}
                textAnchor="middle"
                fontSize="10.5"
                fontWeight="800"
                fill="var(--text)"
                fontFamily="var(--font-family-mono)"
              >
                {seg.label}
              </text>
              {seg.sub && (
                <text
                  x={mid}
                  y={groundY + 54}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="var(--text-muted)"
                >
                  {seg.sub}
                </text>
              )}
            </g>
          );
        })}

        {/* Right Vertical Dimension Line: Arch Height */}
        <line
          x1={drawX0 + drawW / 2}
          y1={topArchY + 6}
          x2={578}
          y2={topArchY + 6}
          stroke="var(--text-muted)"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
        <line
          x1={xEnd}
          y1={groundY}
          x2={578}
          y2={groundY}
          stroke="var(--text-muted)"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
        <line
          x1={566}
          y1={topArchY + 8}
          x2={566}
          y2={groundY - 2}
          stroke="var(--text)"
          strokeWidth="1.8"
          markerStart={`url(#${arrowStartId})`}
          markerEnd={`url(#${arrowEndId})`}
        />
        <rect
          x={518}
          y={(topArchY + groundY) / 2 - 20}
          width="102"
          height="40"
          rx="4"
          fill="var(--surface)"
        />
        <rect
          x={518}
          y={(topArchY + groundY) / 2 - 20}
          width="102"
          height="40"
          rx="4"
          fill={archColors.fill}
          stroke={archColors.stroke}
          strokeWidth="1.3"
        />
        <text
          x={569}
          y={(topArchY + groundY) / 2 - 4}
          textAnchor="middle"
          fontSize="9.5"
          fontWeight="700"
          fill={archColors.subFill}
        >
          Висота арки
        </text>
        <text
          x={569}
          y={(topArchY + groundY) / 2 + 12}
          textAnchor="middle"
          fontSize="11.5"
          fontWeight="800"
          fill={archColors.textFill}
          fontFamily="var(--font-family-mono)"
        >
          {archHeightDisplay}
        </text>
      </svg>
    );
  };

  const renderBridgeElevationSvg = () => {
    const spanM = toFiniteNumber(geo.spanMeters) ?? blueprint?.totalSpanMeters ?? 12;
    const heightM = toFiniteNumber(geo.heightMeters) ?? toFiniteNumber(geo.height) ?? 4.5;
    const pillars = toFiniteNumber(geo.pillars) ?? 2;

    const spanColors = boxColors('spanMeters');
    const heightColors = boxColors('heightMeters');

    return (
      <svg
        viewBox="0 0 640 240"
        className="w-full h-auto block select-none"
        role="img"
        aria-label={`Схема мосту: проліт ${spanM} м`}
      >
        <defs>
          <pattern id={gridPatternId} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border)" strokeWidth="0.7" strokeOpacity="0.6" />
          </pattern>
          <pattern id={hatchPatternId} width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke="var(--text-muted)" strokeWidth="1.5" strokeOpacity="0.48" />
          </pattern>
          <marker id={arrowStartId} viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 9 1.5 L 1 5 L 9 8.5 z" fill="var(--text)" />
          </marker>
          <marker id={arrowEndId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 1 1.5 L 9 5 L 1 8.5 z" fill="var(--text)" />
          </marker>
        </defs>

        <rect x="1" y="1" width="638" height="238" rx="8" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
        <rect x="10" y="10" width="620" height="220" rx="4" fill={`url(#${gridPatternId})`} />

        <line x1="70" y1="36" x2="510" y2="36" stroke="var(--text)" strokeWidth="1.8" markerStart={`url(#${arrowStartId})`} markerEnd={`url(#${arrowEndId})`} />
        <rect x="208" y="24" width="164" height="22" rx="4" fill="var(--surface)" />
        <rect x="208" y="24" width="164" height="22" rx="4" fill={spanColors.fill} stroke={spanColors.stroke} strokeWidth="1.2" />
        <text x="290" y="39" textAnchor="middle" fontSize="11.5" fontWeight="800" fill={spanColors.textFill} fontFamily="var(--font-family-mono)">
          {isMasked('spanMeters') ? 'Проліт: ? м' : `Проліт: ${spanM} м`}
        </text>

        <rect x="54" y="84" width="472" height="18" fill={`url(#${hatchPatternId})`} stroke="var(--text)" strokeWidth="2" />
        <path d="M 95 190 Q 290 98 485 190" fill="none" stroke="var(--text)" strokeWidth="3" />
        <rect x="75" y="102" width="32" height="90" fill={`url(#${hatchPatternId})`} stroke="var(--text)" strokeWidth="2" />
        <rect x="473" y="102" width="32" height="90" fill={`url(#${hatchPatternId})`} stroke="var(--text)" strokeWidth="2" />
        {pillars >= 3 && (
          <rect x="274" y="102" width="32" height="90" fill={`url(#${hatchPatternId})`} stroke="var(--text)" strokeWidth="2" />
        )}

        <line x1="36" y1="192" x2="544" y2="192" stroke="var(--text)" strokeWidth="2" />

        <line x1="560" y1="84" x2="560" y2="192" stroke="var(--text)" strokeWidth="1.8" markerStart={`url(#${arrowStartId})`} markerEnd={`url(#${arrowEndId})`} />
        <rect x="524" y="122" width="88" height="36" rx="4" fill="var(--surface)" />
        <rect x="524" y="122" width="88" height="36" rx="4" fill={heightColors.fill} stroke={heightColors.stroke} strokeWidth="1.2" />
        <text x="568" y="136" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={heightColors.subFill}>Висота</text>
        <text x="568" y="150" textAnchor="middle" fontSize="11.5" fontWeight="800" fill={heightColors.textFill} fontFamily="var(--font-family-mono)">
          {isMasked('heightMeters') ? '? м' : `${heightM} м`}
        </text>
      </svg>
    );
  };

  const renderGenericSchematicSvg = () => {
    const w =
      toFiniteNumber(dims?.width) ??
      toFiniteNumber(dims?.length) ??
      toFiniteNumber(geo.width) ??
      toFiniteNumber(geo.totalWidthCm) ??
      (blueprint?.totalSpanMeters ? Math.round(blueprint.totalSpanMeters * 100) : 100);
    const h =
      toFiniteNumber(dims?.height) ??
      toFiniteNumber(geo.height) ??
      toFiniteNumber(geo.archHeightCm) ??
      60;
    const unitLabel = geo.totalWidthCm || geo.archHeightCm ? 'см' : blueprint?.totalSpanMeters ? 'м' : 'од.';
    const wKey = geo.totalWidthCm !== undefined ? 'totalWidthCm' : 'width';
    const hKey = geo.archHeightCm !== undefined ? 'archHeightCm' : 'height';
    const wColors = boxColors(wKey);
    const hColors = boxColors(hKey);

    return (
      <svg
        viewBox="0 0 640 230"
        className="w-full h-auto block select-none"
        role="img"
        aria-label={`Схема конструкції: ${blueprint?.title || 'Об’єкт'}`}
      >
        <defs>
          <pattern id={gridPatternId} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border)" strokeWidth="0.7" strokeOpacity="0.6" />
          </pattern>
          <pattern id={hatchPatternId} width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke="var(--text-muted)" strokeWidth="1.5" strokeOpacity="0.4" />
          </pattern>
          <marker id={arrowStartId} viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 9 1.5 L 1 5 L 9 8.5 z" fill="var(--text)" />
          </marker>
          <marker id={arrowEndId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 1 1.5 L 9 5 L 1 8.5 z" fill="var(--text)" />
          </marker>
        </defs>

        <rect x="1" y="1" width="638" height="228" rx="8" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
        <rect x="10" y="10" width="620" height="208" rx="4" fill={`url(#${gridPatternId})`} />

        <line x1="90" y1="36" x2="490" y2="36" stroke="var(--text)" strokeWidth="1.8" markerStart={`url(#${arrowStartId})`} markerEnd={`url(#${arrowEndId})`} />
        <rect x="215" y="24" width="150" height="22" rx="4" fill="var(--surface)" />
        <rect x="215" y="24" width="150" height="22" rx="4" fill={wColors.fill} stroke={wColors.stroke} strokeWidth="1.2" />
        <text x="290" y="39" textAnchor="middle" fontSize="11.5" fontWeight="800" fill={wColors.textFill} fontFamily="var(--font-family-mono)">
          {isMasked(wKey) ? `Ширина: ? ${unitLabel}` : `Ширина: ${w} ${unitLabel}`}
        </text>

        <rect x="90" y="64" width="400" height="128" fill="var(--surface-alt)" stroke="var(--text)" strokeWidth="2" />
        <rect x="106" y="80" width="368" height="96" fill={`url(#${hatchPatternId})`} stroke="var(--border-hover)" strokeWidth="1.2" strokeDasharray="5 3" />
        <line x1="290" y1="54" x2="290" y2="202" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="6 3 2 3" />
        <rect x="170" y="114" width="240" height="28" rx="4" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
        <text x="290" y="132" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--text)">
          {blueprint?.title || 'Схема об’єкта'}
        </text>

        <line x1="540" y1="64" x2="540" y2="192" stroke="var(--text)" strokeWidth="1.8" markerStart={`url(#${arrowStartId})`} markerEnd={`url(#${arrowEndId})`} />
        <rect x="498" y="110" width="98" height="36" rx="4" fill="var(--surface)" />
        <rect x="498" y="110" width="98" height="36" rx="4" fill={hColors.fill} stroke={hColors.stroke} strokeWidth="1.2" />
        <text x="547" y="124" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={hColors.subFill}>Висота</text>
        <text x="547" y="139" textAnchor="middle" fontSize="11.5" fontWeight="800" fill={hColors.textFill} fontFamily="var(--font-family-mono)">
          {isMasked(hKey) ? `? ${unitLabel}` : `${h} ${unitLabel}`}
        </text>
      </svg>
    );
  };

  return (
    <div className="p-3.5 sm:p-4 bg-[var(--surface-alt)] border border-[var(--border-hover)] rounded-[var(--radius-md)] space-y-3 text-xs text-[var(--text)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
        <span className="font-extrabold text-xs sm:text-sm text-[var(--text)]">
          📐 {blueprint?.title || 'Технічне креслення об’єкта'}
        </span>
        {blueprint?.totalSpanMeters !== undefined && !isMasked('totalSpanMeters') && !isMasked('totalWidthCm') && (
          <span className="text-[11px] font-mono font-bold text-[var(--text-muted)] tabular-nums">
            Загальний проліт: {blueprint.totalSpanMeters} м
          </span>
        )}
      </div>

      {claimedBanner && (
        <div className="p-2.5 bg-[var(--hl-bg)] border border-[var(--hl-border)] rounded-[var(--radius-sm)] text-[var(--hl-text)] flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <span>📋 {claimedBanner.label || 'Запис у документі на перевірку'}:</span>
          <span className="font-mono font-extrabold">{String(claimedBanner.value)}</span>
        </div>
      )}

      {blueprint?.description && (
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">{blueprint.description}</p>
      )}

      {/* Holistic Technical SVG Blueprint with Dimension Lines */}
      <div className="rounded-[var(--radius-sm)] overflow-hidden bg-[var(--surface)] shadow-xs">
        {isGateBlueprint
          ? renderGateElevationSvg()
          : isBridgeBlueprint
          ? renderBridgeElevationSvg()
          : renderGenericSchematicSvg()}
      </div>

      {/* Translated Ukrainian Engineering Parameters */}
      {geoEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 font-mono text-[11px] tabular-nums">
          {geoEntries.map(([key, val]) => {
            const spec = formatBlueprintSpec(key, val);
            const masked = isMasked(key);
            const unlocked = isUnlocked(key);

            const cardClass = masked
              ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
              : unlocked
              ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
              : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)]';

            return (
              <div
                key={key}
                className={`px-2.5 py-1.5 rounded-[var(--radius-sm)] border flex items-center justify-between gap-2 ${cardClass}`}
              >
                <span className={`font-sans font-semibold ${masked || unlocked ? 'opacity-95' : 'text-[var(--text-muted)]'}`}>
                  {spec.label}
                </span>
                <strong className="font-extrabold">
                  {masked
                    ? `? ${spec.unit || '(обчислити)'}`
                    : unlocked
                    ? `${spec.value} ✓`
                    : spec.value}
                </strong>
              </div>
            );
          })}
        </div>
      )}

      {/* Translated Materials Summary */}
      {materialEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] tabular-nums">
          <span className="font-bold text-[var(--text)]">Матеріали:</span>
          {materialEntries.map(([key, val], idx) => {
            const spec = formatBlueprintSpec(key, val);
            const masked = isMasked(key);
            return (
              <span key={key}>
                {idx > 0 && <span className="mr-3 opacity-60">·</span>}
                {spec.label}:{' '}
                <strong className="font-mono text-[var(--text)]">
                  {masked ? `? ${spec.unit}` : spec.value}
                </strong>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};
