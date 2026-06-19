import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Stroke } from './stroke.types';
import { StrokePropertiesPanel } from './stroke-properties-panel';

@Component({
  selector: 'app-strokes-list',
  standalone: true,
  imports: [CommonModule, MatIconModule, DecimalPipe, StrokePropertiesPanel],
  template: `
    @if (strokes().length > 0) {
      <div class="p-5 rounded-2xl bg-neutral-900 border border-white/5 flex flex-col gap-4">
        <div class="flex items-center justify-between border-b border-white/10 pb-3">
          <span class="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
            <mat-icon class="text-red-400" style="font-size: 16px; width: 16px; height: 16px;">layers</mat-icon>
            {{ lang() === 'vi' ? 'Danh sách chú thích & Dòng thời gian' : 'Annotation Layers & Timeline' }}
          </span>
          <span class="text-[10px] bg-neutral-800 text-neutral-400 font-mono font-medium px-2 py-0.5 rounded-full">
            {{ strokes().length }} {{ lang() === 'vi' ? 'mục' : 'items' }}
          </span>
        </div>

        <!-- List of annotation layers -->
        <div class="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
          @for (stroke of strokes(); track stroke.id) {
            <div class="flex items-center justify-between p-3 rounded-xl border transition-all text-xs select-none"
                 [class.bg-red-500/10]="activeStrokeId() === stroke.id"
                 [class.border-red-500/30]="activeStrokeId() === stroke.id"
                 [class.bg-neutral-950/40]="activeStrokeId() === stroke.id"
                 [class.border-white/5]="activeStrokeId() !== stroke.id">
              
              <!-- Info Left side -->
              <button type="button" class="flex items-center gap-3 text-left flex-1 cursor-pointer"
                      (click)="onStrokeClick(stroke.id, stroke.startTime)">
                <!-- Dot showing color of stroke -->
                <span class="w-2.5 h-2.5 rounded-full border border-neutral-950/40 shrink-0" [style.background-color]="stroke.color"></span>
                
                <div class="flex flex-col gap-0.5">
                  <span class="font-semibold text-neutral-300">
                    {{ getStrokeTypeName(stroke.type) }}
                  </span>
                  <span class="text-[10px] font-mono text-neutral-500">
                    {{ lang() === 'vi' ? 'Bắt đầu' : 'Start' }}: {{ formatTimeShort(stroke.startTime) }} | {{ lang() === 'vi' ? 'Thời lượng' : 'Duration' }}: {{ stroke.duration.toFixed(1) }}s
                  </span>
                </div>
              </button>

              <!-- Control actions -->
              <div class="flex items-center gap-2 shrink-0">
                <button type="button" (click)="deleteStroke.emit(stroke.id)" 
                        class="p-1 px-2.5 rounded-lg bg-neutral-950/80 border border-white/5 hover:bg-red-500/10 hover:text-red-400 text-neutral-400 hover:border-red-500/20 transition-all cursor-pointer"
                        title="Xóa chú thích">
                  <mat-icon style="font-size: 14px; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;">delete</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>

        <!-- Selected annotation fine-tuning controls -->
        @if (currentActiveStroke(); as activeStrokeItem) {
          <app-stroke-properties-panel
            [activeStrokeItem]="activeStrokeItem"
            [videoDuration]="videoDuration()"
            [lang]="lang()"
            (updateStartTime)="updateStrokeStartTime.emit($event)"
            (updateDuration)="updateStrokeDuration.emit($event)"
            (updateText)="updateStrokeText.emit($event)"
            (updateFontSize)="updateStrokeFontSize.emit($event)">
          </app-stroke-properties-panel>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppStrokesList {
  strokes = input.required<Stroke[]>();
  activeStrokeId = input<string | null>(null);
  videoDuration = input<number>(0);
  lang = input<string>('vi');
  currentActiveStroke = input<Stroke | null>(null);

  // Outputs
  activeStrokeIdSet = output<string>();
  seekTo = output<number>();
  deleteStroke = output<string>();
  updateStrokeStartTime = output<{id: string, value: number}>();
  updateStrokeDuration = output<{id: string, value: number}>();
  updateStrokeText = output<{id: string, value: string}>();
  updateStrokeFontSize = output<{id: string, value: number}>();

  onStrokeClick(id: string, startTime: number) {
    this.activeStrokeIdSet.emit(id);
    this.seekTo.emit(startTime);
  }

  getStrokeTypeName(type: string): string {
    const isVi = this.lang() === 'vi';
    switch (type) {
      case 'pen': return isVi ? 'Vẽ tay' : 'Freehand Pen';
      case 'arrow': return isVi ? 'Mũi tên' : 'Arrow';
      case 'rect': return isVi ? 'Hình chữ nhật' : 'Rectangle';
      case 'circle': return isVi ? 'Hình tròn' : 'Circle';
      case 'line': return isVi ? 'Đường thẳng' : 'Line';
      case 'text': return isVi ? 'Văn bản' : 'Text';
      default: return type;
    }
  }

  formatTimeShort(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
}
