import { Injectable } from '@angular/core';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { Stroke, drawStrokesOnContext } from '../canvas/stroke.types';
import { AppliedFilter, getAppliedFiltersCSSAtTime } from '../filters/filters.types';
import { VideoSegment, getOriginalTime } from '../segments/segments';

export interface GifExportConfig {
  videoUrl: string;
  videoWidth: number;
  videoHeight: number;
  videoDuration: number;
  videoSegments: VideoSegment[];
  logoFile: File | null;
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  logoOpacity: number;
  logoSize: number;
  appliedFilters?: AppliedFilter[];
  canvasElement: HTMLCanvasElement;
  strokes: Stroke[];
  translations: {
    gifStep1: string;
    gifStep2: string;
    gifStep3: string;
    gifSuccess: (sizeMB: string) => string;
  };
  onProgress: (pct: number) => void;
  onLog: (msg: string) => void;
  onSuccess: (url: string) => void;
  onError: (err: unknown) => void;
}

@Injectable({
  providedIn: 'root'
})
export class GifExporter {
  async exportGif(config: GifExportConfig): Promise<void> {
    const {
      videoUrl,
      videoWidth,
      videoHeight,
      videoSegments,
      logoFile,
      logoPosition,
      logoOpacity,
      logoSize,
      appliedFilters,
      strokes,
      translations,
      onProgress,
      onLog,
      onSuccess,
      onError
    } = config;

    try {
      onProgress(0);
      onLog(translations.gifStep1);

      const maxW = 480;
      const originalW = videoWidth || 640;
      const originalH = videoHeight || 360;
      const ratio = originalH / originalW;
      
      const gifWidth = Math.min(maxW, originalW);
      const gifHeight = Math.round(gifWidth * ratio);
      
      const gifCanvas = document.createElement('canvas');
      gifCanvas.width = gifWidth;
      gifCanvas.height = gifHeight;
      const gifCtx = gifCanvas.getContext('2d', { willReadFrequently: true });
      if (!gifCtx) {
        throw new Error('Failed to create 2D canvas context for GIF');
      }

      // Load watermark if any
      const logoImg = new Image();
      let logoLoaded = false;
      if (logoFile) {
        logoImg.src = URL.createObjectURL(logoFile);
        await new Promise<void>((resolve) => {
          logoImg.onload = () => {
            logoLoaded = true;
            resolve();
          };
          logoImg.onerror = () => resolve();
        });
      }

      // Create offscreen video element for discrete seeking
      const exportVid = document.createElement('video');
      exportVid.src = videoUrl;
      exportVid.muted = true;
      exportVid.playsInline = true;

      await new Promise<void>((resolve) => {
        exportVid.onloadedmetadata = () => resolve();
        exportVid.onerror = () => resolve();
      });

      onLog(translations.gifStep2);

      const totalDuration = videoSegments.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
      
      const frameRate = 10; // 10fps
      const frameStep = 1 / frameRate; // every 100ms
      const totalFrames = Math.max(1, Math.floor(totalDuration / frameStep));
      
      const encoder = GIFEncoder();
      let renderedFrames = 0;
      
      for (let i = 0; i < totalFrames; i++) {
        const targetVirtualTime = i * frameStep;
        const targetOriginalTime = getOriginalTime(targetVirtualTime, videoSegments);
        exportVid.currentTime = targetOriginalTime;
        
        await new Promise<void>((resolve) => {
          exportVid.onseeked = () => resolve();
        });

        // Clear and draw combined layers
        gifCtx.clearRect(0, 0, gifWidth, gifHeight);
        const activeFilterStyle = getAppliedFiltersCSSAtTime(appliedFilters || [], targetOriginalTime);
        gifCtx.filter = activeFilterStyle;
        gifCtx.drawImage(exportVid, 0, 0, gifWidth, gifHeight);
        gifCtx.filter = 'none';
        // Draw drawing annotations dynamically on targetGifCtx based on original time
        drawStrokesOnContext(gifCtx, strokes, targetOriginalTime, gifWidth, gifHeight, videoWidth, videoHeight);
        
        // Draw watermark logo
        if (logoLoaded) {
          const margin = gifWidth * 0.03;
          const logoW = gifWidth * (logoSize / 100);
          const logoH = logoImg.height * (logoW / logoImg.width);
          
          let logoX = gifWidth - logoW - margin;
          let logoY = margin;
          
          if (logoPosition === 'top-left') {
            logoX = margin;
            logoY = margin;
          } else if (logoPosition === 'top-right') {
            logoX = gifWidth - logoW - margin;
            logoY = margin;
          } else if (logoPosition === 'bottom-left') {
            logoX = margin;
            logoY = gifHeight - logoH - margin;
          } else if (logoPosition === 'bottom-right') {
            logoX = gifWidth - logoW - margin;
            logoY = gifHeight - logoH - margin;
          }
          
          gifCtx.save();
          gifCtx.globalAlpha = logoOpacity / 100;
          gifCtx.drawImage(logoImg, logoX, logoY, logoW, logoH);
          gifCtx.restore();
        }

        // Quantize colors and write GIF frame
        const formatType = 'rgba4444';
        const imgData = gifCtx.getImageData(0, 0, gifWidth, gifHeight);
        const palette = quantize(imgData.data, 256, { format: formatType });
        const index = applyPalette(imgData.data, palette, formatType);
        
        encoder.writeFrame(index, gifWidth, gifHeight, {
          palette,
          delay: Math.round(frameStep * 1000)
        });

        renderedFrames++;
        const progressPct = Math.round((renderedFrames / totalFrames) * 95);
        onProgress(progressPct);
      }

      onLog(translations.gifStep3);

      encoder.finish();
      const buffer = encoder.bytes();
      const blob = new Blob([buffer.buffer as ArrayBuffer], { type: 'image/gif' });

      onProgress(100);
      onLog(translations.gifSuccess((blob.size / (1024 * 1024)).toFixed(2)));
      onSuccess(URL.createObjectURL(blob));

    } catch (e) {
      onError(e);
    }
  }
}
