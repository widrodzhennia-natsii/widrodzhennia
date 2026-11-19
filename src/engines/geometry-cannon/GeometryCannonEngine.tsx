import React, { useState, useEffect, useRef } from 'react';
import { EngineProps } from '../adapter';
import { useThemeStore } from '../../core/state/useThemeStore';
import { createCanvasHatchPattern, readThemeColors } from '../../utils/themeColors';

export interface GeometryCannonConfig {
  title?: string;
  targetDistance?: number;
  targetLabel?: string;
  launcherLabel?: string;
  correctAngle?: number;
  tolerance?: number;
  instruction?: string;
  successMessage?: string;
}

export const GeometryCannonEngine: React.FC<EngineProps<GeometryCannonConfig>> = ({
  config,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const themeMode = useThemeStore((s) => s.themeMode);
  const targetAngle = config.correctAngle ?? 45;
  const tolerance = config.tolerance ?? 5;
  const distanceMeters = config.targetDistance ?? 450;
  const targetLabel = config.targetLabel || `Ціль (${distanceMeters}м)`;
  const launcherLabel = config.launcherLabel || 'Позиція';

  const [angle, setAngle] = useState<number>(30);
  const [isFiring, setIsFiring] = useState<boolean>(false);
  const [hitResult, setHitResult] = useState<string | null>(null);
  const [isHitSuccess, setIsHitSuccess] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    setAngle(30);
    setHitResult(null);
    setIsHitSuccess(false);
    setIsFiring(false);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [config]);

  const drawScene = (currentAngle: number, shellProgress: number | null = null) => {
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

    // Coordinate grid background
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Target zone on the right (hatched pattern for mono distinction)
    ctx.fillStyle = createCanvasHatchPattern(ctx, palette.borderHover, palette.surfaceAlt, 10, 1);
    ctx.fillRect(width - 130, 0, 130, height);
    ctx.fillStyle = palette.text;
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('Зона цілі', width - 95, 22);

    const targetX = width - 140;
    const targetY = height - 40;
    ctx.fillStyle = palette.errText;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.text;
    ctx.fillText(`🎯 ${targetLabel}`, targetX - 45, targetY - 15);

    // Launcher base on the left
    const cannonX = 50;
    const cannonY = height - 30;
    ctx.fillStyle = palette.accent;
    ctx.fillRect(20, height - 60, 60, 60);
    ctx.fillStyle = palette.accentText;
    ctx.fillText(launcherLabel, 26, height - 35);

    // Barrel rotated by angle
    const barrelLen = 32;
    const rad = (currentAngle * Math.PI) / 180;
    const muzzleX = cannonX + Math.cos(rad) * barrelLen;
    const muzzleY = cannonY - Math.sin(rad) * barrelLen;

    ctx.save();
    ctx.translate(cannonX, cannonY);
    ctx.rotate(-rad);
    ctx.fillStyle = palette.text;
    ctx.fillRect(0, -6, barrelLen, 12);
    ctx.restore();

    if (shellProgress !== null) {
      const targetRad = (targetAngle * Math.PI) / 180;
      const isDirectMatch = Math.abs(currentAngle - targetAngle) <= tolerance;
      let endX: number;
      if (isDirectMatch) {
        endX = targetX;
      } else if (currentAngle < targetAngle) {
        const ratio = Math.max(0.12, Math.sin(2 * rad) / Math.max(0.2, Math.sin(2 * targetRad)));
        endX = Math.max(muzzleX + 8, cannonX + (targetX - cannonX) * Math.min(0.88, ratio));
      } else {
        endX = Math.min(width - 20, targetX + (currentAngle - targetAngle) * 2.4);
      }
      const endY = targetY;
      const peakHeight = Math.max(24, Math.sin(rad) * 90);

      const evalArc = (p: number) => ({
        x: muzzleX + (endX - muzzleX) * p,
        y: muzzleY + (endY - muzzleY) * p - 4 * peakHeight * p * (1 - p),
      });

      ctx.strokeStyle = palette.hlBorder;
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(muzzleX, muzzleY);

      const steps = Math.max(1, Math.round(shellProgress * 24));
      for (let s = 1; s <= steps; s++) {
        const pt = evalArc((s / steps) * shellProgress);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      const tip = evalArc(shellProgress);
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = isDirectMatch && shellProgress >= 0.98 ? palette.okBorder : palette.text;
      ctx.fill();
    }
  };

  useEffect(() => {
    drawScene(angle, null);
  }, [angle, targetLabel, launcherLabel, themeMode]);

  const handleFire = () => {
    if (isReadOnly || isFiring) return;
    setIsFiring(true);
    setHitResult(null);
    setIsHitSuccess(false);

    if (angle >= 85) {
      let progress = 0;
      intervalRef.current = window.setInterval(() => {
        progress += 0.05;
        drawScene(angle, progress);
        if (progress >= 1) {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          setIsFiring(false);
          setHitResult('Кут близький до 90°: траєкторія спрямована майже вертикально вгору — дальність нульова.');
        }
      }, 40);
      return;
    }

    const diff = Math.abs(angle - targetAngle);
    const isSuccess = diff <= tolerance;

    let progress = 0;
    intervalRef.current = window.setInterval(() => {
      progress += 0.06;
      drawScene(angle, progress);

      if (progress >= 1) {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        setIsFiring(false);

        if (isSuccess) {
          setIsHitSuccess(true);
          setHitResult(
            config.successMessage ||
              `Точне геометричне влучання! Обраний кут ${angle}° забезпечує потрібну дальність.`
          );
          if (onSubmitAnswer) onSubmitAnswer(angle);
        } else if (angle < targetAngle) {
          setHitResult(`Недоліт (кут ${angle}°). Кут занадто низький — траєкторія завершилась перед ціллю.`);
        } else {
          setHitResult(`Переліт (кут ${angle}°). Кут занадто великий відносно оптимального кута (${targetAngle}°).`);
        }
      }
    }, 45);
  };

  return (
    <div className="p-4 sm:p-6 bg-[var(--surface)] border-2 border-[var(--border)] rounded-[var(--radius-md)] space-y-4 shadow-card">
      <div className="text-center space-y-1">
        <h4 className="text-sm font-extrabold text-[var(--primary-dark)] uppercase tracking-wide">
          📐 {config.title || 'Геометричний розрахунок кута траєкторії'}
        </h4>
        <p className="text-xs text-[var(--text-muted)] font-medium">
          {config.instruction || `Налаштуйте кут для ураження цілі на відстані ${distanceMeters} м (орієнтир: ${targetAngle}°):`}
        </p>
      </div>

      <div className="space-y-3">
        <div className="bg-[var(--bg)] rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden shadow-xs flex justify-center p-2">
          <canvas
            ref={canvasRef}
            width={520}
            height={180}
            className="w-full max-w-full h-auto aspect-[26/9] bg-[var(--surface)] rounded border border-[var(--border)]"
          />
        </div>

        <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg)] rounded-[var(--radius-sm)] border border-[var(--border)] text-xs font-mono font-bold">
          <span>Встановлений кут: <strong className="text-[var(--primary-dark)] text-sm">{angle}°</strong></span>
          <span>Дальність: <strong>{distanceMeters} м</strong></span>
        </div>

        {hitResult && (
          <div className={`status-panel ${isHitSuccess ? 'status-panel--success' : 'status-panel--warning'}`}>
            {hitResult}
          </div>
        )}
      </div>

      {!isReadOnly && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              disabled={isFiring}
              onClick={() => { setAngle((prev) => Math.max(0, prev - 5)); setHitResult(null); }}
              className="btn btn-outline px-4 py-2 text-xs font-bold"
            >
              - 5°
            </button>

            <input
              type="range"
              min="0"
              max="90"
              disabled={isFiring}
              value={angle}
              onChange={(e) => { setAngle(Number(e.target.value)); setHitResult(null); }}
              className="w-40 sm:w-48 accent-[var(--accent)] cursor-pointer"
            />

            <button
              type="button"
              disabled={isFiring}
              onClick={() => { setAngle((prev) => Math.min(90, prev + 5)); setHitResult(null); }}
              className="btn btn-outline px-4 py-2 text-xs font-bold"
            >
              + 5°
            </button>
          </div>

          <button
            type="button"
            disabled={isFiring}
            onClick={handleFire}
            className="btn btn-primary w-full text-xs font-bold py-3"
          >
            {isFiring ? '⏳ Розрахунок траєкторії...' : '🚀 Запустити перевірку кута'}
          </button>
        </div>
      )}
    </div>
  );
};
