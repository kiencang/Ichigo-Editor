import {ChangeDetectionStrategy, Component, signal, computed, ViewChild, ElementRef, afterNextRender, inject} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DecimalPipe } from '@angular/common';
import { getTranslations } from './translations';
import { TimeFormatter } from './time-formatter';
import { WaveformProcessor } from './waveform-processor';
import { CanvasDrawer } from './canvas-drawer';
import { ExportProcessor } from './export-processor';
import { Stroke, drawStrokesOnContext } from './stroke.types';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [FormsModule, MatIconModule, DecimalPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private waveformProcessor = inject(WaveformProcessor);
  private canvasDrawer = inject(CanvasDrawer);
  private exportProcessor = inject(ExportProcessor);

  lang = signal<'vi' | 'en'>('vi');

  setLang(l: 'vi' | 'en') {
    this.lang.set(l);
  }

  translations = computed(() => {
    return getTranslations(this.lang());
  });

  isLoaded = signal(false);
  isLoading = signal(false);
  isProcessing = signal(false);
  progress = signal(0);
  logs = signal<string[]>([]);
  errorMessage = signal<string | null>(null);
  
  videoFile = signal<File | null>(null);
  videoUrl = signal<string | null>(null);
  videoDuration = signal(0);
  videoWidth = signal(0);
  videoHeight = signal(0);
  
  trimStart = signal<number>(0);
  trimEnd = signal<number>(0);
  
  trimmedDuration = computed(() => {
    return Math.max(0, this.trimEnd() - this.trimStart());
  });

  isGifDisabled = computed(() => {
    return this.trimmedDuration() > 60;
  });
  volume = signal<number>(100);
  outputFormat = signal<string>('webm');
  audioBitrate = signal<number>(192000);
  videoBitrate = signal<number>(0); // 0 = Auto, other values are explicit bps: 2000000, 4000000, 8000000
  
  audioTracks = signal<{id: string, file: File, url: string, duration: number, waveform: number[], volume: number}[]>([]);
  isExtractingBgWaveform = signal<boolean>(false);
  logoFile = signal<File | null>(null);
  logoPreviewUrl = signal<string | null>(null);
  logoPosition = signal<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-right');
  logoOpacity = signal<number>(50);
  logoSize = signal<number>(15);
  previewAudio: HTMLAudioElement | null = null;
  
  currentTool = signal<'pointer' | 'pen' | 'arrow'>('pointer');
  color = signal<string>('#ef4444'); // Tailwind red-500
  strokes = signal<Stroke[]>([]);
  activeStrokeId = signal<string | null>(null);
  currentActiveStroke = computed(() => {
    const id = this.activeStrokeId();
    if (!id) return null;
    return this.strokes().find(s => s.id === id) || null;
  });
  private activeStroke: Stroke | null = null;
  
  outputUrl = signal<string | null>(null);

  timelineZoom = signal<number>(1);
  @ViewChild('timelineScrollContainer') timelineScrollContainer!: ElementRef<HTMLDivElement>;

  currentTime = signal<number>(0);
  isPlaying = signal<boolean>(false);
  activeDrag = signal<'start' | 'end' | 'playhead' | null>(null);

  waveform = signal<number[]>([]);
  isExtractingWaveform = signal<boolean>(false);

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
        percent: (i / duration) * 100
      });
    }
    return ticks;
  });

  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;
  @ViewChild('timelineContainer') timelineContainer!: ElementRef<HTMLDivElement>;
  
  private ctx: CanvasRenderingContext2D | null = null;
  private isPointerDown = false;
  private lastPos = {x: 0, y: 0};
  private startPos = {x: 0, y: 0};
  private savedImageData: ImageData | null = null;

  draggedTrackIndex: number | null = null;
  dragOverTrackIndex: number | null = null;

  onDragStart(index: number) {
    this.draggedTrackIndex = index;
  }

  onDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    this.dragOverTrackIndex = index;
  }

  onDrop(event: DragEvent, index: number) {
    event.preventDefault();
    if (this.draggedTrackIndex !== null && this.draggedTrackIndex !== index) {
      this.audioTracks.update(tracks => {
        const newTracks = [...tracks];
        const [movedTrack] = newTracks.splice(this.draggedTrackIndex!, 1);
        newTracks.splice(index, 0, movedTrack);
        return newTracks;
      });
      this.syncBackgroundAudio();
    }
    this.draggedTrackIndex = null;
    this.dragOverTrackIndex = null;
  }

  onDragEnd() {
    this.draggedTrackIndex = null;
    this.dragOverTrackIndex = null;
  }

  constructor() {
    afterNextRender(() => {
      this.initializeEngine();
    });
  }

  initializeEngine() {
    this.isLoaded.set(true);
    this.logs.update(l => [
      ...l,
      this.translations().msgInitSuccess,
      this.translations().msgFeatures
    ]);
  }

  onVideoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.errorMessage.set(null);
      
      const maxSize = 300 * 1024 * 1024; // 300MB
      if (file.size > maxSize) {
        this.errorMessage.set(this.translations().errMaxSize(300, (file.size / (1024 * 1024)).toFixed(1)));
        (event.target as HTMLInputElement).value = '';
        return;
      }

      this.videoFile.set(file);
      if (this.videoUrl()) {
        URL.revokeObjectURL(this.videoUrl()!);
      }
      this.videoUrl.set(URL.createObjectURL(file));
      this.clearCanvas();
      this.outputUrl.set(null);
      this.trimStart.set(0);
      this.extractAudioWaveform(file);
    }
  }

  async onAudioSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      input.value = ''; // Reset input
      this.isExtractingBgWaveform.set(true);

      const newTracks: {id: string, file: File, url: string, duration: number, waveform: number[], volume: number}[] = [];
      for (const file of files) {
        const url = URL.createObjectURL(file);
        const duration = await new Promise<number>((resolve) => {
          const a = document.createElement('audio');
          a.onloadedmetadata = () => resolve(a.duration);
          a.src = url;
        });
        
        let waveform: number[] = [];
        try {
          const bars = Math.max(30, Math.floor((duration / 60) * 100));
          waveform = await this.waveformProcessor.extractWaveform(file, Math.min(200, bars));
        } catch(e) {
          console.warn('Could not extract waveform', e);
        }
        
        newTracks.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          url,
          duration,
          waveform,
          volume: 20
        });
      }
      
      this.audioTracks.update(tracks => [...tracks, ...newTracks]);
      this.isExtractingBgWaveform.set(false);
      
      // Attempt to play if currently playing
      this.syncBackgroundAudio();
    }
  }

  removeAudioTrack(id: string) {
    this.audioTracks.update(tracks => {
      const track = tracks.find(t => t.id === id);
      if (track) URL.revokeObjectURL(track.url);
      return tracks.filter(t => t.id !== id);
    });
    this.syncBackgroundAudio();
  }

  setTrackVolume(id: string, volume: number) {
    this.audioTracks.update(tracks => tracks.map(t => t.id === id ? { ...t, volume } : t));
    this.syncBackgroundAudio();
  }

  setVideoVolume(val: number) {
    this.volume.set(val);
    if (this.videoEl && this.videoEl.nativeElement) {
      this.videoEl.nativeElement.volume = Math.max(0, Math.min(1.0, val / 100));
    }
  }
  
  onLogoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.logoFile.set(file);
      if (this.logoPreviewUrl()) {
        URL.revokeObjectURL(this.logoPreviewUrl()!);
      }
      this.logoPreviewUrl.set(URL.createObjectURL(file));
    }
  }

  removeWatermark() {
    this.logoFile.set(null);
    if (this.logoPreviewUrl()) {
      URL.revokeObjectURL(this.logoPreviewUrl()!);
      this.logoPreviewUrl.set(null);
    }
  }

  updateTrimStart(val: number) {
    this.trimStart.set(val);
    this.checkFormatLimits();
  }

  updateTrimEnd(val: number) {
    this.trimEnd.set(val);
    this.checkFormatLimits();
  }

  checkFormatLimits() {
    if (this.isGifDisabled() && this.outputFormat() === 'gif') {
      this.outputFormat.set('mp4');
    }
  }

  formatTime(seconds: number): string {
    return TimeFormatter.formatTime(seconds);
  }

  formatTimeShort(seconds: number): string {
    return TimeFormatter.formatTimeShort(seconds);
  }

  togglePlay() {
    if (!this.videoEl) return;
    const video = this.videoEl.nativeElement;
    if (video.paused) {
      if (video.currentTime >= this.trimEnd()) {
        video.currentTime = this.trimStart();
      }
      video.play().then(() => {
        this.isPlaying.set(true);
        this.syncBackgroundAudio();
      }).catch(err => console.error(err));
    } else {
      video.pause();
      this.isPlaying.set(false);
      this.syncBackgroundAudio();
    }
  }

  seekTo(seconds: number) {
    if (!this.videoEl) return;
    const video = this.videoEl.nativeElement;
    const target = Math.max(0, Math.min(this.videoDuration(), seconds));
    video.currentTime = target;
    this.currentTime.set(target);
    this.syncBackgroundAudio();
    this.redrawCanvas();
  }

  cutStartAtCurrentTime() {
    const current = this.currentTime();
    if (current < this.trimEnd()) {
      this.updateTrimStart(current);
      this.seekTo(current);
    }
  }

  cutEndAtCurrentTime() {
    const current = this.currentTime();
    if (current > this.trimStart()) {
      this.updateTrimEnd(current);
      this.seekTo(current);
    }
  }

  onTimeUpdate() {
    if (this.videoEl) {
      const video = this.videoEl.nativeElement;
      this.currentTime.set(video.currentTime);
      this.isPlaying.set(!video.paused);
      this.redrawCanvas();
      
      this.autoScrollTimeline(video.currentTime);
      
      // Auto pause at trim boundary
      if (video.currentTime >= this.trimEnd()) {
        video.pause();
        this.isPlaying.set(false);
      }
      this.syncBackgroundAudio();
    }
  }

  syncBackgroundAudio() {
    if (this.audioTracks().length === 0) {
      if (this.previewAudio) {
        this.previewAudio.pause();
      }
      return;
    }
    
    // Find which track corresponds to the current video time relative to trimStart
    if (!this.videoEl) return;
    const videoCurrentTime = this.videoEl.nativeElement.currentTime;
    const relativeTime = Math.max(0, videoCurrentTime - this.trimStart());
    
    let accumulatedTime = 0;
    let targetTrack = null;
    let trackLocalTime = 0;
    
    for (const track of this.audioTracks()) {
      if (relativeTime >= accumulatedTime && relativeTime < accumulatedTime + track.duration) {
        targetTrack = track;
        trackLocalTime = relativeTime - accumulatedTime;
        break;
      }
      accumulatedTime += track.duration;
    }

    if (!targetTrack) {
        if (this.previewAudio) {
           this.previewAudio.pause();
        }
        return;
    }

    if (!this.previewAudio) {
      this.previewAudio = new Audio();
    }

    this.previewAudio.volume = targetTrack.volume / 100;
    
    if (this.previewAudio.src !== targetTrack.url) {
      const wasPlaying = !this.previewAudio.paused;
      this.previewAudio.src = targetTrack.url;
      this.previewAudio.currentTime = trackLocalTime;
      if (wasPlaying || (!this.videoEl.nativeElement.paused && videoCurrentTime < this.trimEnd())) {
         this.previewAudio.play().catch(e => console.warn(e));
      }
    } else {
      if (Math.abs(this.previewAudio.currentTime - trackLocalTime) > 0.15) {
        this.previewAudio.currentTime = trackLocalTime;
      }
      if ((this.videoEl.nativeElement.paused || videoCurrentTime >= this.trimEnd()) && !this.previewAudio.paused) {
        this.previewAudio.pause();
      } else if (!this.videoEl.nativeElement.paused && videoCurrentTime < this.trimEnd() && this.previewAudio.paused) {
        this.previewAudio.play().catch(e => console.warn(e));
      }
    }
  }

  autoScrollTimeline(currentTime: number) {
    if (!this.timelineScrollContainer || !this.timelineContainer || this.videoDuration() === 0) return;
    
    // We only auto-scroll if it's playing and not currently dragging
    if (!this.isPlaying() || this.activeDrag()) return;

    const scrollEl = this.timelineScrollContainer.nativeElement;
    const trackEl = this.timelineContainer.nativeElement;

    const percentage = currentTime / this.videoDuration();
    const playheadPx = percentage * trackEl.getBoundingClientRect().width;
    
    // Viewport width of the scroll container
    const viewWidth = scrollEl.clientWidth;
    const currentScroll = scrollEl.scrollLeft;

    // Follow playhead (keep it within bounds, e.g., if it gets too close to the right edge)
    const paddingRight = 100; // start scrolling when playhead is 100px from right edge
    const paddingLeft = 50;

    if (playheadPx > currentScroll + viewWidth - paddingRight) {
      // scroll right
      scrollEl.scrollLeft = playheadPx - viewWidth + paddingRight;
    } else if (playheadPx < currentScroll + paddingLeft) {
      // scroll left
      scrollEl.scrollLeft = Math.max(0, playheadPx - paddingLeft);
    }
  }

  onTimelineMouseDown(event: MouseEvent, target: 'start' | 'end' | 'playhead' | 'track') {
    event.preventDefault();
    event.stopPropagation();
    
    if (target === 'track') {
      this.activeDrag.set('playhead');
      this.handleTimelineDrag(event);
    } else {
      this.activeDrag.set(target);
    }
  }

  onTimelineTouchStart(event: TouchEvent, target: 'start' | 'end' | 'playhead' | 'track') {
    event.stopPropagation();
    
    if (target === 'track') {
      this.activeDrag.set('playhead');
      this.handleTimelineDrag(event);
    } else {
      this.activeDrag.set(target);
    }
  }

  onGlobalMove(event: MouseEvent | TouchEvent) {
    if (!this.activeDrag()) return;
    this.handleTimelineDrag(event);
  }

  onGlobalUp() {
    this.activeDrag.set(null);
  }

  handleTimelineDrag(event: MouseEvent | TouchEvent) {
    if (!this.timelineContainer || !this.videoDuration()) return;
    
    const rect = this.timelineContainer.nativeElement.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : (event as MouseEvent).clientX;
    const relativeX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, relativeX / rect.width));
    const targetTime = percentage * this.videoDuration();
    
    const dragType = this.activeDrag();
    if (dragType === 'start') {
      const newStart = Math.min(targetTime, this.trimEnd() - 0.1);
      this.updateTrimStart(Math.max(0, newStart));
      this.seekTo(this.trimStart());
    } else if (dragType === 'end') {
      const newEnd = Math.max(targetTime, this.trimStart() + 0.1);
      this.updateTrimEnd(Math.min(this.videoDuration(), newEnd));
      this.seekTo(this.trimEnd());
    } else if (dragType === 'playhead') {
      this.seekTo(targetTime);
    }
  }

  onVideoLoadedMetadata(event: Event) {
    const video = event.target as HTMLVideoElement;
    
    const maxDuration = 30 * 60; // 30 minutes in seconds
    if (video.duration > maxDuration) {
      this.errorMessage.set(this.translations().errMaxDuration(30, (video.duration / 60).toFixed(1)));
      
      if (this.videoUrl()) {
        URL.revokeObjectURL(this.videoUrl()!);
      }
      this.videoFile.set(null);
      this.videoUrl.set(null);
      this.clearCanvas();
      this.outputUrl.set(null);
      return;
    }

    this.videoDuration.set(video.duration);
    this.videoWidth.set(video.videoWidth);
    this.videoHeight.set(video.videoHeight);
    this.trimEnd.set(video.duration);
    this.checkFormatLimits();
    
    video.volume = Math.max(0, Math.min(1.0, this.volume() / 100));
    
    if (this.canvasEl) {
      this.canvasEl.nativeElement.width = video.videoWidth;
      this.canvasEl.nativeElement.height = video.videoHeight;
      this.ctx = this.canvasEl.nativeElement.getContext('2d', { willReadFrequently: true });
    }
  }

  // --- Canvas Drawing Logic ---
  
  getMousePos(e: MouseEvent | TouchEvent) {
    return this.canvasDrawer.getMousePos(this.canvasEl.nativeElement, e);
  }

  redrawCanvas() {
    if (!this.ctx || !this.canvasEl) return;
    const canvas = this.canvasEl.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawStrokesOnContext(
      this.ctx,
      this.strokes(),
      this.currentTime(),
      canvas.width,
      canvas.height,
      this.videoWidth(),
      this.videoHeight()
    );
  }

  onPointerDown(e: MouseEvent | TouchEvent) {
    if (this.currentTool() === 'pointer' || !this.ctx) return;
    this.isPointerDown = true;
    const pos = this.getMousePos(e);
    this.startPos = pos;
    this.lastPos = pos;
    
    // Create new active stroke
    const strokeId = 'stroke_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    this.activeStroke = {
      id: strokeId,
      type: this.currentTool() as 'pen' | 'arrow',
      points: [pos],
      startPos: pos,
      endPos: pos,
      color: this.color(),
      lineWidth: Math.max(5, this.videoWidth() * 0.005),
      startTime: this.currentTime(),
      duration: 3.0 // default 3s as requested
    };
    
    // Auto select this keyframe
    this.activeStrokeId.set(strokeId);
  }

  onPointerMove(e: MouseEvent | TouchEvent) {
    if (!this.isPointerDown || !this.ctx || this.currentTool() === 'pointer' || !this.activeStroke) return;
    
    const pos = this.getMousePos(e);
    
    if (this.activeStroke.type === 'pen') {
      this.activeStroke.points.push(pos);
    } else if (this.activeStroke.type === 'arrow') {
      this.activeStroke.endPos = pos;
    }
    
    // Live composition render inside drawing phase:
    // 1. Draw already completed strokes
    this.redrawCanvas();
    
    // 2. Overlay current active live stroke
    const canvas = this.canvasEl.nativeElement;
    drawStrokesOnContext(
      this.ctx,
      [this.activeStroke],
      this.currentTime(),
      canvas.width,
      canvas.height,
      this.videoWidth(),
      this.videoHeight()
    );
  }

  onPointerUp() {
    if (this.isPointerDown && this.activeStroke) {
      this.strokes.update(s => [...s, this.activeStroke!]);
      this.activeStroke = null;
      this.redrawCanvas();
    }
    this.isPointerDown = false;
  }
  
  clearCanvas() {
    this.strokes.set([]);
    this.activeStrokeId.set(null);
    if (this.ctx && this.canvasEl) {
      this.ctx.clearRect(0, 0, this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
    }
  }

  deleteStroke(id: string) {
    this.strokes.update(all => all.filter(s => s.id !== id));
    if (this.activeStrokeId() === id) {
      this.activeStrokeId.set(null);
    }
    this.redrawCanvas();
  }

  updateStrokeStartTime(id: string, newTime: number) {
    const validTime = Math.max(0, Math.min(this.videoDuration(), Number(newTime)));
    this.strokes.update(all => all.map(s => s.id === id ? { ...s, startTime: validTime } : s));
    this.redrawCanvas();
  }

  updateStrokeDuration(id: string, newDuration: number) {
    const validDur = Math.max(0.1, Number(newDuration));
    this.strokes.update(all => all.map(s => s.id === id ? { ...s, duration: validDur } : s));
    this.redrawCanvas();
  }

  // --- Rendering logic ---

  async exportVideo() {
    if (!this.isLoaded() || !this.videoFile() || !this.videoUrl()) return;
    this.isProcessing.set(true);
    this.progress.set(0);
    this.logs.set([]);

    const config = {
      videoUrl: this.videoUrl()!,
      videoWidth: this.videoWidth(),
      videoHeight: this.videoHeight(),
      videoDuration: this.videoDuration(),
      trimStart: this.trimStart(),
      trimEnd: this.trimEnd(),
      volume: this.volume(),
      outputFormat: this.outputFormat(),
      videoFile: this.videoFile(),
      audioBitrate: this.audioBitrate(),
      videoBitrate: this.videoBitrate(),
      audioTracks: this.audioTracks(),
      logoFile: this.logoFile(),
      logoPosition: this.logoPosition(),
      logoOpacity: this.logoOpacity(),
      logoSize: this.logoSize(),
      canvasElement: this.canvasEl.nativeElement,
      strokes: this.strokes(),
      translations: this.translations(),
      onProgress: (pct: number) => this.progress.set(pct),
      onLog: (msg: string) => this.logs.update(l => [...l, msg]),
      onSuccess: (url: string) => {
        if (this.outputUrl()) {
          URL.revokeObjectURL(this.outputUrl()!);
        }
        this.outputUrl.set(url);
        this.isProcessing.set(false);

        // Auto-download trigger
        try {
          const originalName = this.videoFile()?.name || 'video';
          const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
          const extension = this.outputFormat();
          const downloadName = `${baseName}_ichigo.${extension}`;

          const a = document.createElement('a');
          a.href = url;
          a.download = downloadName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          this.logs.update(l => [...l, `[Downloader] Download triggered automatically: ${downloadName}`]);
        } catch (downloadErr) {
          console.error('Trigger download failed', downloadErr);
          this.logs.update(l => [...l, `[Downloader] Error during auto-download: ${downloadErr}`]);
        }
      },
      onError: (err: unknown) => {
        console.error(err);
        this.logs.update(l => [...l, `Rendering Pipeline Error: ${err}`]);
        this.isProcessing.set(false);
      }
    };

    if (this.outputFormat() === 'gif') {
      await this.exportProcessor.exportGif(config);
    } else {
      await this.exportProcessor.exportVideo(config);
    }
  }

  getExtension(filename: string) {
    return filename.substring(filename.lastIndexOf('.')) || '';
  }
  
  downloadCanvas() {
    this.canvasEl.nativeElement.toBlob((blob) => {
      if(!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'annotation.png';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  extractAudioWaveform(file: File) {
    this.isExtractingWaveform.set(true);
    this.waveform.set([]);
    
    this.waveformProcessor.extractWaveform(file, 120)
      .then((amps) => {
        this.waveform.set(amps);
        this.isExtractingWaveform.set(false);
      })
      .catch((err) => {
        console.warn('Waveform extraction failed, falling back:', err);
        this.generatePlaceholderWaveform();
      });
  }

  generatePlaceholderWaveform() {
    this.waveform.set(this.waveformProcessor.generatePlaceholder(120, false));
    this.isExtractingWaveform.set(false);
  }

  isBarSelected(index: number): boolean {
    const duration = this.videoDuration();
    if (duration <= 0) return false;
    const barTime = (index / 120) * duration;
    return barTime >= this.trimStart() && barTime <= this.trimEnd();
  }

}
