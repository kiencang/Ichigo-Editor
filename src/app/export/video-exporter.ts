import { Injectable } from "@angular/core";
import { Stroke, drawStrokesOnContext } from "../canvas/stroke.types";
import { AppliedFilter, getAppliedFiltersCSSAtTime } from "../filters/filters.types";
import { VideoSegment } from "../segments/segments";
import { ZoomRegion, getZoomAtTime } from "../zoom/zoom.types";
import { IntroSettings } from "../intro/intro.types";

export interface VideoExportConfig {
  videoUrl: string;
  videoWidth: number;
  videoHeight: number;
  videoDuration: number;
  videoSegments: VideoSegment[];
  volume: number; // Volume 0-100
  outputFormat: string; // 'webm' | 'mp4'
  videoFile: File | null;
  audioBitrate: number;
  videoBitrate: number;
  audioTracks: {
    id: string;
    file: File;
    url: string;
    duration: number;
    waveform: number[];
    volume: number;
    trimStart: number;
    trimEnd: number;
  }[];
  logoFile: File | null;
  logoPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
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
    exportSuccess: (format: string, sizeMB: string) => string;
    renderingSeq: string;
  };
  onProgress: (pct: number) => void;
  onLog: (msg: string) => void;
  onSuccess: (url: string) => void;
  onError: (err: unknown) => void;
}

import { drawIntroOnContext } from "../canvas/intro-drawer";

@Injectable({
  providedIn: "root",
})
export class VideoExporter {
  async exportVideo(config: VideoExportConfig): Promise<void> {
    const {
      videoUrl,
      videoWidth,
      videoHeight,
      videoDuration,
      videoSegments,
      volume,
      outputFormat,
      videoFile,
      audioBitrate,
      videoBitrate,
      audioTracks,
      logoFile,
      logoPosition,
      logoOpacity,
      logoSize,
      appliedFilters,
      zoomRegions,
      introSettings,
      strokes,
      translations,
      onProgress,
      onLog,
      onSuccess,
      onError,
    } = config;

    try {
      onProgress(0);
      onLog(translations.step1);

      // 1. Dynamic Resolution Optimization (Max: 1920x1080)
      let outW = videoWidth || 1280;
      let outH = videoHeight || 720;
      const maxW = 1920;
      const maxH = 1080;
      if (outW > maxW || outH > maxH) {
        const scale = Math.min(maxW / outW, maxH / outH);
        outW = Math.round(outW * scale);
        outH = Math.round(outH * scale);
        onLog(
          `[Resolution Optimizer] Scaled down from ${videoWidth}x${videoHeight} to ${outW}x${outH} (Full HD Limit)`,
        );
      } else {
        onLog(
          `[Resolution Optimizer] Keeping original source resolution: ${outW}x${outH}`,
        );
      }

      // Estimate and map source video bitrate
      let finalVideoBitrate = 4000000; // default 4 Mbps
      if (videoBitrate > 0) {
        finalVideoBitrate = videoBitrate;
        onLog(
          `[Bitrate Analyzer] User selected custom profile: ${finalVideoBitrate / 1000000} Mbps.`,
        );
      } else if (videoFile && videoDuration > 0) {
        const fileSizeBits = videoFile.size * 8;
        const estimatedBitrate = fileSizeBits / videoDuration;

        if (estimatedBitrate <= 2000000) {
          finalVideoBitrate = 2000000;
        } else if (estimatedBitrate <= 4000000) {
          finalVideoBitrate = 4000000;
        } else {
          finalVideoBitrate = 8000000;
        }

        onLog(
          `[Bitrate Analyzer] Auto profile: Estimated source: ${(estimatedBitrate / 1000000).toFixed(2)} Mbps. Output profile matched: ${finalVideoBitrate / 1000000} Mbps.`,
        );
      } else {
        finalVideoBitrate = 8000000; // fallback high quality
        onLog(
          `[Bitrate Analyzer] Auto profile: Source file unreadable. Defaulting to high quality profile: 8.00 Mbps.`,
        );
      }

      // Set up offscreen compositing canvas
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        throw new Error("Failed to create 2D canvas context");
      }

      // 2. Load watermarks/logos
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

      // 3. Create offscreen playback element
      const exportVid = document.createElement("video");
      exportVid.src = videoUrl;
      exportVid.muted = false;
      exportVid.playsInline = true;

      await new Promise<void>((resolve) => {
        exportVid.onloadedmetadata = () => resolve();
        exportVid.onerror = () => resolve();
      });

      onLog(translations.step2);

      // 4. Connect Audio Routing
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtxClass) {
        throw new Error("Web Audio API not supported in this environment.");
      }
      const audioCtx = new AudioCtxClass();
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      const dest = audioCtx.createMediaStreamDestination();
      let hasAudioNode = false;

