import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ContentLoaderService } from '../../services/contentLoaderService';
import { useSessionStore } from '../../core/state/useSessionStore';
import { WorldMapNode } from '../../curriculum/types';

interface WorldMapViewProps {
  selectedGradeId?: string;
  selectedSubjectId?: string;
  currentChapterIndex: number;
  startedQuestIds: string[];
  completedQuestIds: string[];
  onBackToBookshelf: () => void;
  onSelectChapter: (index: number) => void;
  onOpenYamlImporter: () => void;
}

const buildBezierPath = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  isBranch: boolean,
  isVerticalFlow: boolean
): string => {
  if (isVerticalFlow) {
    const midY = from.y + (to.y - from.y) * 0.5;
    return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (isBranch) {
    const c1x = from.x;
    const c1y = from.y + dy * 0.55;
    const c2x = to.x - dx * 0.25;
    const c2y = to.y;
    return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
  }
  const midX = from.x + dx * 0.5;
  return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
};

export const WorldMapView: React.FC<WorldMapViewProps> = ({
  selectedGradeId,
  selectedSubjectId,
  currentChapterIndex,
  startedQuestIds,
  completedQuestIds,
  onSelectChapter,
  onOpenYamlImporter,
}) => {
  const { selectedSubjectId: storeSubjectId, isMapExpanded, setMapExpanded } = useSessionStore();
  const activeSubjectId = selectedSubjectId || storeSubjectId;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.max(280, Math.min(960, window.innerWidth - 48)) : 800
  );
  const [viewportHeight, setViewportHeight] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerHeight : 720
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateDims = () => {
      const w = el.clientWidth;
      if (w > 0) setViewportWidth(w);
      if (typeof window !== 'undefined') setViewportHeight(window.innerHeight);
    };

    updateDims();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => updateDims());
      ro.observe(el);
      return () => ro.disconnect();
    }

    window.addEventListener('resize', updateDims);
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  const subject = ContentLoaderService.getSubjectById(activeSubjectId, selectedGradeId);
  const chapters = ContentLoaderService.getChaptersForSubject(activeSubjectId, selectedGradeId);
  const mapData = ContentLoaderService.getWorldMapSchemaForSubject(activeSubjectId, selectedGradeId);

  const isMobileLayout = viewportWidth < 620;

  const layout = useMemo(() => {
    const rawNodes = mapData.nodes;
    if (rawNodes.length === 0) {
      return {
        nodes: [] as Array<{ raw: WorldMapNode; x: number; y: number }>,
        canvasWidth: viewportWidth,
        canvasHeight: 280,
      };
    }

    // 1. Mobile layout (< 620px): alternating vertical serpentine that fits 100% inside visible screen
    if (isMobileLayout) {
      const n = rawNodes.length;
      const safePadX = viewportWidth < 360 ? 78 : 96;
      const leftX = Math.max(safePadX, Math.round(viewportWidth * 0.28));
      const rightX = Math.min(viewportWidth - safePadX, Math.round(viewportWidth * 0.72));
      const centerX = Math.round(viewportWidth / 2);

      // Fit compactly within visible mobile screen height when not manually expanded
      const targetVisibleH = Math.max(250, Math.min(410, Math.round(viewportHeight * 0.48)));
      const topPad = 48;
      const bottomPad = 56;
      const stepY = isMapExpanded
        ? 104
        : n <= 1
        ? 0
        : Math.max(72, Math.min(108, Math.floor((targetVisibleH - topPad - bottomPad) / (n - 1))));

      const nodes = rawNodes.map((raw, idx) => {
        const x = n <= 2 ? (idx % 2 === 0 ? leftX : rightX) : idx === 0 ? centerX : idx % 2 === 1 ? leftX : rightX;
        const y = topPad + idx * stepY;
        return { raw, x, y };
      });

      const canvasHeight = Math.max(240, topPad + Math.max(0, n - 1) * stepY + bottomPad);
      return {
        nodes,
        canvasWidth: viewportWidth,
        canvasHeight,
      };
    }

    // 2. Tablet / Desktop: fit all horizontal nodes proportionally inside container width without horizontal cutoff
    const rawXs = rawNodes.map((n) => Number(n.x) || 0);
    const rawYs = rawNodes.map((n) => Number(n.y) || 0);
    const minX = Math.min(...rawXs);
    const maxX = Math.max(...rawXs);
    const minY = Math.min(...rawYs);
    const maxY = Math.max(...rawYs);

    const padX = Math.min(125, Math.max(92, Math.round(viewportWidth * 0.14)));
    const topPad = 62;
    const bottomPad = 76;
    const desiredHeight = isMapExpanded ? 460 : 320;

    const spanX = Math.max(1, maxX - minX);
    const targetSpanX = Math.max(220, viewportWidth - padX * 2);
    const needsHorizontalFit = maxX + 120 > viewportWidth || minX < 90;

    const rawSpanY = Math.max(1, maxY - minY);
    const maxUsableY = Math.max(140, desiredHeight - topPad - bottomPad);

    const nodes = rawNodes.map((raw) => {
      const rx = Number(raw.x) || 0;
      const ry = Number(raw.y) || 0;

      let x: number;
      if (rawNodes.length === 1) {
        x = Math.round(viewportWidth / 2);
      } else if (needsHorizontalFit) {
        x = Math.round(padX + ((rx - minX) / spanX) * targetSpanX);
      } else {
        const offsetCenter = (viewportWidth - (maxX + minX)) / 2;
        x = Math.round(Math.max(padX, Math.min(viewportWidth - padX, rx + offsetCenter)));
      }

      const y =
        rawNodes.length === 1
          ? Math.round(desiredHeight / 2)
          : rawSpanY > maxUsableY
          ? Math.round(topPad + ((ry - minY) / rawSpanY) * maxUsableY)
          : Math.round(topPad + (ry - minY) + Math.max(0, (maxUsableY - rawSpanY) / 2));

      return { raw, x, y };
    });

    const maxNodeY = Math.max(...nodes.map((n) => n.y), 180);
    const canvasHeight = Math.max(desiredHeight, maxNodeY + bottomPad);

    return {
      nodes,
      canvasWidth: viewportWidth,
      canvasHeight,
    };
  }, [mapData.nodes, viewportWidth, viewportHeight, isMobileLayout, isMapExpanded]);

  if (chapters.length === 0 || mapData.nodes.length === 0) {
    return (
      <Card title={`🗺️ Мапа курсу: ${subject?.name || 'Навчальний предмет'}`}>
        <div className="p-8 text-center bg-[var(--bg)] border-2 border-dashed border-[var(--border)] rounded-[var(--radius-md)] space-y-3 my-2">
          <span className="text-4xl block">📜</span>
          <h3 className="font-extrabold text-base text-[var(--primary-dark)]">
            У предметі «{subject?.name || activeSubjectId}» ще немає уроків
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
            Учителі та батьки можуть додати уроки в захищеній Студії автора:
          </p>
          <Button variant="accent" onClick={onOpenYamlImporter} className="font-bold text-xs">
            🔐 Відкрити у Студії автора
          </Button>
        </div>
      </Card>
    );
  }

  const posById = new Map<string, { raw: WorldMapNode; x: number; y: number }>(
    layout.nodes.map((item) => [item.raw.id, item])
  );

  const clampedCurrentIdx = Math.min(currentChapterIndex, Math.max(0, layout.nodes.length - 1));
  const currentPos = layout.nodes[clampedCurrentIdx];

  return (
    <div className="space-y-4">
      <Card title={`🗺️ ${mapData.mapTitle || 'Сюжетна мапа предмета'}`}>
        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
          <p className="text-xs text-[var(--text-muted)] leading-relaxed font-medium hidden sm:block">
            Натисніть на будь-яку тему мапи, щоб відкрити її. Суцільна лінія позначає пройдений чи відкритий маршрут, пунктир — наступні етапи.
          </p>
          <p className="text-[11px] text-[var(--text-muted)] font-medium sm:hidden">
            Натисніть на тему на маршруті, щоб відкрити урок:
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMapExpanded(!isMapExpanded)}
            className="text-xs font-bold shrink-0"
          >
            {isMapExpanded ? '🔍 Компактно' : '🔍 Детальніше'}
          </Button>
        </div>

        <div
          ref={containerRef}
          className="w-full overflow-x-hidden overflow-y-auto border-2 border-[var(--border)] rounded-[var(--radius-md)] my-1"
          style={{
            background: 'var(--color-map-bg)',
            maxHeight: isMapExpanded ? undefined : '62dvh',
          }}
        >
          <div
            className="relative w-full"
            style={{ height: `${layout.canvasHeight}px` }}
          >
            <svg
              width={layout.canvasWidth}
              height={layout.canvasHeight}
              viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
              className="absolute inset-0 w-full h-full pointer-events-none z-0"
            >
              <defs>
                <pattern
                  id="mapHatchGrid"
                  width="18"
                  height="18"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line x1="0" y1="0" x2="0" y2="18" stroke="var(--border)" strokeWidth="1" strokeOpacity="0.45" />
                </pattern>
              </defs>
              <rect width={layout.canvasWidth} height={layout.canvasHeight} fill="url(#mapHatchGrid)" />

              {layout.nodes.map((item, idx) => {
                const node = item.raw;
                if (idx === 0 && !node.parentId) return null;
                const parentItem =
                  (node.parentId ? posById.get(node.parentId) : undefined) || layout.nodes[idx - 1];
                if (!parentItem || parentItem.raw.id === node.id) return null;

                const chapterRef = chapters[idx]?.id || node.questId || node.id;
                const isActivePath =
                  completedQuestIds.includes(chapterRef) || startedQuestIds.includes(chapterRef);
                const isBranch = node.lane === 'upper' || node.lane === 'lower';
                const pathD = buildBezierPath(parentItem, item, isBranch, isMobileLayout);

                return (
                  <path
                    key={`path_${node.id}_${idx}`}
                    d={pathD}
                    fill="none"
                    stroke={isActivePath ? 'var(--ok-border)' : 'var(--text-muted)'}
                    strokeWidth={isActivePath ? (isBranch ? 2.5 : 3.5) : isBranch ? 2 : 2.5}
                    strokeDasharray={isActivePath ? undefined : '7 6'}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>

            {layout.nodes.map((item, idx) => {
              const node = item.raw;
              const targetQuestId = node.questId || node.regionId || node.id;
              let resolvedIdx = -1;
              if (targetQuestId) {
                resolvedIdx = chapters.findIndex(
                  (c) =>
                    c.id === targetQuestId ||
                    c.lesson?.id === targetQuestId ||
                    c.id.includes(targetQuestId) ||
                    targetQuestId.includes(c.id)
                );
              }
              if (resolvedIdx === -1) {
                resolvedIdx = Math.min(idx, Math.max(0, chapters.length - 1));
              }

              const chapterId = chapters[resolvedIdx]?.id || targetQuestId;
              const isCompleted =
                completedQuestIds.includes(chapterId) ||
                Boolean(node.isCompleted && completedQuestIds.length > 0);
              const isStarted = startedQuestIds.includes(chapterId);
              const isMajorRegion = node.type === 'region_main' || node.type === 'region';
              const isBranch = node.lane === 'upper' || node.lane === 'lower';

              return (
                <div
                  key={node.id || idx}
                  style={{ left: `${item.x}px`, top: `${item.y}px` }}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center cursor-pointer transition-transform hover:scale-105"
                  onClick={() => onSelectChapter(resolvedIdx)}
                >
                  <div
                    className="flex items-center justify-center rounded-full font-bold shadow-sm border-2"
                    style={{
                      width: isCompleted ? '38px' : isMajorRegion || isStarted ? '42px' : isBranch ? '34px' : '38px',
                      height: isCompleted ? '38px' : isMajorRegion || isStarted ? '42px' : isBranch ? '34px' : '38px',
                      fontSize: isCompleted ? '0.85rem' : isMajorRegion || isStarted ? '1rem' : '0.8rem',
                      backgroundColor: isCompleted ? 'var(--ok-bg)' : 'var(--accent)',
                      color: isCompleted ? 'var(--ok-text)' : 'var(--accent-text)',
                      borderColor: isCompleted ? 'var(--ok-border)' : 'var(--surface)',
                    }}
                  >
                    {isCompleted ? '✓' : isMajorRegion ? '📘' : isBranch ? '🌿' : '📍'}
                  </div>

                  <span
                    className={`mt-1 text-center ${
                      isMobileLayout ? 'max-w-[144px] line-clamp-2' : 'max-w-[180px] truncate'
                    } ${isMajorRegion || isStarted ? 'map-node-label-major' : 'map-node-label'}`}
                    style={
                      isCompleted
                        ? {
                            borderColor: 'var(--ok-border)',
                            color: 'var(--ok-text)',
                            backgroundColor: 'var(--ok-bg)',
                          }
                        : undefined
                    }
                    title={node.title}
                  >
                    {node.title}
                  </span>
                </div>
              );
            })}

            {currentPos && (
              <div
                style={{
                  left: `${currentPos.x}px`,
                  top: `${Math.max(18, currentPos.y - 28)}px`,
                }}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 text-lg sm:text-xl animate-bounce z-20 pointer-events-none"
                title="Поточна позиція"
              >
                🧭
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
