'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { audioEngine } from '@/lib/audioEngine';

export interface RampageAudioWaveformProps {
  isPlaying?: boolean;
  barCount?: number;
  className?: string;
  barColorClassName?: string;
}

const DEFAULT_13_BAR_HEIGHTS = [7, 12, 18, 25, 30, 22, 28, 20, 26, 21, 16, 11, 7];
const DEFAULT_8_BAR_HEIGHTS = [8, 16, 26, 30, 24, 28, 18, 9];

export function RampageAudioWaveform({
  isPlaying = false,
  barCount = 13,
  className = '',
  barColorClassName = 'bg-[color:var(--pastel-peri-ink)]',
}: RampageAudioWaveformProps) {
  const prefersReducedMotion = useReducedMotion();
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const baseHeights = useMemo(() => {
    if (barCount === 8) return DEFAULT_8_BAR_HEIGHTS;
    if (barCount === 13) return DEFAULT_13_BAR_HEIGHTS;
    // Generate an organic envelope for custom bar count
    return Array.from({ length: barCount }, (_, i) => {
      const normalized = i / (barCount - 1); // 0 to 1
      const sinBell = Math.sin(normalized * Math.PI);
      const ripple = Math.sin(normalized * Math.PI * 3) * 0.18;
      const height = Math.round(7 + Math.max(0, sinBell + ripple) * 23);
      return Math.max(6, Math.min(30, height));
    });
  }, [barCount]);

  useEffect(() => {
    const bars = barRefs.current;

    if (!isPlaying || prefersReducedMotion) {
      bars.forEach((bar) => {
        if (bar) {
          bar.style.transform = 'scaleY(1)';
          bar.style.opacity = isPlaying ? '0.85' : '0.4';
        }
      });
      return;
    }

    let animId: number;
    const freqData = new Uint8Array(32);

    const update = (now: number) => {
      const time = now * 0.005;
      let energy = 0;
      let hasFreq = false;

      if (audioEngine) {
        energy = audioEngine.getReactiveEnergy();
        const res = audioEngine.getAudioFrequencyData(freqData);
        hasFreq = Boolean(res);
      }

      const isVoiceActive = energy > 0.02 || (audioEngine && audioEngine.getIsVoicePlaying());

      bars.forEach((bar, index) => {
        if (!bar) return;

        // Extract frequency bin corresponding to vocal range
        let freqBinVal = 0;
        if (hasFreq && isVoiceActive) {
          const binIndex = Math.min(31, Math.floor(2 + (index / barCount) * 16));
          freqBinVal = (freqData[binIndex] || 0) / 255;
        }

        // Constant organic wave component so bars stay fluidly in motion
        const wave = Math.sin(time + index * 0.48) * 0.28 + 0.72;

        // Dynamic voice reactivity boost
        const voiceBoost = isVoiceActive ? (freqBinVal * 1.1 + energy * 0.8) : 0;
        const scale = Math.min(1.85, Math.max(0.35, wave * 0.65 + voiceBoost * 0.95));

        bar.style.transform = `scaleY(${scale.toFixed(3)})`;
        bar.style.opacity = isVoiceActive ? '1' : '0.75';
      });

      animId = requestAnimationFrame(update);
    };

    animId = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(animId);
      bars.forEach((bar) => {
        if (bar) {
          bar.style.transform = 'scaleY(1)';
          bar.style.opacity = '0.4';
        }
      });
    };
  }, [isPlaying, prefersReducedMotion, barCount]);

  return (
    <div
      aria-hidden="true"
      className={`flex h-8 items-center gap-[3px] select-none ${className}`}
    >
      {baseHeights.map((height, index) => (
        <span
          key={index}
          ref={(el) => {
            barRefs.current[index] = el;
          }}
          style={{ height: `${height}px` }}
          className={`w-[3px] rounded-full origin-center transition-opacity duration-300 ${barColorClassName}`}
        />
      ))}
    </div>
  );
}
