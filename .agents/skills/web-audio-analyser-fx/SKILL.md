---
name: web-audio-analyser-fx
description: "Web Audio API AnalyserNode effects, Siri iOS 18 style chromatic glow, reactive audio waveforms, and Apple Intelligence visualizers. Use when building voice assistants, recording orbs, audio reactive canvas visualizations, frequency-responsive glows, and fluid mic interaction feedback."
---

# Web Audio Analyser FX & Apple Intelligence Siri Visuals

This skill provides best practices, math, and implementations for building fluid, high-frame-rate, audio-reactive visual interfaces inspired by Apple Intelligence and Siri (iOS 18).

## Core Principles

1. **Low-Overhead Analyser Loop:**
   - Configure `fftSize = 64` or `fftSize = 128` (giving 32 or 64 frequency bins). Low FFT sizes give instant temporal response and consume near-zero CPU/GPU.
   - Use `analyser.smoothingTimeConstant = 0.8` to prevent jittery spikes while preserving energetic speech transitions.
   - Run animation loops using `requestAnimationFrame`, extracting normalized RMS (Root Mean Square) volume and high/mid/low band energies.

2. **Siri iOS 18 / Apple Intelligence Aesthetic:**
   - **Chromatic Rim & Mesh Glow:** Multi-layered radial gradients with smooth blend modes (`mix-blend-mode: screen` or blur convolution).
   - **Fluid Color Palette:** Violet (`#8B5CF6`), Cyan (`#06B6D4`), Magenta (`#EC4899`), Warm Amber (`#F59E0B`).
   - **Waveform Morphing:** Scale, border radius morphing, and subtle pulse based on incoming vocal pressure.
   - **Idle Breathing State:** When silent or waiting for speech, smoothly transition to a calm, breathing harmonic pulse (sinusoidal period ~2.4s).

3. **Performance & Memory Hygiene:**
   - Always cancel the `requestAnimationFrame` handle when stopping or unmounting.
   - Disconnect `MediaStreamAudioSourceNode` and `AnalyserNode` and close or suspend unused contexts to avoid audio thread battery drain.
   - Never reallocate typed arrays inside the animation tick; reuse `Uint8Array` or `Float32Array`.

4. **Speech Energy & Silence Detection (VAD):**
   - Calculate average vocal energy:
     ```ts
     let sum = 0;
     for (let i = 0; i < dataArray.length; i++) {
       sum += dataArray[i];
     }
     const average = sum / dataArray.length; // 0..255
     ```
   - Calibrate silence threshold (e.g. `average < 12`) to detect natural pauses or trigger hands-free timeouts after 2.5 seconds of silence.
