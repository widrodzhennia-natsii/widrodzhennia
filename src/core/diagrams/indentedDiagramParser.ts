// Повна реалізація текстового парсера діаграм із відступами та дужками (`->`)
// Детальний план: fix_tech_patch/future_plans/STAGE_5_AUTHOR_STUDIO_AND_TEAM_COOP.md

export interface ParsedDiagramNode {
  id: string;
  label: string;
  note?: string;
  depth: number;
  parentId?: string;
  x: number;
  y: number;
}

export interface ParsedDiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface ParsedDiagramGraph {
  nodes: ParsedDiagramNode[];
  edges: ParsedDiagramEdge[];
  width: number;
  height: number;
}

const extractLabelAndNote = (raw: string): { label: string; note?: string } => {
  const trimmed = raw.trim().replace(/^[-*•]\s*/, '');
  // Match trailing (...) or [...] annotation
  const parenMatch = trimmed.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (parenMatch && parenMatch[1].trim().length > 0) {
    return { label: parenMatch[1].trim(), note: parenMatch[2].trim() };
  }
  const bracketMatch = trimmed.match(/^(.*?)\s*\[([^\[\]]+)\]\s*$/);
  if (bracketMatch && bracketMatch[1].trim().length > 0) {
    return { label: bracketMatch[1].trim(), note: bracketMatch[2].trim() };
  }
  return { label: trimmed };
};

/**
 * Parses lightweight text syntax (indentation + `->` / `=>` chains + `(note)` / `[note]` annotations)
 * into positioned graph nodes & edges for responsive SVG diagrams.
 */
export function parseIndentedDiagram(sourceText: string): ParsedDiagramGraph {
  const normalized = (sourceText || '')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');

  // Support single-line `;` or `|` separators when pasted inside inline widget strings
  const rawLines = normalized.includes('\n')
    ? normalized.split('\n')
    : normalized.split('|');

  const lines = rawLines.filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { nodes: [], edges: [], width: 420, height: 140 };
  }

  const rawNodes: Array<{
    id: string;
    label: string;
    note?: string;
    depth: number;
    parentId?: string;
  }> = [];
  const edges: ParsedDiagramEdge[] = [];
  const nodeByKey = new Map<string, string>();

  // Stack of { depth, id } for indented parent resolution
  const indentStack: Array<{ indent: number; id: string; depth: number }> = [];
  let seq = 1;

  const ensureChainNode = (
    rawPart: string,
    depth: number,
    explicitParentId?: string
  ): string => {
    const { label, note } = extractLabelAndNote(rawPart);
    const lookupKey = label.toLowerCase();
    const existingId = nodeByKey.get(lookupKey);
    if (existingId && !explicitParentId) {
      return existingId;
    }
    const id = existingId && explicitParentId ? existingId : `dnode_${seq++}`;
    if (!existingId) {
      nodeByKey.set(lookupKey, id);
      rawNodes.push({ id, label, note, depth, parentId: explicitParentId });
    }
    return id;
  };

  for (const rawLine of lines) {
    const indentMatch = rawLine.match(/^(\s*)/);
    const rawIndent = indentMatch ? indentMatch[1].replace(/\t/g, '  ').length : 0;
    const cleanLine = rawLine.trim();
    if (!cleanLine) continue;

    // Pop stack until strictly smaller indentation
    while (indentStack.length > 0 && indentStack[indentStack.length - 1].indent >= rawIndent) {
      indentStack.pop();
    }
    const parentEntry = indentStack[indentStack.length - 1];
    const baseDepth = parentEntry ? parentEntry.depth + 1 : 0;

    // Split on `->` or `=>` or `→`
    const chainParts = cleanLine
      .split(/\s*(?:->|=>|→)\s*/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (chainParts.length > 1) {
      let prevId = parentEntry?.id;
      chainParts.forEach((part, idx) => {
        const currentDepth = baseDepth + idx;
        const id = ensureChainNode(part, currentDepth, idx === 0 ? prevId : undefined);
        if (prevId && prevId !== id) {
          const edgeKey = `${prevId}->${id}`;
          if (!edges.some((e) => `${e.from}->${e.to}` === edgeKey)) {
            edges.push({ id: `edge_${edges.length + 1}`, from: prevId, to: id });
          }
        }
        if (idx === 0 && !parentEntry) {
          indentStack.push({ indent: rawIndent, id, depth: currentDepth });
        }
        prevId = id;
      });
    } else {
      const { label, note } = extractLabelAndNote(cleanLine);
      const id = `dnode_${seq++}`;
      nodeByKey.set(label.toLowerCase(), id);
      rawNodes.push({
        id,
        label,
        note,
        depth: baseDepth,
        parentId: parentEntry?.id,
      });
      if (parentEntry) {
        edges.push({ id: `edge_${edges.length + 1}`, from: parentEntry.id, to: id });
      }
      indentStack.push({ indent: rawIndent, id, depth: baseDepth });
    }
  }

  // Group nodes by depth column for clean left-to-right layered DAG layout
  const byDepth = new Map<number, typeof rawNodes>();
  let maxDepth = 0;
  for (const node of rawNodes) {
    maxDepth = Math.max(maxDepth, node.depth);
    const list = byDepth.get(node.depth) || [];
    list.push(node);
    byDepth.set(node.depth, list);
  }

  let maxRows = 1;
  byDepth.forEach((list) => {
    maxRows = Math.max(maxRows, list.length);
  });

  const colSpacing = 175;
  const rowSpacing = 74;
  const padX = 95;
  const padY = 48;

  const width = Math.max(360, padX * 2 + maxDepth * colSpacing);
  const height = Math.max(150, padY * 2 + (maxRows - 1) * rowSpacing);

  const positioned: ParsedDiagramNode[] = [];
  byDepth.forEach((list, depth) => {
    const colTotalH = (list.length - 1) * rowSpacing;
    const startY = (height - colTotalH) / 2;
    list.forEach((n, idx) => {
      positioned.push({
        ...n,
        x: Math.round(padX + depth * colSpacing),
        y: Math.round(startY + idx * rowSpacing),
      });
    });
  });

  return { nodes: positioned, edges, width, height };
}
