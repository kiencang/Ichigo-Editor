import {
  ChangeDetectionStrategy,
  Component,
  signal,
  computed,
  ViewChild,
  ElementRef,
  afterNextRender,
  inject,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { getTranslations } from "./core/translations";
import { TimeFormatter } from "./core/time-formatter";
import { WaveformProcessor } from "./audio/waveform-processor";
import { CanvasDrawer } from "./canvas/canvas-drawer";
import { VideoSegment } from "./segments/segments";
import { BackgroundAudio } from "./audio/background-audio";
import { BackgroundAudioPanel } from "./audio/background-audio-panel";
import { VideoSegments } from "./segments/video-segments";
import { VideoFilters } from "./filters/video-filters";
import { ExportPanel } from "./export/export-panel";
import { WatermarkPanel } from "./watermark/watermark-panel";
import { AppHeader } from "./layout/header";
import { AppFooter } from "./layout/footer";
import { UploadPanel } from "./upload/upload-panel";
import { AppStrokesList } from "./canvas/strokes-list";
import { AppAppliedFiltersList } from "./filters/applied-filters-list";
import { AppZoomRegionsList } from "./zoom/zoom-regions-list";
import { IntroPanelComponent } from "./intro/intro-panel";
import { IntroSettings, DEFAULT_INTRO_SETTINGS } from "./intro/intro.types";
import { AnnotationToolsComponent } from "./canvas/annotation-tools";
import { ZoomRegionsService } from "./zoom/zoom-regions.service";
import { VideoFiltersService } from "./filters/video-filters.service";
import { EditorStateService } from "./core/editor-state.service";
import { ExportOrchestratorService } from "./export/export-orchestrator.service";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-root",
  imports: [
    FormsModule,
    MatIconModule,
    VideoFilters,
    ExportPanel,
    WatermarkPanel,
    AppHeader,
    AppFooter,
    UploadPanel,
    AppStrokesList,
    AppAppliedFiltersList,
    AppZoomRegionsList,
    BackgroundAudioPanel,
    IntroPanelComponent,
    AnnotationToolsComponent,
  ],
  templateUrl: "./app.html",
  styleUrl: "./app.css",
})
export class App {
  private waveformProcessor = inject(WaveformProcessor);
  private canvasDrawer = inject(CanvasDrawer);
  private exportOrchestratorService = inject(ExportOrchestratorService);
  readonly backgroundAudio = inject(BackgroundAudio);
  readonly videoSegmentsService = inject(VideoSegments);

  // --- Editor Core State ---
  private editorState = inject(EditorStateService);

  introSettings = signal<IntroSettings>(DEFAULT_INTRO_SETTINGS);
  introPreviewTimestamp = signal<number | null>(null);

  lang = this.editorState.lang;
  logs = this.editorState.logs;

  videoFile = this.editorState.videoFile;
  videoUrl = this.editorState.videoUrl;
  isVideoLoaded = this.editorState.isVideoLoaded;
  videoDuration = this.videoSegmentsService.videoDuration;
  videoWidth = this.editorState.videoWidth;
  videoHeight = this.editorState.videoHeight;

  currentTime = this.editorState.currentTime;
  isPlaying = this.editorState.isPlaying;

  timelineZoom = this.editorState.timelineZoom;
  activeDrag = this.editorState.activeDrag;

  volume = this.editorState.volume;
  outputFormat = this.editorState.outputFormat;
  audioBitrate = this.editorState.audioBitrate;
  videoBitrate = this.editorState.videoBitrate;
  outputUrl = this.editorState.outputUrl;

  logoFile = this.editorState.logoFile;
  logoPreviewUrl = this.editorState.logoPreviewUrl;
  logoPosition = this.editorState.logoPosition;
  logoOpacity = this.editorState.logoOpacity;
  logoSize = this.editorState.logoSize;

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

  setLang(l: "vi" | "en") {
    this.editorState.lang.set(l);
  }

