import { Injectable, signal, computed } from '@angular/core';
import { VideoSegment, getTotalVirtualDuration } from './segments';

@Injectable({
  providedIn: 'root'
})
export class VideoSegments {
  videoSegments = signal<VideoSegment[]>([]);
  selectedSegmentId = signal<string | null>(null);
  segmentHistoryList = signal<VideoSegment[][]>([]);
  videoDuration = signal<number>(0);

  trimStart = computed(() => {
    const s = this.videoSegments();
    return s.length > 0 ? s[0].start : 0;
  });

  trimEnd = computed(() => {
    const s = this.videoSegments();
    return s.length > 0 ? s[s.length - 1].end : this.videoDuration();
  });

  selectedSegmentStart = computed(() => {
    const selId = this.selectedSegmentId();
    const segments = this.videoSegments();
    const activeSeg = segments.find(s => s.id === selId) || segments[0];
    return activeSeg ? activeSeg.start : 0;
  });

  selectedSegmentEnd = computed(() => {
    const selId = this.selectedSegmentId();
    const segments = this.videoSegments();
    const activeSeg = segments.find(s => s.id === selId) || segments[0];
    return activeSeg ? activeSeg.end : this.videoDuration();
  });

  trimmedDuration = computed(() => {
    return getTotalVirtualDuration(this.videoSegments());
  });

  selectedSegmentIndex = computed(() => {
    const selId = this.selectedSegmentId();
    if (!selId) return 0;
    const idx = this.videoSegments().findIndex(s => s.id === selId);
    return idx !== -1 ? idx : 0;
  });

  canUndo = computed(() => {
    return this.segmentHistoryList().length > 0;
  });

  isGifDisabled = computed(() => {
    return this.trimmedDuration() > 60;
  });

  saveSegmentState() {
    const current = this.videoSegments().map(s => ({ ...s }));
    this.segmentHistoryList.update(all => {
      const next = [...all, current];
      if (next.length > 50) {
        next.shift();
      }
      return next;
    });
  }

  undoSegments(checkLimitsCallback?: () => void) {
    const list = this.segmentHistoryList();
    if (list.length > 0) {
      const parent = [...list];
      const prevState = parent.pop()!;
      this.segmentHistoryList.set(parent);
      
      this.videoSegments.set(prevState);
      if (prevState.length > 0) {
        const stillExists = prevState.some(s => s.id === this.selectedSegmentId());
        if (!stillExists) {
          this.selectedSegmentId.set(prevState[0].id);
        }
      } else {
        this.selectedSegmentId.set(null);
      }
      if (checkLimitsCallback) {
        checkLimitsCallback();
      }
    }
  }

  splitSegmentAtPlayhead(currentTime: number, checkLimitsCallback?: () => void) {
    const segments = this.videoSegments();
    
    // Find the segment containing current time
    const target = segments.find(s => currentTime > s.start && currentTime < s.end);
    if (!target) return;
    
    this.saveSegmentState();
    
    const index = segments.findIndex(s => s.id === target.id);
    const seg1: VideoSegment = { id: 'seg_' + Date.now() + '_a', start: target.start, end: currentTime };
    const seg2: VideoSegment = { id: 'seg_' + Date.now() + '_b', start: currentTime, end: target.end };
    
    const newSegments = [
      ...segments.slice(0, index),
      seg1,
      seg2,
      ...segments.slice(index + 1)
    ];
    this.videoSegments.set(newSegments);
    this.selectedSegmentId.set(seg2.id);
    if (checkLimitsCallback) {
      checkLimitsCallback();
    }
  }

  deleteSegment(id: string, checkLimitsCallback?: () => void) {
    if (this.videoSegments().length <= 1) return;
    this.saveSegmentState();
    const newSegments = this.videoSegments().filter(s => s.id !== id);
    this.videoSegments.set(newSegments);
    if (this.selectedSegmentId() === id) {
      this.selectedSegmentId.set(newSegments[0]?.id || null);
    }
    if (checkLimitsCallback) {
      checkLimitsCallback();
    }
  }

  updateSegmentStart(id: string, val: number, checkLimitsCallback?: () => void) {
    const segments = this.videoSegments();
    const idx = segments.findIndex(s => s.id === id);
    if (idx === -1) return;
    this.saveSegmentState();
    
    const minStart = idx > 0 ? segments[idx - 1].end : 0;
    const maxStart = segments[idx].end - 0.1;
    const boundedStart = Math.max(minStart, Math.min(maxStart, val));
    
    const nextSegments = segments.map(s => s.id === id ? { ...s, start: boundedStart } : s);
    this.videoSegments.set(nextSegments);
    if (checkLimitsCallback) {
      checkLimitsCallback();
    }
  }

  updateSegmentEnd(id: string, val: number, checkLimitsCallback?: () => void) {
    const segments = this.videoSegments();
    const idx = segments.findIndex(s => s.id === id);
    if (idx === -1) return;
    this.saveSegmentState();
    
    const minEnd = segments[idx].start + 0.1;
    const maxEnd = idx < segments.length - 1 ? segments[idx + 1].start : this.videoDuration();
    const boundedEnd = Math.max(minEnd, Math.min(maxEnd, val));
    
    const nextSegments = segments.map(s => s.id === id ? { ...s, end: boundedEnd } : s);
    this.videoSegments.set(nextSegments);
    if (checkLimitsCallback) {
      checkLimitsCallback();
    }
  }

  resetSegments(duration: number) {
    const initSeg: VideoSegment = {
      id: 'seg_' + Date.now(),
      start: 0,
      end: duration
    };
    this.videoDuration.set(duration);
    this.videoSegments.set([initSeg]);
    this.selectedSegmentId.set(initSeg.id);
    this.segmentHistoryList.set([]);
  }
}
