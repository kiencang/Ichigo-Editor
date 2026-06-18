import {ChangeDetectionStrategy, Component, signal, computed, ViewChild, ElementRef, afterNextRender, inject} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DecimalPipe } from '@angular/common';
import { getTranslations } from './translations';
import { TimeFormatter } from './time-formatter';
import { WaveformProcessor } from './waveform-processor';
import { CanvasDrawer } from './canvas-drawer';
import { ExportProcessor } from './export-processor';
import { VIDEO_FILTERS, AppliedFilter, getAppliedFiltersCSSAtTime } from './filters.types';
import { VideoSegment } from './segments';
import { ZoomRegion, getZoomAtTime } from './zoom.types';
import { BackgroundAudio } from './background-audio';
import { BackgroundAudioPanel } from './background-audio-panel';
import { VideoSegments } from './video-segments';
import { VideoFilters } from './video-filters';
import { ExportPanel } from './export-panel';
import { WatermarkPanel } from './watermark-panel';
import { StrokePropertiesPanel } from './stroke-properties-panel';
import { AppHeader } from './header';
import { AppFooter } from './footer';
import { UploadPanel } from './upload-panel';
import { AppStrokesList } from './strokes-list';
import { AppAppliedFiltersList } from './applied-filters-list';
import { AppZoomRegionsList } from './zoom-regions-list';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [FormsModule, MatIconModule, DecimalPipe, VideoFilters, ExportPanel, WatermarkPanel, StrokePropertiesPanel, AppHeader, AppFooter, UploadPanel, AppStrokesList, AppAppliedFiltersList, AppZoomRegionsList, BackgroundAudioPanel],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private waveformProcessor = inject(WaveformProcessor);
  private canvasDrawer = inject(CanvasDrawer);
  private exportProcessor = inject(ExportProcessor);
  readonly backgroundAudio = inject(BackgroundAudio);
  readonly videoSegmentsService = inject(VideoSegments);

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
  videoDuration = this.videoSegmentsService.videoDuration;
  videoWidth = signal(0);
  videoHeight = signal(0);
  
  videoSegments = this.videoSegmentsService.videoSegments;
  selectedSegmentId = this.videoSegmentsService.selectedSegmentId;
  segmentHistoryList = this.videoSegmentsService.segmentHistoryList;

  trimStart = this.videoSegmentsService.trimStart;
  trimEnd = this.videoSegmentsService.trimEnd;
  selectedSegmentStart = this.videoSegmentsService.selectedSegmentStart;
  selectedSegmentEnd = this.videoSegmentsService.selectedSegmentEnd;
  trimmedDuration = this.videoSegmentsService.trimmedDuration;
  selectedSegmentIndex = this.videoSegmentsService.selectedSegmentIndex;
  canUndo = this.videoSegmentsService.canUndo;
  isGifDisabled = this.videoSegmentsService.isGifDisabled;
  volume = signal<number>(100);
  outputFormat = signal<string>('webm');
  audioBitrate = signal<number>(192000);
  videoBitrate = signal<number>(0); // 0 = Auto, other values are explicit bps: 2000000, 4000000, 8000000
  
  videoFiltersList = VIDEO_FILTERS;
  appliedFilters = signal<AppliedFilter[]>([]);
  activeFilterId = signal<string | null>(null);

  currentActiveFilter = computed(() => {
    return this.appliedFilters().find(f => f.id === this.activeFilterId()) || null;
  });

  getVideoFilterStyle() {
    return getAppliedFiltersCSSAtTime(this.appliedFilters(), this.currentTime());
  }

  addAppliedFilter(presetId: string) {
    if (!this.videoUrl()) return;
    const current = this.currentTime();
    const videoDur = this.videoDuration();
    if (videoDur <= 0) return;
    const dur = Math.min(3, Math.max(0.1, videoDur - current));
    if (dur <= 0) return;

    const newFilter: AppliedFilter = {
      id: 'filter_' + Math.random().toString(36).substring(2, 11),
      presetId: presetId,
      startTime: current,
      duration: dur,
      intensity: 100
    };

    this.appliedFilters.update(filters => [...filters, newFilter]);
    this.activeFilterId.set(newFilter.id);
    this.logs.update(l => [
      ...l,
      this.lang() === 'vi' 
        ? `[Bộ lọc] Đã thêm bộ lọc ${presetId} tại ${current.toFixed(2)}s hiển thị trong ${dur.toFixed(1)}s` 
        : `[Filter] Added ${presetId} filter at ${current.toFixed(2)}s for ${dur.toFixed(1)}s`
    ]);
  }

  deleteAppliedFilter(id: string) {
    this.appliedFilters.update(all => all.filter(f => f.id !== id));
    if (this.activeFilterId() === id) {
      this.activeFilterId.set(null);
    }
  }

  updateFilterStartTime(id: string, newTime: number) {
    const validTime = Math.max(0, Math.min(this.videoDuration(), Number(newTime)));
    this.appliedFilters.update(all => all.map(f => f.id === id ? { ...f, startTime: validTime } : f));
  }

  updateFilterDuration(id: string, newDuration: number) {
    const validDur = Math.max(0.1, Math.min(this.videoDuration(), Number(newDuration)));
    this.appliedFilters.update(all => all.map(f => f.id === id ? { ...f, duration: validDur } : f));
  }

  updateFilterIntensity(id: string, intensity: number) {
    const validIntensity = Math.max(10, Math.min(100, Number(intensity)));
    this.appliedFilters.update(all => all.map(f => f.id === id ? { ...f, intensity: validIntensity } : f));
  }

  getFilterPresetName(presetId: string): string {
    const preset = this.videoFiltersList.find(f => f.id === presetId);
    if (!preset) return presetId;
    return this.lang() === 'vi' ? preset.nameVi : preset.nameEn;
  }

  getStrokeTypeName(type: string): string {
    const isVi = this.lang() === 'vi';
    switch (type) {
      case 'pen': return isVi ? 'Nét vẽ tự do' : 'Freehand Draw';
      case 'arrow': return isVi ? 'Mũi tên chỉ hướng' : 'Directional Arrow';
      case 'rect': return isVi ? 'Hình chữ nhật' : 'Rectangle';
      case 'circle': return isVi ? 'Hình tròn' : 'Circle';
      case 'line': return isVi ? 'Đường thẳng' : 'Straight Line';
      default: return type;
    }
  }

  zoomRegions = signal<ZoomRegion[]>([]);
  activeZoomId = signal<string | null>(null);

  currentActiveZoom = computed(() => {
    return this.zoomRegions().find(z => z.id === this.activeZoomId()) || null;
  });

  currentZoomState = computed(() => {
    return getZoomAtTime(this.zoomRegions(), this.currentTime());
  });

  getZoomTransformStyle() {
    const state = this.currentZoomState();
    return `scale(${state.scale})`;
  }

  getZoomOriginStyle() {
    const state = this.currentZoomState();
    return `${state.panX}% ${state.panY}%`;
  }

  addZoomRegion() {
    if (!this.videoUrl()) return;
    const current = this.currentTime();
    const videoDur = this.videoDuration();
    if (videoDur <= 0) return;
    const dur = Math.min(3, Math.max(0.1, videoDur - current));
    if (dur <= 0) return;

    const newZoom: ZoomRegion = {
      id: 'zoom_' + Math.random().toString(36).substring(2, 11),
      startTime: current,
      duration: dur,
      scale: 2.0,
      panX: 0,
      panY: 0
    };

    this.zoomRegions.update(zooms => [...zooms, newZoom]);
    this.activeZoomId.set(newZoom.id);
    this.logs.update(l => [
      ...l,
      this.lang() === 'vi' 
        ? `[Thu phóng] Đã thêm vùng thu phóng 2.0x tại ${current.toFixed(2)}s hiển thị trong ${dur.toFixed(1)}s` 
        : `[Zoom & Pan] Added 2.0x zoom region at ${current.toFixed(2)}s for ${dur.toFixed(1)}s`
    ]);
  }

  deleteZoomRegion(id: string) {
    this.zoomRegions.update(all => all.filter(z => z.id !== id));
    if (this.activeZoomId() === id) {
      this.activeZoomId.set(null);
    }
  }

  updateZoomStartTime(id: string, newTime: number) {
    const validTime = Math.max(0, Math.min(this.videoDuration(), Number(newTime)));
    this.zoomRegions.update(all => all.map(z => z.id === id ? { ...z, startTime: validTime } : z));
  }

  updateZoomDuration(id: string, newDuration: number) {
    const validDur = Math.max(0.1, Math.min(this.videoDuration(), Number(newDuration)));
    this.zoomRegions.update(all => all.map(z => z.id === id ? { ...z, duration: validDur } : z));
  }

  updateZoomScale(id: string, newScale: number) {
    const validScale = Math.max(1.0, Math.min(4.0, Number(newScale)));
    this.zoomRegions.update(all => all.map(z => z.id === id ? { ...z, scale: validScale } : z));
  }

  updateZoomPanX(id: string, newPanX: number) {
    const validX = Math.max(0, Math.min(100, Number(newPanX)));
    this.zoomRegions.update(all => all.map(z => z.id === id ? { ...z, panX: validX } : z));
  }

  updateZoomPanY(id: string, newPanY: number) {
    const validY = Math.max(0, Math.min(100, Number(newPanY)));
    this.zoomRegions.update(all => all.map(z => z.id === id ? { ...z, panY: validY } : z));
  }

  getZoomQuadrantIcon(panX: number, panY: number): string {
    if (panX === 25 && panY === 25) return 'north_west';
    if (panX === 75 && panY === 25) return 'north_east';
    if (panX === 25 && panY === 75) return 'south_west';
    if (panX === 75 && panY === 75) return 'south_east';
    return 'zoom_in';
  }

  getZoomQuadrantLabelShort(panX: number, panY: number): string {
    const isVi = this.lang() === 'vi';
    if (panX === 25 && panY === 25) return isVi ? 'Trên - Trái' : 'Top Left';
    if (panX === 75 && panY === 25) return isVi ? 'Trên - Phải' : 'Top Right';
    if (panX === 25 && panY === 75) return isVi ? 'Dưới - Trái' : 'Btm Left';
    if (panX === 75 && panY === 75) return isVi ? 'Dưới - Phải' : 'Btm Right';
    return isVi ? 'Trung tâm' : 'Center';
  }
  
  audioTracks = this.backgroundAudio.audioTracks;
  isExtractingBgWaveform = this.backgroundAudio.isExtractingBgWaveform;
  logoFile = signal<File | null>(null);
  logoPreviewUrl = signal<string | null>(null);
  logoPosition = signal<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-right');
  logoOpacity = signal<number>(50);
  logoSize = signal<number>(15);
  playingTrackId = this.backgroundAudio.playingTrackId;
  isolatedPreviewTime = this.backgroundAudio.isolatedPreviewTime;
  
  currentTool = this.canvasDrawer.currentTool;
  color = this.canvasDrawer.color;
  strokes = this.canvasDrawer.strokes;
  activeStrokeId = this.canvasDrawer.activeStrokeId;
  currentActiveStroke = this.canvasDrawer.currentActiveStroke;
  
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
  private savedImageData: ImageData | null = null;

  reorderAudioTracks(event: { draggedIndex: number; targetIndex: number }) {
    this.audioTracks.update(tracks => {
      const newTracks = [...tracks];
      const [movedTrack] = newTracks.splice(event.draggedIndex, 1);
      newTracks.splice(event.targetIndex, 0, movedTrack);
      return newTracks;
    });
    this.syncBackgroundAudio();
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
      this.extractAudioWaveform(file);
    }
  }

  async onAudioSelected(event: Event) {
    await this.backgroundAudio.onAudioSelected(event, () => this.syncBackgroundAudio());
  }

  removeAudioTrack(id: string) {
    this.backgroundAudio.removeAudioTrack(id, () => this.syncBackgroundAudio());
  }

  setTrackVolume(id: string, volume: number) {
    this.backgroundAudio.setTrackVolume(id, volume, () => this.syncBackgroundAudio());
  }

  setTrackTrimStart(id: string, start: number) {
    this.backgroundAudio.setTrackTrimStart(id, start, () => this.syncBackgroundAudio());
  }

  setTrackTrimEnd(id: string, end: number) {
    this.backgroundAudio.setTrackTrimEnd(id, end, () => this.syncBackgroundAudio());
  }

  previewSpecificTrack(id: string) {
    this.backgroundAudio.previewSpecificTrack(id, this.isPlaying(), () => this.togglePlay());
  }

  stopIsolatedPreview() {
    this.backgroundAudio.stopIsolatedPreview();
  }

  setVideoVolume(val: number) {
    this.volume.set(val);
    if (this.videoEl && this.videoEl.nativeElement) {
      this.videoEl.nativeElement.volume = Math.max(0, Math.min(1.0, val / 100));
    }
  }
  
  saveSegmentState() {
    this.videoSegmentsService.saveSegmentState();
  }

  undoSegments() {
    this.videoSegmentsService.undoSegments(() => this.checkFormatLimits());
  }

  splitSegmentAtPlayhead() {
    this.videoSegmentsService.splitSegmentAtPlayhead(this.currentTime(), () => this.checkFormatLimits());
  }

  deleteSegment(id: string) {
    this.videoSegmentsService.deleteSegment(id, () => this.checkFormatLimits());
  }

  updateSegmentStart(id: string, val: number) {
    this.videoSegmentsService.updateSegmentStart(id, val, () => this.checkFormatLimits());
  }

  updateSegmentEnd(id: string, val: number) {
    this.videoSegmentsService.updateSegmentEnd(id, val, () => this.checkFormatLimits());
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
    this.stopIsolatedPreview();
    if (!this.videoEl) return;
    const video = this.videoEl.nativeElement;
    if (video.paused) {
      const segments = this.videoSegments();
      if (segments.length > 0) {
        const lastSeg = segments[segments.length - 1];
        if (video.currentTime >= lastSeg.end - 0.1) {
          video.currentTime = segments[0].start;
        }
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

  seekTo(seconds: number, segmentId?: string) {
    this.stopIsolatedPreview();
    if (!this.videoEl) return;
    const video = this.videoEl.nativeElement;
    const target = Math.max(0, Math.min(this.videoDuration(), seconds));
    
    const wasPlaying = this.isPlaying() || !video.paused;
    
    video.currentTime = target;
    this.currentTime.set(target);
    this.syncBackgroundAudio();
    this.redrawCanvas();
    
    if (segmentId) {
      this.selectedSegmentId.set(segmentId);
    } else {
      // Auto select segment containing target seek time
      const targetSeg = this.videoSegments().find(s => target >= s.start && target <= s.end);
      if (targetSeg) {
        this.selectedSegmentId.set(targetSeg.id);
      }
    }

    if (wasPlaying) {
      video.play().then(() => {
        this.isPlaying.set(true);
        this.syncBackgroundAudio();
      }).catch(err => {
        console.warn('Playback resume failed:', err);
      });
    }
  }

  cutStartAtCurrentTime() {
    const current = this.currentTime();
    const id = this.selectedSegmentId();
    if (id) {
       this.updateSegmentStart(id, current);
       this.seekTo(current);
    }
  }

  cutEndAtCurrentTime() {
    const current = this.currentTime();
    const id = this.selectedSegmentId();
    if (id) {
       this.updateSegmentEnd(id, current);
       this.seekTo(current);
    }
  }

  onTimeUpdate() {
    if (this.videoEl) {
      const video = this.videoEl.nativeElement;
      if (video.seeking) {
        return;
      }
      const currentOriginal = video.currentTime;
      
      const segments = this.videoSegments();
      if (segments.length === 0) return;
      
      this.isPlaying.set(!video.paused);
      this.redrawCanvas();
      
      // Find current or nearest segment
      const currentSegIndex = segments.findIndex(s => currentOriginal >= s.start && currentOriginal <= s.end);
      
      if (currentSegIndex === -1) {
        const nextSeg = segments.find(s => s.start > currentOriginal);
        if (nextSeg) {
          video.currentTime = nextSeg.start;
          this.currentTime.set(nextSeg.start);
          this.selectedSegmentId.set(nextSeg.id);
          this.syncBackgroundAudio();
          return;
        } else {
          video.pause();
          this.isPlaying.set(false);
          const lastSeg = segments[segments.length - 1];
          video.currentTime = lastSeg.end;
          this.currentTime.set(lastSeg.end);
          this.selectedSegmentId.set(lastSeg.id);
          this.syncBackgroundAudio();
          return;
        }
      }
      
      const currentSeg = segments[currentSegIndex];
      
      // Auto transition to start of next segment if we hit the end of the current segment
      if (currentOriginal >= currentSeg.end - 0.05) {
        if (currentSegIndex + 1 < segments.length) {
          const nextSeg = segments[currentSegIndex + 1];
          video.currentTime = nextSeg.start;
          this.currentTime.set(nextSeg.start);
          this.selectedSegmentId.set(nextSeg.id);
          this.syncBackgroundAudio();
          return;
        } else {
          video.pause();
          this.isPlaying.set(false);
          video.currentTime = currentSeg.end;
          this.currentTime.set(currentSeg.end);
          this.selectedSegmentId.set(currentSeg.id);
          this.syncBackgroundAudio();
          return;
        }
      }
      
      this.currentTime.set(currentOriginal);
      this.selectedSegmentId.set(currentSeg.id);
      this.autoScrollTimeline(currentOriginal);
      this.syncBackgroundAudio();
    }
  }

  syncBackgroundAudio() {
    this.backgroundAudio.syncBackgroundAudio(
      this.videoEl?.nativeElement,
      this.trimStart(),
      this.trimEnd()
    );
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

  onSegmentMouseDown(event: MouseEvent, seg: VideoSegment) {
    event.stopPropagation();
    event.preventDefault();
    this.selectedSegmentId.set(seg.id);
    this.activeDrag.set('playhead');
    this.handleTimelineDrag(event);
  }

  onSegmentTouchStart(event: TouchEvent, seg: VideoSegment) {
    event.stopPropagation();
    this.selectedSegmentId.set(seg.id);
    this.activeDrag.set('playhead');
    this.handleTimelineDrag(event);
  }

  onSegmentDoubleClick(event: MouseEvent, seg: VideoSegment) {
    event.stopPropagation();
    event.preventDefault();
    this.seekTo(seg.start, seg.id);
  }

  onTrackDoubleClick(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    this.seekTo(0);
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
    if (dragType === 'start' || dragType === 'end') {
      const selId = this.selectedSegmentId();
      const segments = this.videoSegments();
      const activeSeg = segments.find(s => s.id === selId) || segments[0];
      if (!activeSeg) return;
      
      if (dragType === 'start') {
        this.updateSegmentStart(activeSeg.id, targetTime);
        const updatedSeg = this.videoSegments().find(s => s.id === activeSeg.id);
        if (updatedSeg) {
          this.seekTo(updatedSeg.start);
        }
      } else {
        this.updateSegmentEnd(activeSeg.id, targetTime);
        const updatedSeg = this.videoSegments().find(s => s.id === activeSeg.id);
        if (updatedSeg) {
          this.seekTo(updatedSeg.end);
        }
      }
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

    this.videoWidth.set(video.videoWidth);
    this.videoHeight.set(video.videoHeight);
    
    // Initialize starting segment covering full video using our service
    this.videoSegmentsService.resetSegments(video.duration);

    this.checkFormatLimits();
    
    video.volume = Math.max(0, Math.min(1.0, this.volume() / 100));
    
    if (this.canvasEl) {
      this.canvasEl.nativeElement.width = video.videoWidth;
      this.canvasEl.nativeElement.height = video.videoHeight;
      this.ctx = this.canvasEl.nativeElement.getContext('2d', { willReadFrequently: true });
      if (this.ctx) {
        this.canvasDrawer.init(this.canvasEl.nativeElement, this.ctx);
      }
    }
  }

  // --- Canvas Drawing Logic ---
  
  getMousePos(e: MouseEvent | TouchEvent) {
    return this.canvasDrawer.getMousePos(this.canvasEl.nativeElement, e);
  }

  redrawCanvas() {
    this.canvasDrawer.redrawCanvas(this.videoWidth(), this.videoHeight(), this.currentTime());
  }

  onPointerDown(e: MouseEvent | TouchEvent) {
    this.canvasDrawer.onPointerDown(e, this.videoWidth(), this.currentTime());
  }

  onPointerMove(e: MouseEvent | TouchEvent) {
    this.canvasDrawer.onPointerMove(e, this.currentTime(), this.videoWidth(), this.videoHeight());
  }

  onPointerUp() {
    this.canvasDrawer.onPointerUp(this.videoWidth(), this.videoHeight(), this.currentTime());
  }
  
  clearCanvas() {
    this.canvasDrawer.clearCanvas();
  }

  deleteStroke(id: string) {
    this.canvasDrawer.deleteStroke(id, this.videoWidth(), this.videoHeight(), this.currentTime());
  }

  updateStrokeStartTime(id: string, newTime: number) {
    this.canvasDrawer.updateStrokeStartTime(id, newTime, this.videoDuration(), this.videoWidth(), this.videoHeight(), this.currentTime());
  }

  updateStrokeDuration(id: string, newDuration: number) {
    this.canvasDrawer.updateStrokeDuration(id, newDuration, this.videoWidth(), this.videoHeight(), this.currentTime());
  }

  updateStrokeText(id: string, newText: string) {
    this.canvasDrawer.updateStrokeText(id, newText, this.videoWidth(), this.videoHeight(), this.currentTime());
  }

  updateStrokeFontSize(id: string, newFontSize: number) {
    this.canvasDrawer.updateStrokeFontSize(id, newFontSize, this.videoWidth(), this.videoHeight(), this.currentTime());
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
      videoSegments: this.videoSegments(),
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
      appliedFilters: this.appliedFilters(),
      zoomRegions: this.zoomRegions(),
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
        console.warn('Waveform extraction failed:', err);
        // Set a flat baseline of silent bars if extraction fails (no fake simulation)
        this.waveform.set(Array(120).fill(0.12));
        this.isExtractingWaveform.set(false);
      });
  }

  isBarSelected(index: number): boolean {
    const duration = this.videoDuration();
    if (duration <= 0) return false;
    const barTime = (index / 120) * duration;
    return barTime >= this.trimStart() && barTime <= this.trimEnd();
  }

}
