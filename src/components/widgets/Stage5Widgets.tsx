import React from 'react';
import { IndentedDiagramSvg } from '../../core/diagrams/IndentedDiagramSvg';
import { WidgetDefinition, strArg } from './widget.types';

const DEFAULT_FLOW_TEXT = 'Умова -> Аналіз -> Формула -> Перевірка';

const renderFlowDiagram = (args: Parameters<WidgetDefinition['render']>[0]) => {
  const title = strArg(args, ['title', 'label'], 'Схема взаємозв’язків');
  const spec = strArg(args, ['spec', 'src', 'text', 'steps'], DEFAULT_FLOW_TEXT, 0);
  return <IndentedDiagramSvg sourceText={spec} title={title} />;
};

export const STAGE5_WIDGETS: Record<string, WidgetDefinition> = {
  flow_diagram: {
    type: 'flow_diagram',
    label: 'Текстова схема (відступи й стрілки)',
    category: 'subject',
    render: renderFlowDiagram,
  },
  indented_diagram: {
    type: 'indented_diagram',
    label: 'Ієрархічна діаграма з тексту',
    category: 'subject',
    render: renderFlowDiagram,
  },
};
