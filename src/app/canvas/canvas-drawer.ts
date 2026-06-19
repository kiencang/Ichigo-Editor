/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, signal, computed, inject } from "@angular/core";
import { Stroke } from "./stroke.types";
import { drawIntroOnContext } from "./intro-drawer";
import { EditorStateService } from "../core/editor-state.service";
import { VideoSegments } from "../segments/video-segments";
import { IntroSettings } from "../intro/intro.types";
import Konva from "konva";

@Injectable({
  providedIn: "root",
})
export class CanvasDrawer {
  private editorState = inject(EditorStateService);
  private videoSegmentsService = inject(VideoSegments);

  private get width() {
    return this.editorState.videoWidth();
  }
  private get height() {
    return this.editorState.videoHeight();
  }
  private get time() {
    return this.editorState.currentTime();
  }
  private get duration() {
    return this.videoSegmentsService.videoDuration();
  }

  currentTool = signal<
    "pointer" | "pen" | "arrow" | "rect" | "circle" | "line" | "text"
  >("pointer");
  color = signal<string>("#ef4444"); // Tailwind red-500
  strokes = signal<Stroke[]>([]);
  activeStrokeId = signal<string | null>(null);

  currentActiveStroke = computed(() => {
    const id = this.activeStrokeId();
    if (!id) return null;
    return this.strokes().find((s) => s.id === id) || null;
  });

  // Konva state fields
  containerEl: HTMLDivElement | null = null;
  stage: Konva.Stage | null = null;
  layer: Konva.Layer | null = null;
  transformer: Konva.Transformer | null = null;

  // Active drawing stroke
  private isPointerDown = false;
  private activeStroke: Stroke | null = null;

  init(container: HTMLDivElement) {
    this.containerEl = container;
    
    // Clear the container
    container.innerHTML = "";

    // Create the Konva Stage
    this.stage = new Konva.Stage({
      container: container,
      width: this.width || 800,
      height: this.height || 450,
    });

    this.layer = new Konva.Layer();
    this.stage.add(this.layer);

    // Create Transformer for editing/transforming shapes
    this.transformer = new Konva.Transformer({
      rotateEnabled: false,
      boundBoxFunc: (oldBox, newBox) => {
        // Prevent negative scaling/size representation
        if (newBox.width < 5 || newBox.height < 5) {
          return oldBox;
        }
        return newBox;
      },
    });
    this.layer.add(this.transformer);

    // Setup events for selection
    this.setupKonvaEvents();

    this.redrawCanvas();
  }

  // Get underlying native HTML Canvas element of the main Konva drawing layer
  getCanvasElement(): HTMLCanvasElement | null {
    return this.layer ? this.layer.getCanvas()._canvas : null;
  }

  // Get raw 2D rendering Context of the active layer for quick overlay drawing / intro
  get ctx(): CanvasRenderingContext2D | null {
    return this.layer ? (this.layer.getCanvas().getContext()._context as CanvasRenderingContext2D) : null;
  }

