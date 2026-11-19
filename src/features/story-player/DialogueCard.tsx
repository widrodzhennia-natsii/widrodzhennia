import React, { useState, useEffect, useRef, useMemo } from 'react';
import { speechAudio } from '../../core/audio/formant-synth';
import { useSettingsStore } from '../../core/state/useSettingsStore';
import { ContentResolver } from '../../core/ingestion/content-resolver';
import { RichBlockText } from '../../components/ui/RichBlockText';
import { Button } from '../../components/ui/Button';
import { stripInlineMarkup } from '../../core/utils/stripInlineMarkup';
import { VarMap, interpolateVarTemplate } from '../../core/vars/var-engine';

interface DialogueCardProps {
  speaker: string;
  avatar: string;
  text: string;
  emote?: 'idea' | 'sweat' | 'question' | 'joy';
  vars?: VarMap;
  onNext: () => void;
  isLastStep?: boolean;
  instantReveal?: boolean;
  hideActionRow?: boolean;
}

export const DialogueCard: React.FC<DialogueCardProps> = ({
  speaker,
  avatar,
  text,
  emote,
  vars,
  onNext,
  isLastStep = false,
  instantReveal = false,
  hideActionRow = false,
}) => {
  const typingSpeed = useSettingsStore((s) => s.typingSpeedMs);
  const interpolatedText = useMemo(
    () => (vars ? interpolateVarTemplate(text, vars) : text),
    [text, vars]
  );
  const typewriterPlainText = useMemo(
    () => stripInlineMarkup(interpolatedText),
    [interpolatedText]
  );

  const [displayedText, setDisplayedText] = useState(instantReveal ? typewriterPlainText : '');
  const [isTyping, setIsTyping] = useState(!instantReveal);
  const [isComplete, setIsComplete] = useState(instantReveal);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isImageAvatar = Boolean(
    avatar &&
      (avatar.includes('.') ||
        avatar.startsWith('http://') ||
        avatar.startsWith('https://') ||
        avatar.startsWith('data:') ||
        avatar.startsWith('blob:') ||
        avatar.startsWith('/'))
  );

  useEffect(() => {
    if (isImageAvatar) {
      ContentResolver.resolveAssetUrl(avatar).then((url) => {
        setResolvedAvatarUrl(url);
      });
    } else {
      setResolvedAvatarUrl(null);
    }
  }, [avatar, isImageAvatar]);

  // Typewriter effect types clean plain text (never raw {{widget}} or [[tag]] syntax)
  // Bypassed completely when instantReveal=true (e.g. document/cascade mode with autoplay off)
  useEffect(() => {
    if (instantReveal) {
      if (timerRef.current) clearTimeout(timerRef.current);
      speechAudio.stop();
      setDisplayedText(typewriterPlainText);
      setIsTyping(false);
      setIsComplete(true);
      return;
    }

    setDisplayedText('');
    setIsTyping(true);
    setIsComplete(false);

    let charIdx = 0;

    const runTypewriter = () => {
      if (charIdx < typewriterPlainText.length) {
        const nextChar = typewriterPlainText.charAt(charIdx);
        setDisplayedText((prev) => prev + nextChar);

        const isVowel = /[аоуіеиєюяїє]/i.test(nextChar);
        if (isVowel || charIdx % 2 === 0) {
          speechAudio.playSyllable(nextChar, speaker, emote);
        }

        charIdx++;

        let delay = typingSpeed;
        if (/[.,;—\-]/.test(nextChar)) {
          delay = typingSpeed + 160;
        } else if (/[.!?:]/.test(nextChar)) {
          delay = typingSpeed + 300;
        } else if (nextChar === ' ') {
          delay = typingSpeed + 80;
        }

        timerRef.current = setTimeout(runTypewriter, delay);
      } else {
        setIsTyping(false);
        setIsComplete(true);
      }
    };

    timerRef.current = setTimeout(runTypewriter, typingSpeed);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      speechAudio.stop();
    };
  }, [typewriterPlainText, typingSpeed, speaker, emote, instantReveal]);

  const handleSkipOrNext = () => {
    if (!isComplete) {
      if (timerRef.current) clearTimeout(timerRef.current);
      speechAudio.stop();
      setDisplayedText(typewriterPlainText);
      setIsTyping(false);
      setIsComplete(true);
    } else {
      speechAudio.stop();
      onNext();
    }
  };

  const getEmoteIcon = () => {
    switch (emote) {
      case 'idea':
        return '💡';
      case 'sweat':
        return '💧';
      case 'question':
        return '❓';
      case 'joy':
        return '✨';
      default:
        return null;
    }
  };

  const emoteIcon = getEmoteIcon();

  return (
    <div className="card space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
        <span className="text-xs font-extrabold text-[var(--primary-dark)] uppercase tracking-wide truncate">
          💬 {speaker}
        </span>
        {!isComplete && (
          <Button type="button" variant="outline" size="sm" onClick={handleSkipOrNext}>
            ⏩ Пропустити
          </Button>
        )}
      </div>

      {/* Main Dialogue Content */}
      <div className="flex gap-3.5 sm:gap-4 items-start">
        {/* Strictly Stationary Avatar Frame; ONLY inner sprite animates while speaking */}
        <div className="relative shrink-0">
          <div className="dialogue-avatar-frame text-3xl">
            <span className={`dialogue-sprite-inner ${isTyping ? 'sprite-speaking' : ''}`}>
              {isImageAvatar && resolvedAvatarUrl ? (
                <img
                  src={resolvedAvatarUrl}
                  alt={speaker}
                  className="w-full h-full object-cover"
                />
              ) : (
                avatar || '👤'
              )}
            </span>
          </div>

          {emoteIcon && (
            <div key={`${speaker}-${emote}`} className="emote-bubble-anchor emote-bubble-pop" aria-hidden="true">
              {emoteIcon}
            </div>
          )}
        </div>

        {/* Text Container */}
        <div className="space-y-2 flex-1 min-w-0">
          <div className="p-3.5 sm:p-4 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] shadow-xs">
            {isComplete ? (
              <div className="text-sm font-semibold text-[var(--text)] leading-relaxed">
                <RichBlockText text={interpolatedText} vars={vars} interactiveWidgets={true} />
              </div>
            ) : (
              <p className="text-sm font-semibold text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                {displayedText}
                {isTyping && <span className="font-bold text-[var(--accent)]">|</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action Button */}
      {!hideActionRow && (
        <div className="pt-3 border-t border-[var(--border)] flex justify-end">
          <Button type="button" variant="primary" size="md" onClick={handleSkipOrNext}>
            {isLastStep ? '🎉 Завершити епізод' : '▶ Продовжити квест'}
          </Button>
        </div>
      )}
    </div>
  );
};
