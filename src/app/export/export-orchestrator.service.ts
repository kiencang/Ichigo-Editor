import { Injectable, inject, signal } from "@angular/core";
import { EditorStateService } from "../core/editor-state.service";
import { VideoSegments } from "../segments/video-segments";
import { VideoFiltersService } from "../filters/video-filters.service";
import { ZoomRegionsService } from "../zoom/zoom-regions.service";
import { CanvasDrawer } from "../canvas/canvas-drawer";
import { BackgroundAudio } from "../audio/background-audio";
import { ExportProcessor, ExportConfig } from "./export-processor";
import { IntroSettings } from "../intro/intro.types";

@Injectable({ providedIn: "root" })
export class ExportOrchestratorService {
  private editorState = inject(EditorStateService);
  private videoSegmentsService = inject(VideoSegments);
  private videoFiltersService = inject(VideoFiltersService);
  private zoomRegionsService = inject(ZoomRegionsService);
  private canvasDrawer = inject(CanvasDrawer);
  private backgroundAudio = inject(BackgroundAudio);
  private exportProcessor = inject(ExportProcessor);

  isProcessing = signal(false);
  progress = signal(0);

  async exportVideo(
    canvasElement: HTMLCanvasElement,
    introSettings: IntroSettings,
    translations: ExportConfig["translations"],
  ) {
    if (!this.editorState.videoFile() || !this.editorState.videoUrl()) return;
    this.isProcessing.set(true);
    this.progress.set(0);
    this.editorState.logs.set([]);

    const config = {
      videoUrl: this.editorState.videoUrl()!,
      videoWidth: this.editorState.videoWidth(),
      videoHeight: this.editorState.videoHeight(),
      videoDuration: this.videoSegmentsService.videoDuration(),
      videoSegments: this.videoSegmentsService.videoSegments(),
      volume: this.editorState.volume(),
      outputFormat: this.editorState.outputFormat(),
      videoFile: this.editorState.videoFile(),
      audioBitrate: this.editorState.audioBitrate(),
      videoBitrate: this.editorState.videoBitrate(),
      audioTracks: this.backgroundAudio.audioTracks(),
      logoFile: this.editorState.logoFile(),
      logoPosition: this.editorState.logoPosition(),
      logoOpacity: this.editorState.logoOpacity(),
      logoSize: this.editorState.logoSize(),
      appliedFilters: this.videoFiltersService.appliedFilters(),
      zoomRegions: this.zoomRegionsService.zoomRegions(),
      introSettings: introSettings,
      transitionDuration: this.editorState.transitionDuration(),
      canvasElement: canvasElement,
      strokes: this.canvasDrawer.strokes(),
      translations: translations,
      onProgress: (pct: number) => this.progress.set(pct),
      onLog: (msg: string) =>
        this.editorState.logs.update((l: string[]) => [...l, msg]),
      onSuccess: (url: string) => {
        if (this.editorState.outputUrl()) {
          URL.revokeObjectURL(this.editorState.outputUrl()!);
        }
        this.editorState.outputUrl.set(url);
        this.isProcessing.set(false);

        // Auto-download trigger
        try {
          const originalName = this.editorState.videoFile()?.name || "video";
          const baseName =
            originalName.substring(0, originalName.lastIndexOf(".")) ||
            originalName;
          const extension = this.editorState.outputFormat();
          const downloadName = `${baseName}_ichigo.${extension}`;

          const a = document.createElement("a");
          a.href = url;
          a.download = downloadName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          this.editorState.logs.update((l: string[]) => [
            ...l,
            `[Downloader] Download triggered automatically: ${downloadName}`,
          ]);
        } catch (downloadErr) {
          console.error("Trigger download failed", downloadErr);
          this.editorState.logs.update((l: string[]) => [
            ...l,
            `[Downloader] Error during auto-download: ${downloadErr}`,
          ]);
        }
      },
      onError: (err: unknown) => {
        console.error(err);
        this.editorState.logs.update((l: string[]) => [
          ...l,
          `Rendering Pipeline Error: ${err}`,
        ]);
        this.isProcessing.set(false);
      },
    };

    if (this.editorState.outputFormat() === "gif") {
      await this.exportProcessor.exportGif(config);
    } else {
      await this.exportProcessor.exportVideo(config);
    }
  }
}
