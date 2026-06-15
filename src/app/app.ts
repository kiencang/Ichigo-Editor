import {ChangeDetectionStrategy, Component, signal, computed, ViewChild, ElementRef, afterNextRender} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [FormsModule, DecimalPipe, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  lang = signal<'vi' | 'en'>('vi');

  setLang(l: 'vi' | 'en') {
    this.lang.set(l);
  }

  translations = computed(() => {
    const isVi = this.lang() === 'vi';
    return {
      appName: 'Ichigo Editor',
      selectVideo: isVi ? 'Chọn video để chỉnh sửa' : 'Select a video to edit',
      processDevice: isVi ? 'Video của bạn được xử lý hoàn toàn trên thiết bị của bạn. Không ghi nhận hoặc gửi bất kỳ dữ liệu nào lên máy chủ.' : 'Your video is processed entirely on your device. No data is uploaded to any server.',
      browseFiles: isVi ? 'Duyệt tệp tin' : 'Browse Files',
      selection: isVi ? 'Vùng chọn:' : 'Selection:',
      exportLength: isVi ? 'Độ dài xuất:' : 'Export duration:',
      annotationsLabel: isVi ? 'Chú thích:' : 'Annotations:',
      toolPointer: isVi ? 'Tương tác với video (Phát/Tạm dừng)' : 'Interact with video (Play/Pause)',
      toolPen: isVi ? 'Vẽ tay' : 'Freehand Draw',
      toolArrow: isVi ? 'Công cụ Mũi tên' : 'Arrow Tool',
      clear: isVi ? 'Xóa nét vẽ' : 'Clear',
      editorSettings: isVi ? 'Thiết lập ứng dụng' : 'Editor Settings',
      overlaysAudio: isVi ? 'Lớp phủ & Âm thanh' : 'Overlays & Audio',
      addBgAudio: isVi ? 'Thêm nhạc nền' : 'Add background audio',
      addWatermark: isVi ? 'Thêm hình mờ logo/watermark' : 'Add watermark logo',
      videoVolume: isVi ? 'Âm lượng video' : 'Video Volume',
      outputFormat: isVi ? 'Định dạng đầu ra' : 'Output Format',
      gifLimit: isVi ? ' (không dài hơn 60s)' : ' (not longer than 60s)',
      exportVideo: isVi ? 'Xuất Video' : 'Export Video',
      rendering: isVi ? 'Đang xuất' : 'Rendering',
      exportComplete: isVi ? 'Xuất Hoàn Tất' : 'Export Complete',
      downloadOutput: isVi ? 'Tải Xuống Kết Quả' : 'Download Output',
      errMaxSize: (maxMB: number, actualMB: string) => isVi 
        ? `Dung lượng video vượt quá giới hạn cho phép (Tối đa ${maxMB}MB. Tệp tin của bạn: ${actualMB}MB).` 
        : `Video file size exceeds the allowed limit (Maximum ${maxMB}MB. Your file: ${actualMB}MB).`,
      errMaxDuration: (maxMin: number, actualMin: string) => isVi 
        ? `Độ dài video vượt quá giới hạn cho phép (Tối đa ${maxMin} phút. Video của bạn: ${actualMin} phút).` 
        : `Video duration exceeds the allowed limit (Maximum ${maxMin} minutes. Your video: ${actualMin} minutes).`,
      msgInitSuccess: isVi 
        ? 'Ichigo Engine (Phiên bản V2 - Direct Pipeline Siêu Nhẹ) đã khởi tạo thành công.' 
        : 'Ichigo Engine (V2 - Ultra-Lightweight Direct Pipeline) initialized successfully.',
      msgFeatures: isVi 
        ? 'Tính năng hoạt động: Dòng thời gian không trễ, bộ tổng hợp khung hình canvas, bộ trộn âm thanh chính đa tuyến đa kênh.' 
        : 'Active features: Zero-latency timeline, frame-level canvas compositor, multi-track dynamic master mixer.',
      step1: isVi ? 'Bước 1/4: Phân tích cấu trúc video đầu vào & khởi tạo dòng bản ghi...' : 'Step 1/4: Analyzing input structure & initializing tracks...',
      step2: isVi ? 'Bước 2/4: Chuẩn bị định tuyến luồng âm thanh theo thời gian thực...' : 'Step 2/4: Preparing real-time audio routing matrix...',
      step3: isVi ? 'Bước 3/4: Khởi tạo bộ ghi đa luồng (Recording Muxer)...' : 'Step 3/4: Creating direct recording muxer stream...',
      step4: isVi ? 'Bước 4/4: Biên dịch gói nội dung & đóng gói định dạng container...' : 'Step 4/4: Package compilation & building container...',
      exportSuccess: (format: string, sizeMB: string) => isVi 
        ? `Xuất video thành công! Đã lưu dưới định dạng ${format} (${sizeMB} MB).` 
        : `Export completed successfully! Saved as ${format} (${sizeMB} MB).`,
      renderingSeq: isVi ? 'Đang hiển thị luồng video và xử lý các độ sâu hình ảnh...' : 'Rendering video sequence and compositing layers...',
      gifStep1: isVi ? 'Bước 1/3: Khởi tạo luồng ghép khung hình cho ảnh GIF động...' : 'Step 1/3: Initializing frame compositor for GIF rendering...',
      gifStep2: isVi ? 'Bước 2/3: Chụp các khung hình chính & lồng ghép các lớp vẽ chú thích...' : 'Step 2/3: Capturing keyframes and overlaying annotations...',
      gifStep3: isVi ? 'Bước 3/3: Tối ưu hóa bảng màu và nén thành tệp tin GIF động...' : 'Step 3/3: Processing palette optimization and file packaging...',
      gifSuccess: (sizeMB: string) => isVi 
        ? `Xuất ảnh GIF thành công! Đã lưu dưới định dạng ảnh động GIF chuyên dụng (${sizeMB} MB).` 
        : `GIF Export completed successfully! Saved as standard animated GIF (${sizeMB} MB).`,
    };
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
  
  audioFile = signal<File | null>(null);
  logoFile = signal<File | null>(null);
  
  currentTool = signal<'pointer' | 'pen' | 'arrow'>('pointer');
  color = signal<string>('#ef4444'); // Tailwind red-500
  
  outputUrl = signal<string | null>(null);

  currentTime = signal<number>(0);
  isPlaying = signal<boolean>(false);
  activeDrag = signal<'start' | 'end' | 'playhead' | null>(null);

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
    }
  }

  onAudioSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.audioFile.set(file);
    }
  }
  
  onLogoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.logoFile.set(file);
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
    if (isNaN(seconds) || seconds === null) return '00:00.0';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  }

  formatTimeShort(seconds: number): string {
    if (isNaN(seconds) || seconds === null) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
    }
    return `${secs}.${ms}s`;
  }

  togglePlay() {
    if (!this.videoEl) return;
    const video = this.videoEl.nativeElement;
    if (video.paused) {
      video.play().then(() => {
        this.isPlaying.set(true);
      }).catch(err => console.error(err));
    } else {
      video.pause();
      this.isPlaying.set(false);
    }
  }

  seekTo(seconds: number) {
    if (!this.videoEl) return;
    const video = this.videoEl.nativeElement;
    video.currentTime = Math.max(0, Math.min(this.videoDuration(), seconds));
    this.currentTime.set(video.currentTime);
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
      this.currentTime.set(this.videoEl.nativeElement.currentTime);
      this.isPlaying.set(!this.videoEl.nativeElement.paused);
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
    
    if (this.canvasEl) {
      this.canvasEl.nativeElement.width = video.videoWidth;
      this.canvasEl.nativeElement.height = video.videoHeight;
      this.ctx = this.canvasEl.nativeElement.getContext('2d', { willReadFrequently: true });
    }
  }

  // --- Canvas Drawing Logic ---
  
  getMousePos(e: MouseEvent | TouchEvent) {
    const el = this.canvasEl.nativeElement;
    const rect = el.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    
    const scaleX = el.width / rect.width;
    const scaleY = el.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  onPointerDown(e: MouseEvent | TouchEvent) {
    if (this.currentTool() === 'pointer' || !this.ctx) return;
    this.isPointerDown = true;
    this.startPos = this.getMousePos(e);
    this.lastPos = this.startPos;
    this.savedImageData = this.ctx.getImageData(0, 0, this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
  }

  onPointerMove(e: MouseEvent | TouchEvent) {
    if (!this.isPointerDown || !this.ctx || this.currentTool() === 'pointer') return;
    
    const pos = this.getMousePos(e);
    
    if (this.currentTool() === 'pen') {
      this.ctx.strokeStyle = this.color();
      this.ctx.lineWidth = Math.max(5, this.videoWidth() * 0.005);
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(this.lastPos.x, this.lastPos.y);
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
      this.lastPos = pos;
    } else if (this.currentTool() === 'arrow') {
      if (this.savedImageData) {
        this.ctx.putImageData(this.savedImageData, 0, 0);
      }
      this.drawArrow(this.startPos.x, this.startPos.y, pos.x, pos.y);
    }
  }

  drawArrow(fromX: number, fromY: number, toX: number, toY: number) {
    if (!this.ctx) return;
    const headlen = Math.max(20, this.videoWidth() * 0.02);
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    this.ctx.strokeStyle = this.color();
    this.ctx.fillStyle = this.color();
    this.ctx.lineWidth = Math.max(5, this.videoWidth() * 0.005);
    this.ctx.lineCap = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.stroke();
    
    this.ctx.beginPath();
    this.ctx.moveTo(toX, toY);
    this.ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    this.ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    this.ctx.lineTo(toX, toY);
    this.ctx.fill();
  }

  onPointerUp() {
    this.isPointerDown = false;
  }
  
  clearCanvas() {
    if (this.ctx && this.canvasEl) {
      this.ctx.clearRect(0, 0, this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
    }
  }

  // --- Rendering logic ---

  async exportVideo() {
    if (!this.isLoaded() || !this.videoFile()) return;
    if (this.outputFormat() === 'gif') {
      await this.exportGifDirect();
      return;
    }
    this.isProcessing.set(true);
    this.progress.set(0);
    this.logs.set([]);
    
    try {
      this.logs.update(l => [...l, this.translations().step1]);
      
      const vUrl = this.videoUrl();
      if (!vUrl) return;

      // 1. Set up high definition offscreen rendering canvas
      const canvas = document.createElement('canvas');
      canvas.width = this.videoWidth() || 1280;
      canvas.height = this.videoHeight() || 720;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Failed to create 2D canvas context');

      // 2. Load watermarks/logos if any
      const logoImg = new Image();
      let logoLoaded = false;
      if (this.logoFile()) {
        logoImg.src = URL.createObjectURL(this.logoFile()!);
        await new Promise<void>((resolve) => {
          logoImg.onload = () => {
            logoLoaded = true;
            resolve();
          };
          logoImg.onerror = () => resolve();
        });
      }

      // 3. Create offscreen playback element
      const exportVid = document.createElement('video');
      exportVid.src = vUrl;
      exportVid.muted = false;
      exportVid.playsInline = true;

      // Wait for offscreen video metadata
      await new Promise<void>((resolve) => {
        exportVid.onloadedmetadata = () => resolve();
        exportVid.onerror = () => resolve();
      });

      this.logs.update(l => [...l, this.translations().step2]);

      // 4. Connect Audio Routing
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      const dest = audioCtx.createMediaStreamDestination();
      let hasAudioNode = false;

      // Original video audio track
      let videoSource: MediaElementAudioSourceNode | null = null;
      try {
        videoSource = audioCtx.createMediaElementSource(exportVid);
        const videoGain = audioCtx.createGain();
        videoGain.gain.value = this.volume() / 100;
        videoSource.connect(videoGain);
        videoGain.connect(dest);

        // Silent hardware connection to force active Web Audio rendering clock on Chrome
        const silentHardwareGain = audioCtx.createGain();
        silentHardwareGain.gain.value = 0.0;
        videoGain.connect(silentHardwareGain);
        silentHardwareGain.connect(audioCtx.destination);

        hasAudioNode = true;
      } catch (audioErr) {
        console.warn('Original video does not contain an accessible audio channel:', audioErr);
      }

      // Background audio overlay
      let audioEl: HTMLAudioElement | null = null;
      if (this.audioFile()) {
        try {
          audioEl = document.createElement('audio');
          audioEl.src = URL.createObjectURL(this.audioFile()!);
          audioEl.crossOrigin = 'anonymous';
          const bgSource = audioCtx.createMediaElementSource(audioEl);
          const bgGain = audioCtx.createGain();
          bgGain.gain.value = 1.0;
          bgSource.connect(bgGain);
          bgGain.connect(dest);

          // Silent hardware connection to force active Web Audio rendering clock on Chrome
          const silentHardwareGain2 = audioCtx.createGain();
          silentHardwareGain2.gain.value = 0.0;
          bgGain.connect(silentHardwareGain2);
          silentHardwareGain2.connect(audioCtx.destination);

          hasAudioNode = true;
        } catch (bgAudioErr) {
          console.error('Failed to route background audio:', bgAudioErr);
        }
      }

      this.logs.update(l => [...l, this.translations().step3]);

      // 5. Capture canvas track and mix with audio destination
      const videoStream = canvas.captureStream(30); // 30fps stream
      const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

      if (hasAudioNode) {
        dest.stream.getAudioTracks().forEach(track => tracks.push(track));
      }

      const outputStream = new MediaStream(tracks);

      // 6. Configure recording container format
      let options = { mimeType: 'video/webm;codecs=vp9,opus' };
      const format = this.outputFormat();
      
      if (format === 'mp4') {
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac')) {
          options = { mimeType: 'video/mp4;codecs=h264,aac' };
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          options = { mimeType: 'video/mp4' };
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
          options = { mimeType: 'video/webm;codecs=vp9' };
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
        this.logs.update(l => [...l, this.translations().step4]);
        const mimeType = format === 'mp4' ? 'video/mp4' : (format === 'gif' ? 'image/gif' : 'video/webm');
        const blob = new Blob(chunks, { type: mimeType });
        
        if (this.outputUrl()) {
          URL.revokeObjectURL(this.outputUrl()!);
        }
        this.outputUrl.set(URL.createObjectURL(blob));
        
        this.isProcessing.set(false);
        this.progress.set(100);
        this.logs.update(l => [
          ...l, 
          this.translations().exportSuccess(format.toUpperCase(), (blob.size / (1024 * 1024)).toFixed(2))
        ]);
        
        // Clean up assets
        audioCtx.close();
      };

      // Set starting markers
      exportVid.currentTime = this.trimStart();
      await new Promise<void>((resolve) => {
        exportVid.onseeked = () => resolve();
      });

      // Start recording & playbacks
      recorder.start();
      await exportVid.play();
      if (audioEl) {
        await audioEl.play();
      }

      this.logs.update(l => [...l, this.translations().renderingSeq]);

      let animationId: number;
      const trimEndSec = Math.min(this.trimEnd(), this.videoDuration());

      const renderLoop = () => {
        if (exportVid.currentTime >= trimEndSec || exportVid.ended) {
          exportVid.pause();
          if (audioEl) audioEl.pause();
          recorder.stop();
          cancelAnimationFrame(animationId);
          return;
        }

        // Draw video frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(exportVid, 0, 0, canvas.width, canvas.height);

        // Draw drawing annotations
        ctx.drawImage(this.canvasEl.nativeElement, 0, 0, canvas.width, canvas.height);

        // Draw watermark
        if (logoLoaded) {
          const margin = 20;
          const logoW = canvas.width * 0.15;
          const logoH = logoImg.height * (logoW / logoImg.width);
          ctx.drawImage(logoImg, canvas.width - logoW - margin, margin, logoW, logoH);
        }

        // Output Progress
        const duration = trimEndSec - this.trimStart();
        const cur = exportVid.currentTime - this.trimStart();
        const pct = Math.min(99, Math.max(0, Math.round((cur / duration) * 100)));
        this.progress.set(pct);

        animationId = requestAnimationFrame(renderLoop);
      };

      animationId = requestAnimationFrame(renderLoop);

    } catch (e) {
      console.error(e);
      this.logs.update(l => [...l, `Rendering Pipeline Error: ${e}`]);
      this.isProcessing.set(false);
    }
  }

  async exportGifDirect() {
    this.isProcessing.set(true);
    this.progress.set(0);
    this.logs.set([]);
    
    try {
      this.logs.update(l => [...l, this.translations().gifStep1]);
      
      const vUrl = this.videoUrl();
      if (!vUrl) return;

      // Capping width to max 480px dynamically maintains aspect ratio for high performance GIFs
      const maxW = 480;
      const originalW = this.videoWidth() || 640;
      const originalH = this.videoHeight() || 360;
      const ratio = originalH / originalW;
      
      const gifWidth = Math.min(maxW, originalW);
      const gifHeight = Math.round(gifWidth * ratio);
      
      const gifCanvas = document.createElement('canvas');
      gifCanvas.width = gifWidth;
      gifCanvas.height = gifHeight;
      const gifCtx = gifCanvas.getContext('2d', { willReadFrequently: true });
      if (!gifCtx) throw new Error('Failed to create 2D canvas context for GIF');

      // Load watermark if any
      const logoImg = new Image();
      let logoLoaded = false;
      if (this.logoFile()) {
        logoImg.src = URL.createObjectURL(this.logoFile()!);
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
      exportVid.src = vUrl;
      exportVid.muted = true;
      exportVid.playsInline = true;

      await new Promise<void>((resolve) => {
        exportVid.onloadedmetadata = () => resolve();
        exportVid.onerror = () => resolve();
      });

      this.logs.update(l => [...l, this.translations().gifStep2]);

      // Sample frames sequentially with seeking (virtually zero lag and perfectly stable)
      const startTime = this.trimStart();
      const endTime = Math.min(this.trimEnd(), this.videoDuration());
      const duration = endTime - startTime;
      
      const frameRate = 10; // 10fps
      const frameStep = 1 / frameRate; // every 100ms
      const totalFrames = Math.max(1, Math.floor(duration / frameStep));
      
      const encoder = GIFEncoder();
      let renderedFrames = 0;
      
      for (let i = 0; i < totalFrames; i++) {
        const targetTime = startTime + (i * frameStep);
        exportVid.currentTime = targetTime;
        
        await new Promise<void>((resolve) => {
          exportVid.onseeked = () => resolve();
        });

        // Clear and draw combined layers
        gifCtx.clearRect(0, 0, gifWidth, gifHeight);
        gifCtx.drawImage(exportVid, 0, 0, gifWidth, gifHeight);
        gifCtx.drawImage(this.canvasEl.nativeElement, 0, 0, gifWidth, gifHeight);
        
        // Draw watermark logo
        if (logoLoaded) {
          const margin = 10;
          const logoW = gifWidth * 0.15;
          const logoH = logoImg.height * (logoW / logoImg.width);
          gifCtx.drawImage(logoImg, gifWidth - logoW - margin, margin, logoW, logoH);
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
        this.progress.set(progressPct);
      }

      this.logs.update(l => [...l, this.translations().gifStep3]);

      encoder.finish();
      const buffer = encoder.bytes();
      const blob = new Blob([buffer.buffer as ArrayBuffer], { type: 'image/gif' });

      if (this.outputUrl()) {
        URL.revokeObjectURL(this.outputUrl()!);
      }
      this.outputUrl.set(URL.createObjectURL(blob));
      
      this.isProcessing.set(false);
      this.progress.set(100);
      this.logs.update(l => [
        ...l, 
        this.translations().gifSuccess((blob.size / (1024 * 1024)).toFixed(2))
      ]);

    } catch (e) {
      console.error(e);
      this.logs.update(l => [...l, `GIF Exporting Error: ${e}`]);
      this.isProcessing.set(false);
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
}