  translations = computed(() => {
    return getTranslations(this.lang());
  });

  isLoaded = signal(false);
  isLoading = signal(false);
  isProcessing = this.exportOrchestratorService.isProcessing;
  progress = this.exportOrchestratorService.progress;
  errorMessage = signal<string | null>(null);

  private zoomRegionsService = inject(ZoomRegionsService);
  private videoFiltersService = inject(VideoFiltersService);

  // --- External states ---
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
  transitionDuration = this.editorState.transitionDuration;

  transitionFadeOpacity = computed(() => {
    const time = this.currentTime();
    const segments = this.videoSegments();
    if (segments.length <= 1) return 0;

    const idx = segments.findIndex(s => time >= s.start && time <= s.end);
    if (idx === -1) return 0;

    const seg = segments[idx];
    const duration = seg.end - seg.start;
    // Fade duration is half of the total transition duration, bounded by half of the segment duration
    const activeFadeDuration = Math.min(this.transitionDuration() / 2, duration / 2);

    // Fade in at start of segment (only if it's not the first segment)
    if (idx > 0 && time < seg.start + activeFadeDuration) {
      const progress = (time - seg.start) / activeFadeDuration;
      return Math.max(0, Math.min(1, 1 - progress));
    }

    // Fade out at end of segment (only if it's not the last segment)
    if (idx < segments.length - 1 && time > seg.end - activeFadeDuration) {
      const progress = (seg.end - time) / activeFadeDuration;
      return Math.max(0, Math.min(1, 1 - progress));
    }

    return 0;
  });

  // --- Zoom States ---
  zoomRegions = this.zoomRegionsService.zoomRegions;
  activeZoomId = this.zoomRegionsService.activeZoomId;
  currentActiveZoom = this.zoomRegionsService.currentActiveZoom;

