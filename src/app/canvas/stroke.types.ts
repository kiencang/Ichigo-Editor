export type ToolType = 'pointer' | 'pen' | 'arrow' | 'rect' | 'circle' | 'line' | 'text';

export interface StrokePoint {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  type: 'pen' | 'arrow' | 'rect' | 'circle' | 'line' | 'text';
  points: StrokePoint[];
  startPos?: StrokePoint;
  endPos?: StrokePoint;
  color: string;
  lineWidth: number;
  startTime: number;
  duration: number; // Duration of appearance in seconds
  text?: string;
  fontSize?: number;
}

export function drawStrokesOnContext(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  time: number,
  canvasWidth: number,
  canvasHeight: number,
  originalWidth: number,
  originalHeight: number
) {
  if (!strokes || strokes.length === 0) return;

  const scaleX = originalWidth > 0 ? canvasWidth / originalWidth : 1;
  const scaleY = originalHeight > 0 ? canvasHeight / originalHeight : 1;
  
  const scalePoint = (p: StrokePoint) => ({
    x: p.x * scaleX,
    y: p.y * scaleY
  });

  const activeStrokes = strokes.filter(s => {
    return time >= s.startTime && time <= (s.startTime + s.duration);
  });

  for (const stroke of activeStrokes) {
    const strokeColor = stroke.color;
    const baseLineWidth = stroke.lineWidth || 5;
    const scaledLineWidth = baseLineWidth * scaleX;

    if (stroke.type === 'pen' && stroke.points.length > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = scaledLineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const p0 = scalePoint(stroke.points[0]);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < stroke.points.length; i++) {
        const p = scalePoint(stroke.points[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    } else if (stroke.type === 'arrow' && stroke.startPos && stroke.endPos) {
      const from = scalePoint(stroke.startPos);
      const to = scalePoint(stroke.endPos);
      
      const headlen = Math.max(15, canvasWidth * 0.025);
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = strokeColor;
      ctx.lineWidth = scaledLineWidth;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - headlen * Math.cos(angle - Math.PI / 6), to.y - headlen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(to.x - headlen * Math.cos(angle + Math.PI / 6), to.y - headlen * Math.sin(angle + Math.PI / 6));
      ctx.lineTo(to.x, to.y);
      ctx.fill();
    } else if (stroke.type === 'rect' && stroke.startPos && stroke.endPos) {
      const from = scalePoint(stroke.startPos);
      const to = scalePoint(stroke.endPos);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = scaledLineWidth;
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';
      ctx.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y);
    } else if (stroke.type === 'circle' && stroke.startPos && stroke.endPos) {
      const from = scalePoint(stroke.startPos);
      const to = scalePoint(stroke.endPos);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = scaledLineWidth;
      ctx.lineCap = 'round';
      
      const rx = Math.abs(to.x - from.x) / 2;
      const ry = Math.abs(to.y - from.y) / 2;
      const cx = (from.x + to.x) / 2;
      const cy = (from.y + to.y) / 2;
      
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (stroke.type === 'line' && stroke.startPos && stroke.endPos) {
      const from = scalePoint(stroke.startPos);
      const to = scalePoint(stroke.endPos);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = scaledLineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    } else if (stroke.type === 'text' && stroke.startPos) {
      const from = scalePoint(stroke.startPos);
      ctx.fillStyle = strokeColor;
      const scoreFontSize = stroke.fontSize || 24;
      const scaledFontSize = scoreFontSize * scaleX;
      ctx.font = `bold ${scaledFontSize}px sans-serif`;
      ctx.textBaseline = 'top';
      const txt = stroke.text || 'Text';
      ctx.fillText(txt, from.x, from.y);
    }
  }
}
