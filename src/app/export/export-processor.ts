import { Injectable, inject } from '@angular/core';
import { VideoExporter } from './video-exporter';
import { GifExporter } from './gif-exporter';
import { Stroke } from '../canvas/stroke.types';
import { VideoSegment } from '../segments/segments';
import { AppliedFilter } from '../filters/filters.types';
import { ZoomRegion } from '../zoom/zoom.types';
import { IntroSettings } from '../intro/intro.types';

export interface ExportConfig {
  videoUrl: string;
  videoWidth: number;
  videoHeight: number;
  videoDuration: number;
  videoSegments: VideoSegment[];
  volume: number; // Volume 0-100
  outputFormat: string; // 'webm' | 'mp4' | 'gif'
  videoFile: File | null;
  audioBitrate: number;
  videoBitrate: number;
  audioTracks: {id: string, file: File, url: string, duration: number, waveform: number[], volume: number, trimStart: number, trimEnd: number}[];
  logoFile: File | null;
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  logoOpacity: number;
  logoSize: number;
  appliedFilters?: AppliedFilter[];
  zoomRegions?: ZoomRegion[];
  introSettings?: IntroSettings;
  transitionDuration?: number;
  canvasElement: HTMLCanvasElement;
  strokes: Stroke[];
  translations: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    gifStep1: string;
    gifStep2: string;
    gifStep3: string;
    gifSuccess: (sizeMB: string) => string;
    exportSuccess: (format: string, sizeMB: string) => string;
    renderingSeq: string;
  };
  onProgress: (pct: number) => void;
  onLog: (msg: string) => void;
  onSuccess: (url: string) => void;
  onError: (err: unknown) => void;
}

@Injectable({
  providedIn: 'root'
})
export class ExportProcessor {
  private videoExporter = inject(VideoExporter);
  private gifExporter = inject(GifExporter);

  async exportVideo(config: ExportConfig): Promise<void> {
    await this.videoExporter.exportVideo(config);
  }

  async exportGif(config: ExportConfig): Promise<void> {
    await this.gifExporter.exportGif(config);
  }
}