  currentZoomState = computed(() => {
    return this.zoomRegionsService.currentZoomState(this.currentTime());
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
    const dur = this.videoDuration();
    const current = this.currentTime();
    const newZoom = this.zoomRegionsService.addZoomRegion(current, dur);
    if (newZoom) {
      this.logs.update((l) => [
        ...l,
        this.lang() === "vi"
          ? `[Thu phóng] Đã thêm vùng thu phóng 2.0x tại ${current.toFixed(2)}s hiển thị trong ${newZoom.duration.toFixed(1)}s`
          : `[Zoom & Pan] Added 2.0x zoom region at ${current.toFixed(2)}s for ${newZoom.duration.toFixed(1)}s`,
      ]);
    }
  }

  deleteZoomRegion(id: string) {
    this.zoomRegionsService.deleteZoomRegion(id);
  }

  updateZoomStartTime(id: string, newTime: number) {
    this.zoomRegionsService.updateZoomStartTime(
      id,
      newTime,
      this.videoDuration(),
    );
  }

  updateZoomDuration(id: string, newDuration: number) {
    this.zoomRegionsService.updateZoomDuration(
      id,
      newDuration,
      this.videoDuration(),
    );
  }

  updateZoomScale(id: string, newScale: number) {
    this.zoomRegionsService.updateZoomScale(id, newScale);
  }

  updateZoomPanX(id: string, newPanX: number) {
    this.zoomRegionsService.updateZoomPanX(id, newPanX);
  }

  updateZoomPanY(id: string, newPanY: number) {
    this.zoomRegionsService.updateZoomPanY(id, newPanY);
  }

  getZoomQuadrantIcon(panX: number, panY: number): string {
    if (panX === 25 && panY === 25) return "north_west";
    if (panX === 75 && panY === 25) return "north_east";
    if (panX === 25 && panY === 75) return "south_west";
    if (panX === 75 && panY === 75) return "south_east";
    return "zoom_in";
  }

  getZoomQuadrantLabelShort(panX: number, panY: number): string {
    const isVi = this.lang() === "vi";
    if (panX === 25 && panY === 25) return isVi ? "Trên - Trái" : "Top Left";
    if (panX === 75 && panY === 25) return isVi ? "Trên - Phải" : "Top Right";
    if (panX === 25 && panY === 75) return isVi ? "Dưới - Trái" : "Btm Left";
    if (panX === 75 && panY === 75) return isVi ? "Dưới - Phải" : "Btm Right";
    return isVi ? "Trung tâm" : "Center";
  }

  // --- Filter states ---
  videoFiltersList = this.videoFiltersService.videoFiltersList;
  appliedFilters = this.videoFiltersService.appliedFilters;
  activeFilterId = this.videoFiltersService.activeFilterId;
  currentActiveFilter = this.videoFiltersService.currentActiveFilter;

  getVideoFilterStyle() {
    return this.videoFiltersService.getVideoFilterStyle(this.currentTime());
  }

  addAppliedFilter(presetId: string) {
    if (!this.videoUrl()) return;
    const dur = this.videoDuration();
    const current = this.currentTime();
    const newFilter = this.videoFiltersService.addAppliedFilter(
      presetId,
      current,
      dur,
    );

    if (newFilter) {
      this.logs.update((l) => [
        ...l,
        this.lang() === "vi"
          ? `[Bộ lọc] Đã thêm bộ lọc ${presetId} tại ${current.toFixed(2)}s hiển thị trong ${newFilter.duration.toFixed(1)}s`
          : `[Filter] Added ${presetId} filter at ${current.toFixed(2)}s for ${newFilter.duration.toFixed(1)}s`,
      ]);
    }
  }

  deleteAppliedFilter(id: string) {
    this.videoFiltersService.deleteAppliedFilter(id);
  }

  updateFilterStartTime(id: string, newTime: number) {
    this.videoFiltersService.updateFilterStartTime(
      id,
      newTime,
      this.videoDuration(),
    );
  }

  updateFilterDuration(id: string, newDuration: number) {
    this.videoFiltersService.updateFilterDuration(
      id,
      newDuration,
      this.videoDuration(),
    );
  }

  updateFilterIntensity(id: string, intensity: number) {
    this.videoFiltersService.updateFilterIntensity(id, intensity);
  }

  getFilterPresetName(presetId: string): string {
    return this.videoFiltersService.getFilterPresetName(presetId, this.lang());
  }

  getStrokeTypeName(type: string): string {
    const isVi = this.lang() === "vi";
    switch (type) {
      case "pen":
        return isVi ? "Nét vẽ tự do" : "Freehand Draw";
      case "arrow":
        return isVi ? "Mũi tên chỉ hướng" : "Directional Arrow";
      case "rect":
        return isVi ? "Hình chữ nhật" : "Rectangle";
      case "circle":
        return isVi ? "Hình tròn" : "Circle";
      case "line":
        return isVi ? "Đường thẳng" : "Straight Line";
      default:
        return type;
    }
  }

  audioTracks = this.backgroundAudio.audioTracks;
  isExtractingBgWaveform = this.backgroundAudio.isExtractingBgWaveform;
  playingTrackId = this.backgroundAudio.playingTrackId;
  isolatedPreviewTime = this.backgroundAudio.isolatedPreviewTime;

  currentTool = this.canvasDrawer.currentTool;
  color = this.canvasDrawer.color;
  strokes = this.canvasDrawer.strokes;
  activeStrokeId = this.canvasDrawer.activeStrokeId;
  currentActiveStroke = this.canvasDrawer.currentActiveStroke;

  @ViewChild("timelineScrollContainer")
  timelineScrollContainer!: ElementRef<HTMLDivElement>;

  waveform = signal<number[]>([]);
  isExtractingWaveform = signal<boolean>(false);

  @ViewChild("videoEl") videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild("canvasEl") canvasEl!: ElementRef<HTMLDivElement>;
  @ViewChild("timelineContainer")
  timelineContainer!: ElementRef<HTMLDivElement>;

  private ctx: CanvasRenderingContext2D | null = null;
  private savedImageData: ImageData | null = null;

  reorderAudioTracks(event: { draggedIndex: number; targetIndex: number }) {
    this.audioTracks.update((tracks) => {
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
    this.logs.update((l) => [
      ...l,
      this.translations().msgInitSuccess,
      this.translations().msgFeatures,
    ]);
  }

  onVideoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.errorMessage.set(null);

      const maxSize = 300 * 1024 * 1024; // 300MB
      if (file.size > maxSize) {
        this.errorMessage.set(
          this.translations().errMaxSize(
            300,
            (file.size / (1024 * 1024)).toFixed(1),
          ),
        );
        (event.target as HTMLInputElement).value = "";
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
    await this.backgroundAudio.onAudioSelected(event, () =>
      this.syncBackgroundAudio(),
    );
  }

  removeAudioTrack(id: string) {
    this.backgroundAudio.removeAudioTrack(id, () => this.syncBackgroundAudio());
  }

  setTrackVolume(id: string, volume: number) {
    this.backgroundAudio.setTrackVolume(id, volume, () =>
      this.syncBackgroundAudio(),
    );
  }

  setTrackTrimStart(id: string, start: number) {
    this.backgroundAudio.setTrackTrimStart(id, start, () =>
      this.syncBackgroundAudio(),
    );
  }

  setTrackTrimEnd(id: string, end: number) {
    this.backgroundAudio.setTrackTrimEnd(id, end, () =>
      this.syncBackgroundAudio(),
    );
  }

  previewSpecificTrack(id: string) {
    this.backgroundAudio.previewSpecificTrack(id, this.isPlaying(), () =>
      this.togglePlay(),
    );
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
    this.videoSegmentsService.splitSegmentAtPlayhead(this.currentTime(), () =>
      this.checkFormatLimits(),
    );
  }

  deleteSegment(id: string) {
    this.videoSegmentsService.deleteSegment(id, () => this.checkFormatLimits());
  }

  updateSegmentStart(id: string, val: number) {
    this.videoSegmentsService.updateSegmentStart(id, val, () =>
      this.checkFormatLimits(),
    );
  }

  updateSegmentEnd(id: string, val: number) {
    this.videoSegmentsService.updateSegmentEnd(id, val, () =>
      this.checkFormatLimits(),
    );
  }

  checkFormatLimits() {
    if (this.isGifDisabled() && this.outputFormat() === "gif") {
      this.outputFormat.set("mp4");
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
      video
        .play()
        .then(() => {
          this.isPlaying.set(true);
          this.syncBackgroundAudio();
        })
        .catch((err) => console.error(err));
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
      const targetSeg = this.videoSegments().find(
        (s) => target >= s.start && target <= s.end,
      );
      if (targetSeg) {
        this.selectedSegmentId.set(targetSeg.id);
      }
    }

    if (wasPlaying) {
      video
        .play()
        .then(() => {
          this.isPlaying.set(true);
          this.syncBackgroundAudio();
        })
        .catch((err) => {
          console.warn("Playback resume failed:", err);
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
      const currentSegIndex = segments.findIndex(
        (s) => currentOriginal >= s.start && currentOriginal <= s.end,
      );

      if (currentSegIndex === -1) {
        const nextSeg = segments.find((s) => s.start > currentOriginal);
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

      // Update video volume based on transition fade
      const baseVol = this.volume() / 100;
      const fadedVol = baseVol * (1 - this.transitionFadeOpacity());
      video.volume = Math.max(0, Math.min(1.0, fadedVol));

      this.currentTime.set(currentOriginal);
      this.selectedSegmentId.set(currentSeg.id);
      this.autoScrollTimeline(currentOriginal);
      this.syncBackgroundAudio();
    }
  }

  syncBackgroundAudio() {
    const elapsed = this.introPreviewTimestamp() ? (performance.now() - this.introPreviewTimestamp()!) / 1000 : 0;
    const isIntroActive = this.introPreviewTimestamp() !== null && elapsed <= this.introSettings().duration;

    this.backgroundAudio.syncBackgroundAudio(
      this.videoEl?.nativeElement,
      this.videoSegments(),
      this.trimStart(),
      this.trimEnd(),
      isIntroActive
    );
  }

  autoScrollTimeline(currentTime: number) {
    if (
      !this.timelineScrollContainer ||
      !this.timelineContainer ||
      this.videoDuration() === 0
    )
      return;

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

  onTimelineMouseDown(
    event: MouseEvent,
    target: "start" | "end" | "playhead" | "track",
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (target === "track") {
      this.activeDrag.set("playhead");
      this.handleTimelineDrag(event);
    } else {
      this.activeDrag.set(target);
    }
  }

  onTimelineTouchStart(
    event: TouchEvent,
    target: "start" | "end" | "playhead" | "track",
  ) {
    event.stopPropagation();

    if (target === "track") {
      this.activeDrag.set("playhead");
      this.handleTimelineDrag(event);
    } else {
      this.activeDrag.set(target);
    }
  }

  onSegmentMouseDown(event: MouseEvent, seg: VideoSegment) {
    event.stopPropagation();
    event.preventDefault();
    this.selectedSegmentId.set(seg.id);
    this.activeDrag.set("playhead");
    this.handleTimelineDrag(event);
  }

  onSegmentTouchStart(event: TouchEvent, seg: VideoSegment) {
    event.stopPropagation();
    this.selectedSegmentId.set(seg.id);
    this.activeDrag.set("playhead");
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
    const clientX =
      "touches" in event
        ? event.touches[0].clientX
        : (event as MouseEvent).clientX;
    const relativeX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, relativeX / rect.width));
    const targetTime = percentage * this.videoDuration();

    const dragType = this.activeDrag();
    if (dragType === "start" || dragType === "end") {
      const selId = this.selectedSegmentId();
      const segments = this.videoSegments();
      const activeSeg = segments.find((s) => s.id === selId) || segments[0];
      if (!activeSeg) return;

      if (dragType === "start") {
        this.updateSegmentStart(activeSeg.id, targetTime);
        const updatedSeg = this.videoSegments().find(
          (s) => s.id === activeSeg.id,
        );
        if (updatedSeg) {
          this.seekTo(updatedSeg.start);
        }
      } else {
        this.updateSegmentEnd(activeSeg.id, targetTime);
        const updatedSeg = this.videoSegments().find(
          (s) => s.id === activeSeg.id,
        );
        if (updatedSeg) {
          this.seekTo(updatedSeg.end);
        }
      }
    } else if (dragType === "playhead") {
      this.seekTo(targetTime);
    }
  }

  onVideoLoadedMetadata(event: Event) {
    const video = event.target as HTMLVideoElement;

    const maxDuration = 30 * 60; // 30 minutes in seconds
    if (video.duration > maxDuration) {
      this.errorMessage.set(
        this.translations().errMaxDuration(
          30,
          (video.duration / 60).toFixed(1),
        ),
      );

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
      this.canvasDrawer.init(this.canvasEl.nativeElement);
    }
  }

  // --- Canvas Drawing Logic ---

  getMousePos(e: MouseEvent | TouchEvent) {
    return this.canvasDrawer.getMousePos(this.canvasEl.nativeElement, e);
  }

  redrawCanvas() {
    let introState = undefined;
    if (this.introPreviewTimestamp()) {
      const elapsed =
        (performance.now() - this.introPreviewTimestamp()!) / 1000;
      if (elapsed <= this.introSettings().duration) {
        introState = { active: true, settings: this.introSettings(), elapsed };
        requestAnimationFrame(() => this.redrawCanvas());
      } else {
        this.introPreviewTimestamp.set(null);
        if (this.introAudioEl) {
          this.introAudioEl.pause();
          this.introAudioEl.src = "";
          this.introAudioEl = null;
        }
      }
    }
    this.canvasDrawer.redrawCanvas(introState);
  }

  introAudioEl: HTMLAudioElement | null = null;

  previewIntro() {
    const settings = this.introSettings();
    if (!settings.enabled) return;

    window.scrollTo({ top: 0, behavior: "smooth" });

    // Pause video
    if (this.videoEl) {
      this.videoEl.nativeElement.pause();
    }
    this.isPlaying.set(false);
    this.syncBackgroundAudio();

    if (settings.audioUrl) {
      if (this.introAudioEl) {
        this.introAudioEl.pause();
      }
      this.introAudioEl = new Audio(settings.audioUrl);
      this.introAudioEl.volume = settings.audioVolume / 100;
      this.introAudioEl.play().catch((e) => console.error(e));
    }

    this.introPreviewTimestamp.set(performance.now());
    this.redrawCanvas();
  }

  zoomPreviewTimeout: ReturnType<typeof setTimeout> | null = null;

  previewZoomRegion(id: string) {
    const region = this.zoomRegions().find((r) => r.id === id);
    if (!region) return;

    window.scrollTo({ top: 0, behavior: "smooth" });
    this.seekTo(region.startTime);

    if (this.zoomPreviewTimeout) {
      clearTimeout(this.zoomPreviewTimeout);
    }

    setTimeout(() => {
      if (this.videoEl) {
        this.videoEl.nativeElement.play();
        this.zoomPreviewTimeout = setTimeout(() => {
          this.videoEl?.nativeElement.pause();
        }, region.duration * 1000);
      }
    }, 400); // Give smooth scrolling a moment to finish
  }

  onPointerDown(e: MouseEvent | TouchEvent) {
    this.canvasDrawer.onPointerDown(e);
  }

  onPointerMove(e: MouseEvent | TouchEvent) {
    this.canvasDrawer.onPointerMove(e);
  }

  onPointerUp() {
    this.canvasDrawer.onPointerUp();
  }

  clearCanvas() {
    this.canvasDrawer.clearCanvas();
  }

  deleteStroke(id: string) {
    this.canvasDrawer.deleteStroke(id);
  }

  updateStrokeStartTime(id: string, newTime: number) {
    this.canvasDrawer.updateStrokeStartTime(id, newTime);
  }

  updateStrokeDuration(id: string, newDuration: number) {
    this.canvasDrawer.updateStrokeDuration(id, newDuration);
  }

  updateStrokeText(id: string, newText: string) {
    this.canvasDrawer.updateStrokeText(id, newText);
  }

  updateStrokeFontSize(id: string, newFontSize: number) {
    this.canvasDrawer.updateStrokeFontSize(id, newFontSize);
  }

  // --- Rendering logic ---

  async exportVideo() {
    if (!this.isLoaded() || !this.videoFile() || !this.videoUrl()) return;
    await this.exportOrchestratorService.exportVideo(
      this.canvasDrawer.getCanvasElement() || document.createElement("canvas"),
      this.introSettings(),
      this.translations(),
    );
  }

  getExtension(filename: string) {
    return filename.substring(filename.lastIndexOf(".")) || "";
  }

  downloadCanvas() {
    const dataUrl = this.canvasDrawer.getStageDataUrl();
    if (dataUrl) {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "annotation.png";
      a.click();
    }
  }

  extractAudioWaveform(file: File) {
    this.isExtractingWaveform.set(true);
    this.waveform.set([]);

    this.waveformProcessor
      .extractWaveform(file, 120)
      .then((amps) => {
        this.waveform.set(amps);
        this.isExtractingWaveform.set(false);
      })
      .catch((err) => {
        console.warn("Waveform extraction failed:", err);
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
