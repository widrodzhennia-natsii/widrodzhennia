import React, { useMemo, useState } from 'react';
import { parseIndentedDiagram } from './indentedDiagramParser';

interface IndentedDiagramSvgProps {
  sourceText: string;
  title?: string;
}

export const IndentedDiagramSvg: React.FC<IndentedDiagramSvgProps> = ({
  sourceText,
  title,
}) => {
  const graph = useMemo(() => parseIndentedDiagram(sourceText), [sourceText]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (graph.nodes.length === 0) {
    return (
      <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs text-[var(--text-muted)] text-center">
        Введіть рядки з відступами або стрілками <code>-&gt;</code>, щоб побудувати SVG-діаграму.
      </div>
    );
  }

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const selectedNode = graph.nodes.find((n) => n.id === selectedId) || graph.nodes.find((n) => n.note);

  const boxW = 134;
  const boxH = 44;

  return (
    <div className="w-full space-y-2">
      {title && (
        <div className="text-xs font-extrabold text-[var(--primary-dark)] text-center">{title}</div>
      )}

      <div className="w-full overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] p-2">
        <svg
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          className="w-full max-w-full h-auto block mx-auto"
          style={{ minWidth: `${Math.min(graph.width, 320)}px` }}
          role="img"
          aria-label={title || 'Структурна схема'}
        >
          <defs>
            <marker
              id="diagArrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--primary-dark)" />
            </marker>
          </defs>

          {graph.edges.map((edge) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return null;

            const startX = from.x + boxW / 2;
            const startY = from.y;
            const endX = to.x - boxW / 2 - 4;
            const endY = to.y;
            const midX = (startX + endX) / 2;

            const d =
              endX > startX
                ? `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`
                : `M ${from.x} ${from.y + boxH / 2} L ${to.x} ${to.y - boxH / 2 - 4}`;

            return (
              <path
                key={edge.id}
                d={d}
                fill="none"
                stroke="var(--primary-dark)"
                strokeWidth="2"
                markerEnd="url(#diagArrow)"
              />
            );
          })}

          {graph.nodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const isRoot = node.depth === 0;
            const displayLabel =
              node.label.length > 17 ? `${node.label.slice(0, 16)}…` : node.label;

            return (
              <g
                key={node.id}
                onClick={() => setSelectedId(node.id)}
                className="cursor-pointer"
              >
                <rect
                  x={node.x - boxW / 2}
                  y={node.y - boxH / 2}
                  width={boxW}
                  height={boxH}
                  rx="8"
                  fill={isSelected ? 'var(--hl-bg)' : isRoot ? 'var(--accent)' : 'var(--surface)'}
                  stroke={isSelected ? 'var(--accent)' : 'var(--border)'}
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                />
                <text
                  x={node.x}
                  y={node.note ? node.y - 3 : node.y + 4}
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="800"
                  fill={
                    isSelected
                      ? 'var(--hl-text)'
                      : isRoot
                      ? 'var(--accent-text)'
                      : 'var(--text)'
                  }
                >
                  {displayLabel}
                </text>
                {node.note && (
                  <text
                    x={node.x}
                    y={node.y + 12}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="600"
                    fill={
                      isSelected
                        ? 'var(--hl-text)'
                        : isRoot
                        ? 'var(--accent-text)'
                        : 'var(--text-muted)'
                    }
                  >
                    {node.note.length > 19 ? `${node.note.slice(0, 18)}…` : node.note}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {selectedNode && (
        <div className="p-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-xs">
          <span className="font-extrabold text-[var(--primary-dark)]">{selectedNode.label}</span>
          {selectedNode.note && (
            <span className="text-[var(--text-muted)]"> — {selectedNode.note}</span>
          )}
        </div>
      )}
    </div>
  );
};
