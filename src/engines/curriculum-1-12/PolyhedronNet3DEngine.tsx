import React, { useEffect, useState } from 'react';
import { EngineProps } from '../adapter';
import { Button } from '../../components/ui/Button';

export interface PolyhedronNetConfig {
  shape?: 'cube' | 'prism' | 'pyramid';
  instruction?: string;
}

interface PolyhedronSpec {
  id: 'cube' | 'prism' | 'pyramid';
  name: string;
  vertices: number;
  edges: number;
  faces: number;
}

const SOLIDS: PolyhedronSpec[] = [
  { id: 'cube', name: 'Куб (гексаедр)', vertices: 8, edges: 12, faces: 6 },
  { id: 'prism', name: 'Трикутна призма', vertices: 6, edges: 9, faces: 5 },
  { id: 'pyramid', name: 'Чотирикутна піраміда', vertices: 5, edges: 8, faces: 5 },
];

export const PolyhedronNet3DEngine: React.FC<EngineProps<PolyhedronNetConfig>> = ({
  config,
  onStateChange,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const [shape, setShape] = useState<'cube' | 'prism' | 'pyramid'>(config.shape ?? 'cube');
  const [foldPct, setFoldPct] = useState(0); // 0 = 2D net, 100 = 3D solid
  const [vInput, setVInput] = useState('');
  const [eInput, setEInput] = useState('');
  const [fInput, setFInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const spec = SOLIDS.find((s) => s.id === shape) || SOLIDS[0];

  useEffect(() => {
    onStateChange?.({ shape, foldPct });
  }, [shape, foldPct, onStateChange]);

  const t = foldPct / 100; // 0..1 folding factor

  const handleCheck = () => {
    const v = Number(vInput);
    const e = Number(eInput);
    const f = Number(fInput);
    const euler = v - e + f;

    if (v === spec.vertices && e === spec.edges && f === spec.faces && euler === 2) {
      setIsDone(true);
      setFeedback(`✅ Формула Ейлера підтверджена: V - E + F = ${v} - ${e} + ${f} = 2!`);
      onSubmitAnswer?.({ shape, vertices: v, edges: e, faces: f });
    } else {
      setIsDone(false);
      setFeedback(
        `📐 Порахуйте уважніше на 3D-розгортці для фігури «${spec.name}»: має виконуватися V - E + F = 2.`
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-bold text-[var(--text)]">
        {config.instruction ||
          '🧊 Згорніть плоску 2D-розгортку в 3D-многогранник та перевірте формулу Ейлера (V − E + F = 2).'}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SOLIDS.map((s) => (
          <Button
            key={s.id}
            type="button"
            size="sm"
            variant={shape === s.id ? 'primary' : 'outline'}
            disabled={isReadOnly}
            onClick={() => {
              setShape(s.id);
              setFeedback(null);
              setIsDone(false);
            }}
          >
            {s.name}
          </Button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4 items-center p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-col items-center space-y-2">
          <svg viewBox="0 0 260 210" className="w-full max-w-[280px] h-auto" role="img" aria-label="2D розгортка та 3D модель">
            {shape === 'cube' && (
              <g>
                {/* Base square */}
                <rect x="108" y="88" width="44" height="44" fill="var(--hl-bg)" stroke="var(--text)" strokeWidth="2" />
                {/* Top/Bottom/Left/Right wings folding inward */}
                <rect
                  x={108 - 44 * (1 - t * 0.72)}
                  y={88 - t * 14}
                  width={Math.max(16, 44 * (1 - t * 0.65))}
                  height="44"
                  fill="var(--surface-alt)"
                  stroke="var(--text)"
                  strokeWidth="2"
                />
                <rect
                  x={152 - t * 14}
                  y={88 - t * 14}
                  width={Math.max(16, 44 * (1 - t * 0.65))}
                  height="44"
                  fill="var(--surface-alt)"
                  stroke="var(--text)"
                  strokeWidth="2"
                />
                <rect
                  x={108 + t * 14}
                  y={88 - 44 * (1 - t * 0.68)}
                  width="44"
                  height={Math.max(16, 44 * (1 - t * 0.65))}
                  fill="var(--accent)"
                  fillOpacity="0.35"
                  stroke="var(--text)"
                  strokeWidth="2"
                />
                <rect
                  x={108 + t * 14}
                  y={132 - t * 18}
                  width="44"
                  height={Math.max(16, 44 * (1 - t * 0.65))}
                  fill="var(--surface-alt)"
                  stroke="var(--text)"
                  strokeWidth="2"
                />
              </g>
            )}

            {shape === 'prism' && (
              <g>
                <rect x="105" y="75" width="50" height="65" fill="var(--hl-bg)" stroke="var(--text)" strokeWidth="2" />
                <polygon
                  points={`105,75 155,75 130,${32 + t * 28}`}
                  fill="var(--accent)"
                  fillOpacity="0.35"
                  stroke="var(--text)"
                  strokeWidth="2"
                />
                <polygon
                  points={`105,140 155,140 130,${183 - t * 28}`}
                  fill="var(--surface-alt)"
                  stroke="var(--text)"
                  strokeWidth="2"
                />
                <rect
                  x={105 - 42 * (1 - t * 0.6)}
                  y="75"
                  width={Math.max(16, 42 * (1 - t * 0.6))}
                  height="65"
                  fill="var(--surface-alt)"
                  stroke="var(--text)"
                  strokeWidth="2"
                />
                <rect
                  x={155 - t * 14}
                  y="75"
                  width={Math.max(16, 42 * (1 - t * 0.6))}
                  height="65"
                  fill="var(--surface-alt)"
                  stroke="var(--text)"
                  strokeWidth="2"
                />
              </g>
            )}

            {shape === 'pyramid' && (
              <g>
                <rect x="105" y="82" width="50" height="50" fill="var(--hl-bg)" stroke="var(--text)" strokeWidth="2" />
                <polygon
                  points={`105,82 155,82 130,${32 + t * 65}`}
                  fill="var(--accent)"
                  fillOpacity="0.35"
                  stroke="var(--text)"
                  strokeWidth="2"
                />
                <polygon
                  points={`105,132 155,132 130,${182 - t * 65}`}
                  fill="var(--surface-alt)"
                  stroke="var(--text)"
                  strokeWidth="2"
                />
                <polygon
                  points={`105,82 105,132 ${55 + t * 75},107`}
                  fill="var(--surface-alt)"
                  stroke="var(--text)"
                  strokeWidth="2"
                />
                <polygon
                  points={`155,82 155,132 ${205 - t * 75},107`}
                  fill="var(--surface-alt)"
                  stroke="var(--text)"
                  strokeWidth="2"
                />
              </g>
            )}

            <text x="130" y="200" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="var(--text-muted)">
              Згортання: {Math.round(t * 90)}° ({foldPct < 20 ? '2D розгортка' : foldPct > 80 ? '3D фігура' : 'перехід'})
            </text>
          </svg>

          <input
            type="range"
            min={0}
            max={100}
            step={5}
            disabled={isReadOnly}
            value={foldPct}
            onChange={(e) => setFoldPct(Number(e.target.value))}
            className="settings-range max-w-[240px]"
            aria-label="Кут згортання розгортки"
          />
        </div>

        <div className="space-y-2.5">
          <div className="text-xs font-extrabold text-[var(--primary-dark)]">
            Порахуйте елементи для «{spec.name}»:
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="block space-y-1 text-xs font-bold">
              <span>Вершини (V)</span>
              <input
                type="number"
                disabled={isReadOnly}
                value={vInput}
                onChange={(e) => setVInput(e.target.value)}
                className="w-full p-2 rounded border border-[var(--border)] bg-[var(--surface-alt)] font-mono text-sm font-black text-center"
              />
            </label>
            <label className="block space-y-1 text-xs font-bold">
              <span>Ребра (E)</span>
              <input
                type="number"
                disabled={isReadOnly}
                value={eInput}
                onChange={(e) => setEInput(e.target.value)}
                className="w-full p-2 rounded border border-[var(--border)] bg-[var(--surface-alt)] font-mono text-sm font-black text-center"
              />
            </label>
            <label className="block space-y-1 text-xs font-bold">
              <span>Грані (F)</span>
              <input
                type="number"
                disabled={isReadOnly}
                value={fInput}
                onChange={(e) => setFInput(e.target.value)}
                className="w-full p-2 rounded border border-[var(--border)] bg-[var(--surface-alt)] font-mono text-sm font-black text-center"
              />
            </label>
          </div>

          <div className="p-2 rounded border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-mono text-center">
            V − E + F = {vInput || '?'} − {eInput || '?'} + {fInput || '?'}
          </div>

          <Button type="button" variant="accent" size="md" className="w-full" disabled={isReadOnly} onClick={handleCheck}>
            ✓ Перевірити формулу Ейлера
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-[var(--radius-md)] border text-xs font-bold ${
            isDone
              ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
              : 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
          }`}
        >
          {feedback}
        </div>
      )}
    </div>
  );
};
