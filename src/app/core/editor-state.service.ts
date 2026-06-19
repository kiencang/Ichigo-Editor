import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class EditorStateService {
  // Localization
  lang = signal<'en' | 'vi'>('vi');

  // Video State
  videoFile = signal<File | null>(null);
  videoUrl = signal<string | null>(null);
  isVideoLoaded = signal(false);
  videoDuration = signal(0);
  videoWidth = signal(0);
  videoHeight = signal(0);

  // Playback State
  currentTime = signal<number>(0);
  isPlaying = signal<boolean>(false);

  // UI/Timeline State
  timelineZoom = signal<number>(1);
  activeDrag = signal<"start" | "end" | "playhead" | null>(null);

  // Output formatting
  volume = signal<number>(100);
  outputFormat = signal<string>("webm");
  audioBitrate = signal<number>(192000);
  videoBitrate = signal<number>(0); // 0 = Auto
  outputUrl = signal<string | null>(null);

  // Extra features
  logoFile = signal<File | null>(null);
  logoPreviewUrl = signal<string | null>(null);
  logoPosition = signal<"top-left" | "top-right" | "bottom-left" | "bottom-right">("top-right");
  logoOpacity = signal<number>(50);
  logoSize = signal<number>(15);
  transitionDuration = signal<number>(1); // Duration for segment transitions in seconds

  logs = signal<string[]>([]);

  // Computed helper for timeline ruler
  rulerTicks = computed(() => {
    const duration = this.videoDuration();
    if (duration <= 0) return [];

    let interval = 1;
    if (duration > 600) interval = 120;
    else if (duration > 300) interval = 60;
    else if (duration > 120) interval = 20;
    else if (duration > 60) interval = 10;
    else if (duration > 30) interval = 5;
    else if (duration > 15) interval = 2;

    const ticks = [];
    for (let i = 0; i <= duration; i += interval) {
      ticks.push({
        time: i,
        percent: (i / duration) * 100,
      });
    }
    return ticks;
  });

  resetVideoState() {
    this.videoFile.set(null);
    if (this.videoUrl()) {
      URL.revokeObjectURL(this.videoUrl()!);
    }
    this.videoUrl.set(null);
    this.isVideoLoaded.set(false);
    this.videoDuration.set(0);
    this.currentTime.set(0);
    this.isPlaying.set(false);
    this.outputUrl.set(null);
    this.logs.set([]);
  }

  addLog(msg: string) {
    this.logs.update(l => [...l, msg]);
  }
}