      // Original video audio track
      let videoSource: MediaElementAudioSourceNode | null = null;
      let exportVideoGainNode: GainNode | null = null;
      try {
        videoSource = audioCtx.createMediaElementSource(exportVid);
        const videoGain = audioCtx.createGain();
        videoGain.gain.value = volume / 100;
        exportVideoGainNode = videoGain;
        videoSource.connect(videoGain);
        videoGain.connect(dest);

        const silentHardwareGain = audioCtx.createGain();
        silentHardwareGain.gain.value = 0.0;
        videoGain.connect(silentHardwareGain);
        silentHardwareGain.connect(audioCtx.destination);

        hasAudioNode = true;
      } catch (audioErr) {
        console.warn(
          "Original video does not contain accessible audio tracks:",
          audioErr,
        );
      }

      // Background audio overlay
      const bgAudioElements: {
        el: HTMLAudioElement;
        start: number;
        end: number;
        finished: boolean;
        trackTrimStart: number;
        gainNode?: GainNode;
      }[] = [];
      if (audioTracks && audioTracks.length > 0) {
        let accumulated = 0;
        for (const track of audioTracks) {
          try {
            const audioEl = document.createElement("audio");
            audioEl.src = track.url;
            audioEl.crossOrigin = "anonymous";
            const bgSource = audioCtx.createMediaElementSource(audioEl);
            const bgGain = audioCtx.createGain();
            bgGain.gain.value = track.volume / 100;
            bgSource.connect(bgGain);
            bgGain.connect(dest);

            const silentHardwareGain2 = audioCtx.createGain();
            silentHardwareGain2.gain.value = 0.0;
            bgGain.connect(silentHardwareGain2);
            silentHardwareGain2.connect(audioCtx.destination);

            const activeDuration = track.trimEnd - track.trimStart;
            bgAudioElements.push({
              el: audioEl,
              start: accumulated,
              end: accumulated + activeDuration,
              finished: false,
              trackTrimStart: track.trimStart,
              gainNode: bgGain,
            });
            accumulated += activeDuration;
            hasAudioNode = true;
          } catch (bgAudioErr) {
            console.error(
              "Failed to route background audio overlay:",
              bgAudioErr,
            );
          }
        }
      }

      // Intro audio overlay
      let introAudioEl: HTMLAudioElement | null = null;
      if (introSettings?.enabled && introSettings.audioUrl) {
        try {
          introAudioEl = document.createElement("audio");
          introAudioEl.src = introSettings.audioUrl;
          introAudioEl.crossOrigin = "anonymous";
          const introSource = audioCtx.createMediaElementSource(introAudioEl);
          const introGain = audioCtx.createGain();
          introGain.gain.value = introSettings.audioVolume / 100;
          introSource.connect(introGain);
          introGain.connect(dest);

          const silentHardwareGain3 = audioCtx.createGain();
          silentHardwareGain3.gain.value = 0.0;
          introGain.connect(silentHardwareGain3);
          silentHardwareGain3.connect(audioCtx.destination);
          hasAudioNode = true;
        } catch (introAudioErr) {
          console.error("Failed to route intro audio overlay:", introAudioErr);
        }
      }

      onLog(translations.step3);

      // 5. Capture canvas track and mix with audio destination
      const videoStream = canvas.captureStream(30); // 30fps
      const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

      if (hasAudioNode) {
        dest.stream.getAudioTracks().forEach((track) => tracks.push(track));
      }

      const outputStream = new MediaStream(tracks);

