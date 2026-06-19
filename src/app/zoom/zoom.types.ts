export interface ZoomRegion {
  id: string;
  startTime: number;
  duration: number; // overall duration of zoom effect in seconds
  scale: number;    // zoom multiplier e.g. 1.0 to 4.0
  panX: number;     // focus position X percentage (0 to 100)
  panY: number;     // focus position Y percentage (0 to 100)
}

export function getZoomAtTime(regions: ZoomRegion[], time: number): { scale: number; panX: number; panY: number } {
  if (!regions || regions.length === 0) {
    return { scale: 1.0, panX: 50, panY: 50 };
  }
  
  const active = regions.find(r => time >= r.startTime && time <= (r.startTime + r.duration));
  if (!active) {
    return { scale: 1.0, panX: 50, panY: 50 };
  }
  
  // Transition duration of 0.4 seconds (or half the region duration if very short)
  const easeDur = Math.min(0.4, active.duration / 2);
  const elapsed = time - active.startTime;
  
  let t = 1.0;
  if (elapsed < easeDur) {
    // Smooth quadratic ease-in
    t = elapsed / easeDur;
    t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  } else if (elapsed > active.duration - easeDur) {
    // Smooth quadratic ease-out
    t = (active.duration - elapsed) / easeDur;
    t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  
  const scale = 1.0 + (active.scale - 1.0) * t;
  const panX = 50 + (active.panX - 50) * t;
  const panY = 50 + (active.panY - 50) * t;
  
  return { scale, panX, panY };
}
