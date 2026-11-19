import React, { useState, useEffect, useRef } from 'react';
import { EngineProps } from '../adapter';
import { useThemeStore } from '../../core/state/useThemeStore';
import { readThemeColors } from '../../utils/themeColors';

export interface CoordinatePlaneConfig {
  title?: string;
  vesselSymbol?: string;
  targetLabel?: string;
  targetPoint?: { x: number; y: number };
  obstacles?: Array<{ x: number; y: number; label: string }>;
  instruction?: string;
}

export const CoordinatePlaneEngine: React.FC<EngineProps<CoordinatePlaneConfig>> = ({
  config,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const themeMode = useThemeStore((s) => s.themeMode);
  const target = config.targetPoint || { x: 6, y: 4 };
  const vesselSymbol = config.vesselSymbol || '📍';
  const targetLabel = config.targetLabel || 'Пункт призначення';
  const obstacles = config.obstacles || [
    { x: 2, y: 3, label: '⚠️ Перешкода A' },
    { x: 5, y: 8, label: '⚠️ Перешкода B' },
  ];

  const [coordX, setCoordX] = useState<number>(1);
  const [coordY, setCoordY] = useState<number>(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setCoordX(1);
    setCoordY(1);
    setFeedback(null);
  }, [config]);

  const drawScene = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const palette = readThemeColors();
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = palette.surface;
    ctx.fillRect(0, 0, width, height);

    const margin = 40;
    const gridW = width - margin * 2;
    const gridH = height - margin * 2;
    const stepX = gridW / 10;
    const stepY = gridH / 10;

    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = margin + i * stepX;
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, height - margin);
      ctx.stroke();

      ctx.fillStyle = palette.textMuted;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i), x, height - margin + 15);

      const y = height - margin - i * stepY;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillText(String(i), margin - 8, y + 4);
    }

    ctx.strokeStyle = palette.text;
    ctx.lineWidth = 2.5;

    // OX axis
    ctx.beginPath();
    ctx.moveTo(margin, height - margin);
    ctx.lineTo(width - margin + 10, height - margin);
    ctx.stroke();
    ctx.fillStyle = palette.text;
    ctx.textAlign = 'left';
    ctx.fillText('X', width - margin + 16, height - margin + 4);

    // OY axis
    ctx.beginPath();
    ctx.moveTo(margin, height - margin);
    ctx.lineTo(margin, margin - 10);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillText('Y', margin, margin - 15);

    // Draw Obstacles
    obstacles.forEach((obs) => {
      const obsX = margin + obs.x * stepX;
      const obsY = height - margin - obs.y * stepY;
      ctx.fillStyle = palette.errText;
      ctx.beginPath();
      ctx.arc(obsX, obsY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(obs.label, obsX + 10, obsY - 5);
    });

    // Draw Target Location
    const targetPxX = margin + target.x * stepX;
    const targetPxY = height - margin - target.y * stepY;
    ctx.fillStyle = palette.okBorder;
    ctx.beginPath();
    ctx.arc(targetPxX, targetPxY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.okText;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`🎯 ${targetLabel} (${target.x}, ${target.y})`, targetPxX + 12, targetPxY + 4);

    // Draw Current Marker
    const currPxX = margin + coordX * stepX;
    const currPxY = height - margin - coordY * stepY;

    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(margin, height - margin);
    ctx.lineTo(currPxX, currPxY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(vesselSymbol, currPxX, currPxY + 7);
  };

  useEffect(() => {
    drawScene();
  }, [coordX, coordY, target.x, target.y, vesselSymbol, targetLabel, themeMode]);

  const isSuccess = coordX === target.x && coordY === target.y;

  const handleVerify = () => {
    const hitObstacle = obstacles.find((o) => o.x === coordX && o.y === coordY);
    if (hitObstacle) {
      setFeedback(`Обережно! Точка (${coordX}, ${coordY}) містить перешкоду: ${hitObstacle.label}.`);
    } else if (isSuccess) {
      setFeedback(`Точно! Координати (${coordX}, ${coordY}) збігаються з точкою «${targetLabel}».`);
      if (onSubmitAnswer) onSubmitAnswer({ x: coordX, y: coordY });
    } else {
      setFeedback(`Поточна позиція: (${coordX}, ${coordY}). Спрямуйте до координат (${target.x}, ${target.y}).`);
    }
  };

  return (
    <div className="p-5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-[var(--radius-md)] space-y-4 shadow-card">
      <div className="text-center space-y-1">
        <h4 className="text-sm font-extrabold text-[var(--primary-dark)] uppercase tracking-wide">
          🗺️ {config.title || 'Координатна сітка та прокладання маршруту'}
        </h4>
        <p className="text-xs text-[var(--text-muted)] font-medium">
          {config.instruction || `Визначте та задайте точні координати точки (${target.x}, ${target.y}):`}
        </p>
      </div>

      <div className="bg-[var(--bg)] rounded-[var(--radius-md)] border border-[var(--border)] p-2 flex justify-center">
        <canvas
          ref={canvasRef}
          width={460}
          height={260}
          className="w-full max-w-full h-auto aspect-[23/13] bg-[var(--surface)] rounded border border-[var(--border)]"
        />
      </div>

      {!isReadOnly && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--bg)] rounded border border-[var(--border)] text-xs font-bold font-mono">
            <div className="flex items-center justify-between">
              <span>Координата X:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => { setCoordX((prev) => Math.max(0, prev - 1)); setFeedback(null); }}
                  className="btn btn-outline w-7 h-7 p-0 text-xs font-bold"
                >
                  -
                </button>
                <span className="w-5 text-center text-sm text-[var(--primary-dark)]">{coordX}</span>
                <button
                  type="button"
                  onClick={() => { setCoordX((prev) => Math.min(10, prev + 1)); setFeedback(null); }}
                  className="btn btn-outline w-7 h-7 p-0 text-xs font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span>Координата Y:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => { setCoordY((prev) => Math.max(0, prev - 1)); setFeedback(null); }}
                  className="btn btn-outline w-7 h-7 p-0 text-xs font-bold"
                >
                  -
                </button>
                <span className="w-5 text-center text-sm text-[var(--primary-dark)]">{coordY}</span>
                <button
                  type="button"
                  onClick={() => { setCoordY((prev) => Math.min(10, prev + 1)); setFeedback(null); }}
                  className="btn btn-outline w-7 h-7 p-0 text-xs font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {feedback && (
            <div className={`status-panel ${isSuccess ? 'status-panel--success' : 'status-panel--warning'}`}>
              {feedback}
            </div>
          )}

          <button
            type="button"
            onClick={handleVerify}
            className="btn btn-primary w-full text-xs font-bold py-2.5"
          >
            Підтвердити координати ({coordX}, {coordY})
          </button>
        </div>
      )}
    </div>
  );
};
