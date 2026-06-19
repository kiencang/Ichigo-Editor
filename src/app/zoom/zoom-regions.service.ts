import { Injectable, signal, computed } from '@angular/core';
import { ZoomRegion, getZoomAtTime } from './zoom.types';

@Injectable({ providedIn: 'root' })
export class ZoomRegionsService {
  zoomRegions = signal<ZoomRegion[]>([]);
  activeZoomId = signal<string | null>(null);

  currentActiveZoom = computed(() => {
    return this.zoomRegions().find((z) => z.id === this.activeZoomId()) || null;
  });

  currentZoomState(currentTime: number) {
    return getZoomAtTime(this.zoomRegions(), currentTime);
  }

  addZoomRegion(current: number, videoDur: number) {
    if (videoDur <= 0) return null;
    const dur = Math.min(3, Math.max(0.1, videoDur - current));
    if (dur <= 0) return null;

    const newZoom: ZoomRegion = {
      id: "zoom_" + Math.random().toString(36).substring(2, 11),
      startTime: current,
      duration: dur,
      scale: 2.0,
      panX: 0,
      panY: 0,
    };

    this.zoomRegions.update((zooms) => [...zooms, newZoom]);
    this.activeZoomId.set(newZoom.id);
    return newZoom;
  }

  deleteZoomRegion(id: string) {
    this.zoomRegions.update((all) => all.filter((z) => z.id !== id));
    if (this.activeZoomId() === id) {
      this.activeZoomId.set(null);
    }
  }

  updateZoomStartTime(id: string, newTime: number, videoDur: number) {
    const validTime = Math.max(0, Math.min(videoDur, Number(newTime)));
    this.zoomRegions.update((all) =>
      all.map((z) => (z.id === id ? { ...z, startTime: validTime } : z)),
    );
  }

  updateZoomDuration(id: string, newDuration: number, videoDur: number) {
    const validDur = Math.max(0.1, Math.min(videoDur, Number(newDuration)));
    this.zoomRegions.update((all) =>
      all.map((z) => (z.id === id ? { ...z, duration: validDur } : z)),
    );
  }

  updateZoomScale(id: string, newScale: number) {
    const validScale = Math.max(1.0, Math.min(4.0, Number(newScale)));
    this.zoomRegions.update((all) =>
      all.map((z) => (z.id === id ? { ...z, scale: validScale } : z)),
    );
  }

  updateZoomPanX(id: string, newPanX: number) {
    const validX = Math.max(0, Math.min(100, Number(newPanX)));
    this.zoomRegions.update((all) =>
      all.map((z) => (z.id === id ? { ...z, panX: validX } : z)),
    );
  }

  updateZoomPanY(id: string, newPanY: number) {
    const validY = Math.max(0, Math.min(100, Number(newPanY)));
    this.zoomRegions.update((all) =>
      all.map((z) => (z.id === id ? { ...z, panY: validY } : z)),
    );
  }
}
