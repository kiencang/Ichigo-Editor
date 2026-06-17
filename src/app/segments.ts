export interface VideoSegment {
  id: string;
  start: number;
  end: number;
}

/**
 * Maps a virtual playhead time (seconds) to the original video's timeline.
 */
export function getOriginalTime(virtualTime: number, segments: VideoSegment[]): number {
  if (segments.length === 0) return 0;
  let accumulated = 0;
  for (const seg of segments) {
    const duration = seg.end - seg.start;
    if (virtualTime >= accumulated && virtualTime <= accumulated + duration) {
      return seg.start + (virtualTime - accumulated);
    }
    accumulated += duration;
  }
  // Overflow fallback
  return segments[segments.length - 1].end;
}

/**
 * Maps an original video timestamp back to the cumulative virtual playhead time.
 */
export function getVirtualTime(originalTime: number, segments: VideoSegment[]): number {
  if (segments.length === 0) return 0;
  let accumulated = 0;
  let lastVirtual = 0;
  for (const seg of segments) {
    if (originalTime < seg.start) {
      // Falls in a skipped gap - clamp to the start of this segment
      return accumulated;
    }
    if (originalTime >= seg.start && originalTime <= seg.end) {
      return accumulated + (originalTime - seg.start);
    }
    accumulated += (seg.end - seg.start);
    lastVirtual = accumulated;
  }
  return lastVirtual;
}

/**
 * Computes sum of active segment lengths.
 */
export function getTotalVirtualDuration(segments: VideoSegment[]): number {
  return segments.reduce((sum, seg) => sum + Math.max(0, seg.end - seg.start), 0);
}
