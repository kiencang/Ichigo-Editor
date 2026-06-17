import { Injectable, signal, computed } from '@angular/core';
import { Stroke, drawStrokesOnContext } from './stroke.types';

@Injectable({
  providedIn: 'root'
})
export class CanvasDrawer {
  currentTool = signal<'pointer' | 'pen' | 'arrow'>('pointer');
  color = signal<string>('#ef4444'); // Tailwind red-500
  strokes = signal<Stroke[]>([]);
  activeStrokeId = signal<string | null>(null);
  
  currentActiveStroke = computed(() => {
    const id = this.activeStrokeId();
    if (!id) return null;
    return this.strokes().find(s => s.id === id) || null;
  });

  ctx: CanvasRenderingContext2D | null = null;
  canvasEl: HTMLCanvasElement | null = null;

  private isPointerDown = false;
  private lastPos = { x: 0, y: 0 };
  private startPos = { x: 0, y: 0 };
  private activeStroke: Stroke | null = null;

  init(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.canvasEl = canvas;
    this.ctx = ctx;
  }

  getMousePos(canvas: HTMLCanvasElement, e: MouseEvent | TouchEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  redrawCanvas(videoWidth: number, videoHeight: number, currentTime: number) {
    if (!this.ctx || !this.canvasEl) return;
    const canvas = this.canvasEl;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawStrokesOnContext(
      this.ctx,
      this.strokes(),
      currentTime,
      canvas.width,
      canvas.height,
      videoWidth,
      videoHeight
    );
  }

  onPointerDown(e: MouseEvent | TouchEvent, videoWidth: number, currentTime: number) {
    if (this.currentTool() === 'pointer' || !this.ctx || !this.canvasEl) return;
    this.isPointerDown = true;
    const pos = this.getMousePos(this.canvasEl, e);
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
      lineWidth: Math.max(5, videoWidth * 0.005),
      startTime: currentTime,
      duration: 3.0 // default 3s as requested
    };
    
    // Auto select this keyframe
    this.activeStrokeId.set(strokeId);
  }

  onPointerMove(e: MouseEvent | TouchEvent, currentTime: number, videoWidth: number, videoHeight: number) {
    if (!this.isPointerDown || !this.ctx || this.currentTool() === 'pointer' || !this.activeStroke || !this.canvasEl) return;
    
    const pos = this.getMousePos(this.canvasEl, e);
    
    if (this.activeStroke.type === 'pen') {
      this.activeStroke.points.push(pos);
    } else if (this.activeStroke.type === 'arrow') {
      this.activeStroke.endPos = pos;
    }
    
    // Live composition render inside drawing phase:
    // 1. Draw already completed strokes
    this.redrawCanvas(videoWidth, videoHeight, currentTime);
    
    // 2. Overlay current active live stroke
    const canvas = this.canvasEl;
    drawStrokesOnContext(
      this.ctx,
      [this.activeStroke],
      currentTime,
      canvas.width,
      canvas.height,
      videoWidth,
      videoHeight
    );
  }

  onPointerUp(videoWidth: number, videoHeight: number, currentTime: number) {
    if (this.isPointerDown && this.activeStroke) {
      this.strokes.update(s => [...s, this.activeStroke!]);
      this.activeStroke = null;
      this.redrawCanvas(videoWidth, videoHeight, currentTime);
    }
    this.isPointerDown = false;
  }

  clearCanvas() {
    this.strokes.set([]);
    this.activeStrokeId.set(null);
    if (this.ctx && this.canvasEl) {
      this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
    }
  }

  deleteStroke(id: string, videoWidth: number, videoHeight: number, currentTime: number) {
    this.strokes.update(all => all.filter(s => s.id !== id));
    if (this.activeStrokeId() === id) {
      this.activeStrokeId.set(null);
    }
    this.redrawCanvas(videoWidth, videoHeight, currentTime);
  }

  updateStrokeStartTime(id: string, newTime: number, videoDuration: number, videoWidth: number, videoHeight: number, currentTime: number) {
    const validTime = Math.max(0, Math.min(videoDuration, Number(newTime)));
    this.strokes.update(all => all.map(s => s.id === id ? { ...s, startTime: validTime } : s));
    this.redrawCanvas(videoWidth, videoHeight, currentTime);
  }

  updateStrokeDuration(id: string, newDuration: number, videoWidth: number, videoHeight: number, currentTime: number) {
    const validDur = Math.max(0.1, Number(newDuration));
    this.strokes.update(all => all.map(s => s.id === id ? { ...s, duration: validDur } : s));
    this.redrawCanvas(videoWidth, videoHeight, currentTime);
  }
}