      // 6. Configure recording container format
      let options: MediaRecorderOptions = {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: finalVideoBitrate,
        audioBitsPerSecond: audioBitrate || 192000,
      };
      if (outputFormat === "mp4") {
        if (MediaRecorder.isTypeSupported("video/mp4;codecs=h264,aac")) {
          options = {
            mimeType: "video/mp4;codecs=h264,aac",
            videoBitsPerSecond: finalVideoBitrate,
            audioBitsPerSecond: audioBitrate || 192000,
          };
        } else if (MediaRecorder.isTypeSupported("video/mp4")) {
          options = {
            mimeType: "video/mp4",
            videoBitsPerSecond: finalVideoBitrate,
            audioBitsPerSecond: audioBitrate || 192000,
          };
        } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
          options = {
            mimeType: "video/webm;codecs=vp9",
            videoBitsPerSecond: finalVideoBitrate,
            audioBitsPerSecond: audioBitrate || 192000,
          };
        }
      }

      const recorder = new MediaRecorder(outputStream, options);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        onLog(translations.step4);
        const mimeType = outputFormat === "mp4" ? "video/mp4" : "video/webm";
        const blob = new Blob(chunks, { type: mimeType });

        onProgress(100);
        onLog(
          translations.exportSuccess(
            outputFormat.toUpperCase(),
            (blob.size / (1024 * 1024)).toFixed(2),
          ),
        );
        onSuccess(URL.createObjectURL(blob));

        audioCtx.close().catch((e) => console.warn(e));
      };

      // Set starting markers
      let currentSegIndex = 0;
      let completedDuration = 0;

      let isRenderingIntro = introSettings?.enabled || false;
      const introStartTime = performance.now();
      const introDurationSeconds = isRenderingIntro && introSettings
        ? introSettings.duration
        : 0;

      const finalDuration =
        videoSegments.reduce(
          (sum, s) => sum + Math.max(0, s.end - s.start),
          0,
        ) + introDurationSeconds;

      if (videoSegments.length > 0) {
        exportVid.currentTime = videoSegments[0].start;
      } else {
        exportVid.currentTime = 0;
      }

      await new Promise<void>((resolve) => {
        exportVid.onseeked = () => resolve();
      });

      // Start recording & playbacks
      recorder.start();

      if (isRenderingIntro) {
        if (introAudioEl) {
          introAudioEl.play().catch((e) => console.warn(e));
        }
      } else {
        await exportVid.play();
      }

      onLog(translations.renderingSeq);

      let animationId: number;
      let isSeekingSegment = false;

      const renderLoop = () => {
        if (isRenderingIntro && introSettings) {
          const elapsed = (performance.now() - introStartTime) / 1000;
          if (elapsed < introDurationSeconds) {
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            drawIntroOnContext(ctx, introSettings, elapsed, w, h);

            onProgress(Math.round((elapsed / finalDuration) * 100));
            animationId = requestAnimationFrame(renderLoop);
            return;
          } else {
            isRenderingIntro = false;
            if (introAudioEl) introAudioEl.pause();
            exportVid.play().catch((e) => console.warn(e));
          }
        }

        if (videoSegments.length === 0) {
          exportVid.pause();
          recorder.stop();
          return;
        }

        let currentSeg = videoSegments[currentSegIndex];
        const currentOriginalTime = exportVid.currentTime;

        // Auto transition to next segment
        if (currentOriginalTime >= currentSeg.end || exportVid.ended) {
          completedDuration += currentSeg.end - currentSeg.start;
          currentSegIndex++;
          if (currentSegIndex >= videoSegments.length) {
            exportVid.pause();
            bgAudioElements.forEach((bg) => {
              if (!bg.el.paused) bg.el.pause();
            });
            recorder.stop();
            cancelAnimationFrame(animationId);
            return;
          } else {
            currentSeg = videoSegments[currentSegIndex];
            isSeekingSegment = true;
            exportVid.pause();
            exportVid.currentTime = currentSeg.start;
            exportVid.onseeked = () => {
              isSeekingSegment = false;
              exportVid.play().catch((e) => console.warn(e));
            };
            // Return early on this frame to let seek complete
            bgAudioElements.forEach((bg) => {
              if (!bg.el.paused) bg.el.pause();
            });
            animationId = requestAnimationFrame(renderLoop);
            return;
          }
        }

        if (isSeekingSegment) {
          animationId = requestAnimationFrame(renderLoop);
          return;
        }

        // 1. Calculate transition fade opacity for exported frame
        let transitionFadeOpacity = 0;
        if (videoSegments.length > 1) {
          const seg = videoSegments[currentSegIndex];
          const segDuration = seg.end - seg.start;
          const userTransitionDuration = config.transitionDuration ?? 1;
          const activeFadeDuration = Math.min(userTransitionDuration / 2, segDuration / 2);

          if (currentSegIndex > 0 && exportVid.currentTime < seg.start + activeFadeDuration) {
            const progress = (exportVid.currentTime - seg.start) / activeFadeDuration;
            transitionFadeOpacity = Math.max(0, Math.min(1, 1 - progress));
          } else if (currentSegIndex < videoSegments.length - 1 && exportVid.currentTime > seg.end - activeFadeDuration) {
            const progress = (seg.end - exportVid.currentTime) / activeFadeDuration;
            transitionFadeOpacity = Math.max(0, Math.min(1, 1 - progress));
          }
        }

        // 2. Adjust volume of primary video element dynamically
        const currentVideoVolume = (volume / 100) * (1 - transitionFadeOpacity);
        if (exportVideoGainNode) {
          exportVideoGainNode.gain.value = Math.max(0, Math.min(1.0, currentVideoVolume));
        } else {
          exportVid.volume = Math.max(0, Math.min(1.0, currentVideoVolume));
        }

        // Draw video frame with optional zoom & pan (Dynamic Focus)
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        const zoom = getZoomAtTime(zoomRegions || [], exportVid.currentTime);
        if (zoom.scale > 1.0) {
          const focusX = canvas.width * (zoom.panX / 100);
          const focusY = canvas.height * (zoom.panY / 100);
          ctx.translate(focusX, focusY);
          ctx.scale(zoom.scale, zoom.scale);
          ctx.translate(-focusX, -focusY);
        }

        const activeFilterStyle = getAppliedFiltersCSSAtTime(
          appliedFilters || [],
          exportVid.currentTime,
        );
        ctx.filter = activeFilterStyle;
        ctx.drawImage(exportVid, 0, 0, canvas.width, canvas.height);
        ctx.filter = "none";

        // Draw drawing annotations dynamically based on current original video time
        drawStrokesOnContext(
          ctx,
          strokes,
          exportVid.currentTime,
          canvas.width,
          canvas.height,
          videoWidth,
          videoHeight,
        );

        ctx.restore();

        // 3. Draw visual transition overlay (fade out to black and fade in from black)
        if (transitionFadeOpacity > 0) {
          ctx.save();
          ctx.fillStyle = "black";
          ctx.globalAlpha = transitionFadeOpacity;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
        }

        // Manage background audio files relative to virtual time with volume fading
        const vidTime =
          completedDuration +
          Math.max(0, exportVid.currentTime - currentSeg.start);
        for (const bg of bgAudioElements) {
          if (vidTime >= bg.start && vidTime < bg.end) {
            // Adjust volume of background audio element based on transition fade
            const matchingTrack = audioTracks.find(t => t.url === bg.el.src) || { volume: 25 };
            const bgTrackVolume = (matchingTrack.volume / 100) * (1 - transitionFadeOpacity);
            if (bg.gainNode) {
              bg.gainNode.gain.value = Math.max(0, Math.min(1.0, bgTrackVolume));
            } else {
              bg.el.volume = Math.max(0, Math.min(1.0, bgTrackVolume));
            }

            if (bg.el.paused && !bg.finished) {
              const targetTime = bg.trackTrimStart + (vidTime - bg.start);
              if (Math.abs(bg.el.currentTime - targetTime) > 0.3) {
                bg.el.currentTime = targetTime;
              }
              bg.el.play().catch(() => void 0);
            }
          } else {
            if (!bg.el.paused) {
              bg.el.pause();
            }
            if (vidTime >= bg.end) {
              bg.finished = true;
            }
          }
        }

        // Draw watermark
        if (logoLoaded) {
          const margin = canvas.width * 0.03;
          const logoW = canvas.width * (logoSize / 100);
          const logoH = logoImg.height * (logoW / logoImg.width);

          let logoX = canvas.width - logoW - margin;
          let logoY = margin;

          if (logoPosition === "top-left") {
            logoX = margin;
            logoY = margin;
          } else if (logoPosition === "top-right") {
            logoX = canvas.width - logoW - margin;
            logoY = margin;
          } else if (logoPosition === "bottom-left") {
            logoX = margin;
            logoY = canvas.height - logoH - margin;
          } else if (logoPosition === "bottom-right") {
            logoX = canvas.width - logoW - margin;
            logoY = canvas.height - logoH - margin;
          }

          ctx.save();
          ctx.globalAlpha = logoOpacity / 100;
          ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
          ctx.restore();
        }

        // Progress based on total virtual duration
        const pct = Math.min(
          99,
          Math.max(
            0,
            Math.round(
              ((vidTime + introDurationSeconds) / (finalDuration || 1)) * 100,
            ),
          ),
        );
        onProgress(pct);

        animationId = requestAnimationFrame(renderLoop);
      };

      animationId = requestAnimationFrame(renderLoop);
    } catch (e) {
      onError(e);
    }
  }
}