  // Get CSS target bounding dimensions of the parent wrapper
  getMousePos(
    container: HTMLElement,
    e: MouseEvent | TouchEvent
  ): { x: number; y: number } {
    const rect = container.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    const scaleX = (this.width || rect.width) / rect.width;
    const scaleY = (this.height || rect.height) / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // Setup click & tap interceptors to select and edit shapes
  private setupKonvaEvents() {
    if (!this.stage || !this.transformer) return;

    this.stage.on("click tap", (e) => {
      if (this.currentTool() !== "pointer") return;

      // Deselect if clicking on empty stage background
      if (e.target === this.stage) {
        this.deselectAll();
        return;
      }

      const clickedShape = e.target;
      const clickedGroupId = clickedShape.id();

      if (clickedGroupId) {
        this.selectStroke(clickedGroupId, clickedShape);
      }
    });
  }

  // Programmatic selection of a shape
  selectStroke(id: string, shapeNode?: Konva.Node) {
    if (!this.stage || !this.transformer) return;
    
    this.activeStrokeId.set(id);

    const node = shapeNode || this.layer?.findOne(`#${id}`);
    if (node) {
      node.draggable(true);
      this.transformer.nodes([node]);
      
      // Re-bind transform/drag end listeners to save properties back to signal
      node.off("dragend transformend");
      node.on("dragend transformend", () => {
        this.syncNodeToStroke(node);
      });

      this.stage.batchDraw();
    }
  }

  deselectAll() {
    this.activeStrokeId.set(null);
    if (this.transformer) {
      this.transformer.nodes([]);
    }
    if (this.layer) {
      this.layer.getChildren().forEach((node) => {
        if (node !== this.transformer) {
          node.draggable(false);
        }
      });
    }
    if (this.stage) {
      this.stage.batchDraw();
    }
  }

  getStageDataUrl(): string | null {
    if (!this.stage) return null;
    // Hide transformer temporarily for screenshot/image export
    const wasTransformerVisible = this.transformer?.nodes().length ? true : false;
    if (wasTransformerVisible) {
      this.transformer?.nodes([]);
      this.layer?.batchDraw();
    }
    const dataUrl = this.stage.toDataURL({ pixelRatio: 1.0 });
    if (wasTransformerVisible && this.activeStrokeId()) {
      const activeNode = this.layer?.findOne(`#${this.activeStrokeId()}`);
      if (activeNode) this.transformer?.nodes([activeNode]);
      this.layer?.batchDraw();
    }
    return dataUrl;
  }

  // Adjust Konva Stage size to its physical element container
  resizeToFit() {
    if (!this.stage || !this.containerEl) return;
    const rect = this.containerEl.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (w === 0 || h === 0) return;

    // Sizing match
    if (this.stage.width() !== w || this.stage.height() !== h) {
      this.stage.width(w);
      this.stage.height(h);

      const origW = this.width || 800;
      const origH = this.height || 450;
      this.stage.scale({
        x: w / origW,
        y: h / origH,
      });
      this.stage.batchDraw();
    }
  }

  redrawCanvas(intro?: { active: boolean; settings: IntroSettings; elapsed: number }) {
    if (!this.stage || !this.layer) return;

    // 1. Scale stage perfectly to HTML container overlay
    this.resizeToFit();

    // 2. Pure 2D intro drawing handles
    if (intro && intro.active && this.ctx) {
      // Clear children
      this.layer.destroyChildren();
      this.layer.batchDraw();

      // Render Intro using standard context draw
      this.ctx.clearRect(0, 0, this.stage.width(), this.stage.height());
      drawIntroOnContext(
        this.ctx,
        intro.settings,
        intro.elapsed,
        this.stage.width(),
        this.stage.height()
      );
      return;
    }

    // 3. Normal Active Strokes drawing
    // We clean up layer and rebuild current active strokes matching timeline
    const activeStrokesList = this.strokes().filter((s) => {
      return this.time >= s.startTime && this.time <= (s.startTime + s.duration);
    });

    const activeNodes: any[] = [];
    const restoredActiveNodeId = this.activeStrokeId();

    // Rebuild active shape elements in Konva
    for (const stroke of activeStrokesList) {
      let node: any = null;
      const isSelected = restoredActiveNodeId === stroke.id;

      if (stroke.type === "pen" && stroke.points.length > 0) {
        node = new Konva.Line({
          id: stroke.id,
          stroke: stroke.color,
          strokeWidth: stroke.lineWidth,
          lineCap: "round",
          lineJoin: "round",
          points: stroke.points.flatMap((p) => [p.x, p.y]),
          draggable: isSelected && this.currentTool() === "pointer",
        });
      } else if (stroke.type === "line" && stroke.startPos && stroke.endPos) {
        node = new Konva.Line({
          id: stroke.id,
          stroke: stroke.color,
          strokeWidth: stroke.lineWidth,
          lineCap: "round",
          points: [stroke.startPos.x, stroke.startPos.y, stroke.endPos.x, stroke.endPos.y],
          draggable: isSelected && this.currentTool() === "pointer",
        });
      } else if (stroke.type === "rect" && stroke.startPos && stroke.endPos) {
        node = new Konva.Rect({
          id: stroke.id,
          x: stroke.startPos.x,
          y: stroke.startPos.y,
          width: stroke.endPos.x - stroke.startPos.x,
          height: stroke.endPos.y - stroke.startPos.y,
          stroke: stroke.color,
          strokeWidth: stroke.lineWidth,
          draggable: isSelected && this.currentTool() === "pointer",
        });
      } else if (stroke.type === "circle" && stroke.startPos && stroke.endPos) {
        const rx = Math.abs(stroke.endPos.x - stroke.startPos.x) / 2;
        const ry = Math.abs(stroke.endPos.y - stroke.startPos.y) / 2;
        const cx = (stroke.startPos.x + stroke.endPos.x) / 2;
        const cy = (stroke.startPos.y + stroke.endPos.y) / 2;

        node = new Konva.Ellipse({
          id: stroke.id,
          x: cx,
          y: cy,
          radiusX: rx,
          radiusY: ry,
          stroke: stroke.color,
          strokeWidth: stroke.lineWidth,
          draggable: isSelected && this.currentTool() === "pointer",
        });
      } else if (stroke.type === "arrow" && stroke.startPos && stroke.endPos) {
        const baseWidth = stroke.lineWidth || 5;
        const pointerScale = Math.max(3, baseWidth * 0.8);

        node = new Konva.Arrow({
          id: stroke.id,
          points: [stroke.startPos.x, stroke.startPos.y, stroke.endPos.x, stroke.endPos.y],
          pointerLength: pointerScale * 3.5,
          pointerWidth: pointerScale * 3.5,
          fill: stroke.color,
          stroke: stroke.color,
          strokeWidth: stroke.lineWidth,
          draggable: isSelected && this.currentTool() === "pointer",
        });
      } else if (stroke.type === "text" && stroke.startPos) {
        node = new Konva.Text({
          id: stroke.id,
          x: stroke.startPos.x,
          y: stroke.startPos.y,
          text: stroke.text || "Text",
          fontSize: stroke.fontSize || 24,
          fontStyle: "bold",
          fontFamily: "sans-serif",
          fill: stroke.color,
          draggable: isSelected && this.currentTool() === "pointer",
        });
      }

      if (node) {
        activeNodes.push(node);
      }
    }

    // Clear old elements from Layer (except the Transformer)
    this.layer.getChildren().forEach((node) => {
      if (node !== this.transformer) {
        node.destroy();
      }
    });

    // Append newly constructed shapes in order
    activeNodes.forEach((node) => {
      this.layer!.add(node);
    });

    // Rebuild transformer reference
    if (this.transformer) {
      this.layer.add(this.transformer); // Make sure it sits on top of all shapes
      if (restoredActiveNodeId && this.currentTool() === "pointer") {
        const activeNode = this.layer.findOne(`#${restoredActiveNodeId}`);
        if (activeNode) {
          activeNode.draggable(true);
          this.transformer.nodes([activeNode]);
          activeNode.off("dragend transformend");
          activeNode.on("dragend transformend", () => {
            this.syncNodeToStroke(activeNode);
          });
        } else {
          this.transformer.nodes([]);
        }
      } else {
        this.transformer.nodes([]);
      }
    }

    this.stage.batchDraw();
  }

  // Handle active drawing on pointer drag movements
  onPointerDown(e: MouseEvent | TouchEvent) {
    if (this.currentTool() === "pointer" || !this.stage || !this.containerEl) return;
    this.isPointerDown = true;

    // Unselect any existing element
    this.deselectAll();

    // Get position in scale space
    const relativePos = this.getMousePos(this.containerEl, e);

    const strokeId = "stroke_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const tool = this.currentTool();

    this.activeStroke = {
      id: strokeId,
      type: tool as "pen" | "arrow" | "rect" | "circle" | "line" | "text",
      points: [relativePos],
      startPos: relativePos,
      endPos: relativePos,
      color: this.color(),
      lineWidth: Math.max(5, (this.width || 800) * 0.005),
      startTime: this.time,
      duration: 3.0,
      text: tool === "text" ? "Văn bản / Text" : undefined,
      fontSize: tool === "text" ? 24 : undefined,
    };

    this.activeStrokeId.set(strokeId);
    
    // Quick render of the temporary drawing state
    this.drawTempStroke(this.activeStroke);
  }

  onPointerMove(e: MouseEvent | TouchEvent) {
    if (!this.isPointerDown || !this.activeStroke || !this.containerEl) return;
    
    const relativePos = this.getMousePos(this.containerEl, e);

    if (this.activeStroke.type === "pen") {
      this.activeStroke.points.push(relativePos);
    } else {
      this.activeStroke.endPos = relativePos;
    }

    this.drawTempStroke(this.activeStroke);
  }

  onPointerUp() {
    if (this.isPointerDown && this.activeStroke) {
      this.strokes.update((s) => [...s, this.activeStroke!]);
      const lastId = this.activeStroke.id;
      this.activeStroke = null;
      this.isPointerDown = false;
      this.redrawCanvas();

      // Automatically select the newly created shape
      setTimeout(() => {
        if (this.currentTool() === "pointer") {
          this.activeStrokeId.set(lastId);
          this.redrawCanvas();
        }
      }, 50);
    }
    this.isPointerDown = false;
  }

  // Draw overlaying active shape during manual drawing gesture
  private drawTempStroke(stroke: Stroke) {
    if (!this.layer) return;

    // Rebuild canvas drawing
    this.redrawCanvas();

    // Add temporary drawing node
    let tempNode: any = null;
    if (stroke.type === "pen" && stroke.points.length > 0) {
      tempNode = new Konva.Line({
        stroke: stroke.color,
        strokeWidth: stroke.lineWidth,
        lineCap: "round",
        lineJoin: "round",
        points: stroke.points.flatMap((p) => [p.x, p.y]),
      });
    } else if (stroke.type === "line" && stroke.startPos && stroke.endPos) {
      tempNode = new Konva.Line({
        stroke: stroke.color,
        strokeWidth: stroke.lineWidth,
        lineCap: "round",
        points: [stroke.startPos.x, stroke.startPos.y, stroke.endPos.x, stroke.endPos.y],
      });
    } else if (stroke.type === "rect" && stroke.startPos && stroke.endPos) {
      tempNode = new Konva.Rect({
        x: stroke.startPos.x,
        y: stroke.startPos.y,
        width: stroke.endPos.x - stroke.startPos.x,
        height: stroke.endPos.y - stroke.startPos.y,
        stroke: stroke.color,
        strokeWidth: stroke.lineWidth,
      });
    } else if (stroke.type === "circle" && stroke.startPos && stroke.endPos) {
      const rx = Math.abs(stroke.endPos.x - stroke.startPos.x) / 2;
      const ry = Math.abs(stroke.endPos.y - stroke.startPos.y) / 2;
      const cx = (stroke.startPos.x + stroke.endPos.x) / 2;
      const cy = (stroke.startPos.y + stroke.endPos.y) / 2;

      tempNode = new Konva.Ellipse({
        x: cx,
        y: cy,
        radiusX: rx,
        radiusY: ry,
        stroke: stroke.color,
        strokeWidth: stroke.lineWidth,
      });
    } else if (stroke.type === "arrow" && stroke.startPos && stroke.endPos) {
      const baseWidth = stroke.lineWidth || 5;
      const pointerScale = Math.max(3, baseWidth * 0.8);

      tempNode = new Konva.Arrow({
        points: [stroke.startPos.x, stroke.startPos.y, stroke.endPos.x, stroke.endPos.y],
        pointerLength: pointerScale * 3.5,
        pointerWidth: pointerScale * 3.5,
        fill: stroke.color,
        stroke: stroke.color,
        strokeWidth: stroke.lineWidth,
      });
    } else if (stroke.type === "text" && stroke.startPos) {
      tempNode = new Konva.Text({
        x: stroke.startPos.x,
        y: stroke.startPos.y,
        text: stroke.text || "Text",
        fontSize: stroke.fontSize || 24,
        fontStyle: "bold",
        fontFamily: "sans-serif",
        fill: stroke.color,
      });
    }

    if (tempNode) {
      this.layer.add(tempNode);
      this.stage?.batchDraw();
    }
  }

  // Sync transformed / dragged Konva node back into structured strokes array
  syncNodeToStroke(node: Konva.Node) {
    const strokeId = node.id();
    const stroke = this.strokes().find((s) => s.id === strokeId);
    if (!stroke) return;

    this.strokes.update((all) =>
      all.map((s) => {
        if (s.id !== strokeId) return s;

        const updated = { ...s };
        if (s.type === "rect") {
          const nodeX = node.x();
          const nodeY = node.y();
          const nodeW = node.width() * node.scaleX();
          const nodeH = node.height() * node.scaleY();
          updated.startPos = { x: nodeX, y: nodeY };
          updated.endPos = { x: nodeX + nodeW, y: nodeY + nodeH };
        } else if (s.type === "circle") {
          const cx = node.x();
          const cy = node.y();
          const ellipseNode = node as Konva.Ellipse;
          const rx = ellipseNode.radiusX() * node.scaleX();
          const ry = ellipseNode.radiusY() * node.scaleY();
          updated.startPos = { x: cx - rx, y: cy - ry };
          updated.endPos = { x: cx + rx, y: cy + ry };
        } else if (s.type === "text") {
          const nodeX = node.x();
          const nodeY = node.y();
          const textNode = node as Konva.Text;
          const currentFontSize = textNode.fontSize() || 24;
          const scale = node.scaleX() || 1;
          const newFontSize = Math.max(6, Math.min(120, Math.round(currentFontSize * scale)));
          updated.startPos = { x: nodeX, y: nodeY };
          updated.fontSize = newFontSize;
        } else if (s.type === "line" || s.type === "arrow") {
          const dx = node.x();
          const dy = node.y();
          if (s.startPos && s.endPos) {
            updated.startPos = { x: s.startPos.x + dx, y: s.startPos.y + dy };
            updated.endPos = { x: s.endPos.x + dx, y: s.endPos.y + dy };
          }
        } else if (s.type === "pen") {
          const dx = node.x();
          const dy = node.y();
          updated.points = s.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        }
        return updated;
      })
    );

    this.redrawCanvas();
  }

  clearCanvas() {
    this.deselectAll();
    this.strokes.set([]);
    this.activeStrokeId.set(null);
    if (this.layer) {
      this.layer.getChildren().forEach((node) => {
        if (node !== this.transformer) {
          node.destroy();
        }
      });
      this.stage?.batchDraw();
    }
  }

  deleteStroke(id: string) {
    if (this.activeStrokeId() === id) {
      this.deselectAll();
    }
    this.strokes.update((all) => all.filter((s) => s.id !== id));
    this.redrawCanvas();
  }

  updateStrokeStartTime(id: string, newTime: number) {
    const validTime = Math.max(0, Math.min(this.duration, Number(newTime)));
    this.strokes.update((all) =>
      all.map((s) => (s.id === id ? { ...s, startTime: validTime } : s))
    );
    this.redrawCanvas();
  }

  updateStrokeDuration(id: string, newDuration: number) {
    const validDur = Math.max(0.1, Number(newDuration));
    this.strokes.update((all) =>
      all.map((s) => (s.id === id ? { ...s, duration: validDur } : s))
    );
    this.redrawCanvas();
  }

  updateStrokeText(id: string, newText: string) {
    this.strokes.update((all) =>
      all.map((s) => (s.id === id ? { ...s, text: newText } : s))
    );
    this.redrawCanvas();
  }

  updateStrokeFontSize(id: string, newFontSize: number) {
    const validSize = Math.max(6, Math.min(120, Number(newFontSize)));
    this.strokes.update((all) =>
      all.map((s) => (s.id === id ? { ...s, fontSize: validSize } : s))
    );
    this.redrawCanvas();
  }
}
