import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { PreloadedMoment } from '../services/mediaService';
import type { StickerAnimation } from '../services/mediaService';
import { playSoundEffect } from '../services/audioService';

interface MomentOverlayProps {
  moments: PreloadedMoment[];
  currentWordIndex: number;
  /** Called when a sticker triggers and should be collected. */
  onStickerCollected?: (moment: PreloadedMoment) => void;
}

/** Fallback: auto-dismiss if the reader hasn't reached the fade word. */
const FALLBACK_MS = 12_000;

/** Maps animation type to entrance CSS class. */
const ENTRANCE_CLASS: Record<StickerAnimation, string> = {
  'pop': 'animate-sticker-pop',
  'slide-left': 'animate-sticker-slide-left',
  'slide-right': 'animate-sticker-slide-right',
  'float-up': 'animate-sticker-float-up',
};

/**
 * Position slots for stickers — placed in margins around the reading block.
 * On mobile, stickers tuck into corners. On desktop, they float in the wider margins.
 */
const POSITION_SLOTS = [
  'right-0 -top-2 md:-right-22 md:top-4',
  'left-0 top-1/4 md:-left-22 md:top-1/3',
  'right-0 bottom-8 md:-right-22 md:bottom-8',
  'left-0 bottom-1/4 md:-left-22 md:bottom-4',
  'right-4 -top-2 md:right-8 md:-top-14',
  'left-4 -bottom-2 md:left-8 md:-bottom-14',
];

const MomentOverlay: React.FC<MomentOverlayProps> = ({ moments, currentWordIndex, onStickerCollected }) => {
  const [active, setActive] = useState<PreloadedMoment | null>(null);
  const [visible, setVisible] = useState(false);
  /** Tracks the position slot index assigned to the current sticker. */
  const [positionIndex, setPositionIndex] = useState(0);
  const triggeredRef = useRef<Set<number>>(new Set());
  const timerRef = useRef<number | null>(null);
  const momentCountRef = useRef(0);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => setActive(null), 500);
  }, []);

  // Fade out when the reader passes the fadeWordIndex
  useEffect(() => {
    if (active && currentWordIndex > active.fadeWordIndex) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      queueMicrotask(dismiss);
    }
  }, [currentWordIndex, active, dismiss]);

  // Trigger new moments
  useEffect(() => {
    const m = moments.find(
      (m) => m.wordIndex === currentWordIndex && !triggeredRef.current.has(m.wordIndex),
    );
    if (!m) return;

    triggeredRef.current.add(m.wordIndex);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (m.soundEffect) {
      playSoundEffect(m.soundEffect);
    }

    if (m.stickerUrl || m.stickerEmoji) {
      const slot = momentCountRef.current % POSITION_SLOTS.length;
      momentCountRef.current++;
      setPositionIndex(slot);
      setActive(m);
      requestAnimationFrame(() => setVisible(true));
      timerRef.current = window.setTimeout(dismiss, FALLBACK_MS);
      // Collect sticker for the album
      if (m.stickerLabel) onStickerCollected?.(m);
    }
  }, [currentWordIndex, moments, dismiss, onStickerCollected]);

  useEffect(() => {
    triggeredRef.current = new Set();
    momentCountRef.current = 0;
  }, [moments]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (!active) return null;

  const hasImage = !!active.stickerUrl;
  const entranceClass = ENTRANCE_CLASS[active.animation];
  const posClass = POSITION_SLOTS[positionIndex];

  return (
    <div
      className={`
        absolute ${posClass} z-20 pointer-events-none
        transition-opacity duration-500 ease-out
        ${visible ? 'opacity-100' : 'opacity-0'}
      `}
      role="status"
      aria-live="polite"
    >
      <div className={`${visible ? `${entranceClass} animate-sticker-bob` : ''}`}>
        {hasImage ? (
          <img
            src={active.stickerUrl}
            alt={active.caption}
            className={`
              w-16 h-16 md:w-24 md:h-24 object-contain
              drop-shadow-[0_3px_6px_rgba(0,0,0,0.15)]
              ${active.stickerSource === 'wikipedia' ? 'rounded-xl' : ''}
            `}
          />
        ) : (
          <span
            className="block text-5xl md:text-7xl drop-shadow-[0_3px_6px_rgba(0,0,0,0.12)] select-none"
            aria-hidden="true"
          >
            {active.stickerEmoji}
          </span>
        )}
        <p className="mt-1 text-[9px] md:text-[11px] leading-tight text-center text-gray-600
                       bg-white/90 rounded-lg px-1.5 py-0.5 shadow-sm max-w-20 md:max-w-28 mx-auto
                       pointer-events-auto cursor-pointer"
           onClick={dismiss}
        >
          💡 {active.caption}
        </p>
      </div>
    </div>
  );
};

export default MomentOverlay;
