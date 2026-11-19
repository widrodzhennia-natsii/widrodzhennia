// Повна реалізація: Ліниво завантажуваний вузловий граф переходів квесту (@xyflow/react)
// Завантажується динамічно лише при відкритті вкладки графа в Студії автора.
// Детальний план: fix_tech_patch/future_plans/STAGE_5_AUTHOR_STUDIO_AND_TEAM_COOP.md

import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '../../components/ui/Button';

export interface QuestGraphViewportState {
  zoom: number;
}

interface QuestGraphLazyProps {
  blocks: any[];
  selectedIndex: number;
  onSelectBlock: (index: number) => void;
  onUpdateBlocks: (nextBlocks: any[]) => void;
}

const getBlockTypeLabel = (type: string): string => {
  switch (type) {
    case 'block_dialogue':
      return '💬 Діалог';
    case 'block_theory_rule':
      return '📖 Теорія';
    case 'block_anchor_fact':
      return '📜 Факт';
    case 'block_text_marking':
      return '✍️ Розбір';
    case 'block_recognition_quiz':
      return '🎯 Тест';
    case 'block_notebook_task':
      return '📝 Чернетка';
    case 'block_interactive_sandbox':
      return '⚙️ Симулятор';
    case 'block_somatic_pause':
      return '🌿 Пауза';
    case 'block_boss_challenge':
      return '🏆 Бос';
    default:
      return type.replace('block_', '');
  }
};

const buildNodesFromBlocks = (blocks: any[], selectedIndex: number): Node[] =>
  blocks.map((blk, idx) => {
    const id = String(blk.id || `step_${idx}`);
    const savedPos = blk.graphPosition;
    const defaultX = (idx % 3) * 230 + 40;
    const defaultY = Math.floor(idx / 3) * 125 + 40;
    const titleSnippet =
      blk.title || blk.headline || blk.speaker || blk.question || blk.engineId || `Крок ${idx + 1}`;
    const shortTitle =
      String(titleSnippet).length > 26
        ? `${String(titleSnippet).slice(0, 25)}…`
        : String(titleSnippet);

    const isSelected = idx === selectedIndex;

    return {
      id,
      position:
        savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number'
          ? savedPos
          : { x: defaultX, y: defaultY },
      data: {
        label: `${idx + 1}. ${getBlockTypeLabel(String(blk.type || ''))} — ${shortTitle}`,
      },
      style: {
        background: isSelected ? 'var(--hl-bg)' : 'var(--surface)',
        color: isSelected ? 'var(--hl-text)' : 'var(--text)',
        border: isSelected ? '2px solid var(--accent)' : '1.5px solid var(--border)',
        borderRadius: '10px',
        padding: '8px 12px',
        fontSize: '11.5px',
        fontWeight: 700,
        width: 205,
        boxShadow: 'var(--shadow-sm)',
      },
    };
  });

const buildEdgesFromBlocks = (blocks: any[]): Edge[] => {
  const edges: Edge[] = [];
  const validIds = new Set(blocks.map((b, i) => String(b.id || `step_${i}`)));

  blocks.forEach((blk, idx) => {
    const sourceId = String(blk.id || `step_${idx}`);
    const explicitNext = blk.nextBlockId ? String(blk.nextBlockId) : null;
    if (explicitNext && validIds.has(explicitNext)) {
      edges.push({
        id: `e_${sourceId}_${explicitNext}`,
        source: sourceId,
        target: explicitNext,
        animated: true,
        style: { stroke: 'var(--accent)', strokeWidth: 2 },
      });
    } else if (idx < blocks.length - 1) {
      const nextId = String(blocks[idx + 1].id || `step_${idx + 1}`);
      edges.push({
        id: `e_${sourceId}_${nextId}`,
        source: sourceId,
        target: nextId,
        style: { stroke: 'var(--primary-dark)', strokeWidth: 1.75 },
      });
    }
  });
  return edges;
};

export const QuestGraphLazy: React.FC<QuestGraphLazyProps> = ({
  blocks,
  selectedIndex,
  onSelectBlock,
  onUpdateBlocks,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    buildNodesFromBlocks(blocks, selectedIndex)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(buildEdgesFromBlocks(blocks));

  useEffect(() => {
    setNodes(buildNodesFromBlocks(blocks, selectedIndex));
    setEdges(buildEdgesFromBlocks(blocks));
  }, [blocks, selectedIndex, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: 'var(--accent)', strokeWidth: 2 },
          },
          eds
        )
      );
      const updated = blocks.map((blk, i) => {
        const id = String(blk.id || `step_${i}`);
        if (id === connection.source) {
          return { ...blk, nextBlockId: connection.target };
        }
        return blk;
      });
      onUpdateBlocks(updated);
    },
    [blocks, onUpdateBlocks, setEdges]
  );

  const handleNodeDragStop: OnNodeDrag<Node> = useCallback(
    (_event, node) => {
      const updated = blocks.map((blk, i) => {
        const id = String(blk.id || `step_${i}`);
        if (id === node.id) {
          return {
            ...blk,
            graphPosition: {
              x: Math.round(node.position.x),
              y: Math.round(node.position.y),
            },
          };
        }
        return blk;
      });
      onUpdateBlocks(updated);
    },
    [blocks, onUpdateBlocks]
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const idx = blocks.findIndex((blk, i) => String(blk.id || `step_${i}`) === node.id);
      if (idx >= 0) {
        onSelectBlock(idx);
      }
    },
    [blocks, onSelectBlock]
  );

  const handleAutoArrange = () => {
    const cleaned = blocks.map((blk, idx) => ({
      ...blk,
      graphPosition: {
        x: (idx % 3) * 230 + 40,
        y: Math.floor(idx / 3) * 125 + 40,
      },
    }));
    onUpdateBlocks(cleaned);
  };

  return (
    <div className="space-y-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)]">
        <span className="font-bold text-[var(--text-muted)]">
          Перетягуйте вузли або з’єднуйте переходи між етапами уроку (клік обирає блок для редагування):
        </span>
        <Button type="button" size="sm" variant="outline" onClick={handleAutoArrange}>
          ⟲ Вирівняти сітку
        </Button>
      </div>

      <div
        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden"
        style={{ height: '380px', backgroundColor: 'var(--bg)' }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={handleNodeClick}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap zoomable pannable />
        </ReactFlow>
      </div>
    </div>
  );
};

export default QuestGraphLazy;
