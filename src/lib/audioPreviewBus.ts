type StopHandler = () => void;

let activeOwner: string | null = null;
let activeStop: StopHandler | null = null;

/**
 * Only one 15-second preview may play at a time. When a chip starts playback it
 * asks the bus to stop whichever other chip was playing.
 */
export function requestPreviewPlayback(ownerId: string, stop: StopHandler) {
  if (activeOwner && activeOwner !== ownerId) {
    try {
      activeStop?.();
    } catch {
      // A stopped player must never break the next one.
    }
  }
  activeOwner = ownerId;
  activeStop = stop;
}

export function releasePreviewPlayback(ownerId: string) {
  if (activeOwner !== ownerId) return;
  activeOwner = null;
  activeStop = null;
}

export function stopActivePreview() {
  try {
    activeStop?.();
  } catch {
    // Ignore.
  }
  activeOwner = null;
  activeStop = null;
}
