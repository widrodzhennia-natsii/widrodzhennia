import React, { useState, useEffect, useRef } from 'react';
import { EngineProps } from '../adapter';
import { useThemeStore } from '../../core/state/useThemeStore';
import { createCanvasHatchPattern, readThemeColors } from '../../utils/themeColors';

export interface ProtractorAngleConfig {
  targetAngle?: number;
  toleranceDegrees?: number;
  mode?: 'measure' | 'build';
  instruction?: string;
  angleCategory?: 'acute' | 'right' | 'obtuse' | 'straight';
}

export const ProtractorAngleEngine: React.FC<EngineProps<ProtractorAngleConfig>> = ({
  config,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const themeMode = useThemeStore((s) => s.themeMode);
  const targetAngle = config.targetAngle || 60;
  const tolerance = config.toleranceDegrees || 3;

  const [angle, setAngle] = useState<number>(30);
  const [feedback, setFeedback] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

    const originX = width / 2;
    const originY = height - 30;
    const rayLength = 160;

    // 1. Protractor Arc
    ctx.save();
    ctx.beginPath();
    ctx.arc(originX, originY, 130, Math.PI, 0);
    ctx.fillStyle = palette.surfaceAlt;
    ctx.fill();
    ctx.strokeStyle = palette.borderHover;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ticks every 10 deg
    for (let deg = 0; deg <= 180; deg += 10) {
      const rad = ((180 - deg) * Math.PI) / 180;
      const x1 = originX + Math.cos(rad) * 120;
      const y1 = originY - Math.sin(rad) * 120;
      const x2 = originX + Math.cos(rad) * 130;
      const y2 = originY - Math.sin(rad) * 130;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = palette.textMuted;
      ctx.lineWidth = deg % 30 === 0 ? 2 : 1;
      ctx.stroke();

      if (deg % 30 === 0) {
        const textX = originX + Math.cos(rad) * 105;
        const textY = originY - Math.sin(rad) * 105;
        ctx.fillStyle = palette.text;
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${deg}°`, textX, textY + 3);
      }
    }
    ctx.restore();

    // 2. Hatched Sector Fill for current angle
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.arc(originX, originY, 120, Math.PI, Math.PI - (angle * Math.PI) / 180, true);
    ctx.closePath();
    ctx.fillStyle = createCanvasHatchPattern(ctx, palette.okBorder, palette.okBg, 8, 1.5);
    ctx.fill();
    ctx.restore();

    // 3. Base Ray OA
    ctx.strokeStyle = palette.text;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + rayLength, originY);
    ctx.stroke();

    ctx.fillStyle = palette.text;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('A', originX + rayLength + 10, originY + 4);

    // 4. Rotated Ray OB
    const radB = Math.PI - (angle * Math.PI) / 180;
    const endX = originX + Math.cos(radB) * rayLength;
    const endY = originY - Math.sin(radB) * rayLength;

    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.fillStyle = palette.accent;
    ctx.fillText('B', endX + Math.cos(radB) * 12, endY - Math.sin(radB) * 12);

    // Vertex O
    ctx.fillStyle = palette.errText;
    ctx.beginPath();
    ctx.arc(originX, originY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.text;
    ctx.fillText('O (Вершина)', originX - 30, originY + 18);
  };

  useEffect(() => {
    drawScene();
  }, [angle, themeMode]);

  const getAngleTypeLabel = (a: number) => {
    if (a < 90) return 'Гострий кут (<90°)';
    if (a === 90) return 'Прямий кут (=90°)';
    if (a < 180) return 'Тупий кут (>90°)';
    return 'Розгорнутий кут (=180°)';
  };

  const isSuccess = Math.abs(angle - targetAngle) <= tolerance;

  const handleVerify = () => {
    if (isSuccess) {
      setFeedback(`🎯 Чудово! Кут ∠AOB дорівнює ${angle}° (${getAngleTypeLabel(angle)}). Точне вимірювання!`);
      if (onSubmitAnswer) onSubmitAnswer();
    } else if (angle < targetAngle) {
      setFeedback(`📉 Кут ${angle}° занадто малий. Збільште кут повороту променя OB (ціль: ${targetAngle}°)!`);
    } else {
      setFeedback(`📈 Кут ${angle}° занадто великий. Зменште кут повороту променя OB (ціль: ${targetAngle}°)!`);
    }
  };

  return (
    <div className="p-5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-[var(--radius-md)] space-y-4 shadow-card">
      <div className="text-center space-y-1">
        <h4 className="text-sm font-extrabold text-[var(--primary-dark)] uppercase tracking-wide">
          📐 Інтерактивний транспортир та кутомір
        </h4>
        <p className="text-xs text-[var(--text-muted)] font-medium">
          {config.instruction || `Побудуйте або виміряйте кут ∠AOB (${targetAngle}°):`}
        </p>
      </div>

      <div className="bg-[var(--bg)] rounded-[var(--radius-md)] border border-[var(--border)] p-2 flex justify-center">
        <canvas
          ref={canvasRef}
          width={480}
          height={200}
          className="w-full max-w-full h-auto bg-[var(--surface)] rounded border border-[var(--border)]"
        />
      </div>

      <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg)] rounded border border-[var(--border)] text-xs font-bold font-mono">
        <span>Поточний кут ∠AOB: <strong className="text-[var(--primary-dark)] text-sm">{angle}°</strong></span>
        <span>Тип кута: <strong className="text-[var(--ok-text)]">{getAngleTypeLabel(angle)}</strong></span>
      </div>

      {!isReadOnly && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => { setAngle((prev) => Math.max(0, prev - 5)); setFeedback(null); }}
              className="btn btn-outline px-4 py-2 text-xs font-bold"
            >
              - 5°
            </button>

            <input
              type="range"
              min="0"
              max="180"
              value={angle}
              onChange={(e) => { setAngle(Number(e.target.value)); setFeedback(null); }}
              className="w-48 accent-[var(--accent)] cursor-pointer"
            />

            <button
              type="button"
              onClick={() => { setAngle((prev) => Math.min(180, prev + 5)); setFeedback(null); }}
              className="btn btn-outline px-4 py-2 text-xs font-bold"
            >
              + 5°
            </button>
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
            Підтвердити вимірювання кута 📐
          </button>
        </div>
      )}
    </div>
  );
};
