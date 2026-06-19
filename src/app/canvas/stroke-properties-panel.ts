import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Stroke } from './stroke.types';

@Component({
  selector: 'app-stroke-properties-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, DecimalPipe],
  template: `
    <div class="p-4 rounded-xl bg-neutral-950 border border-white/5 flex flex-col gap-4">
      <div class="text-xs font-semibold text-neutral-250 flex items-center justify-between">
        <span class="flex items-center gap-1.5 font-medium text-neutral-300">
          <mat-icon class="text-red-400" style="font-size: 14px; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;">edit</mat-icon>
          {{ lang() === 'vi' ? 'Thiết lập chú thích đang chọn' : 'Properties of Selected Annotation' }}
        </span>
        <span class="text-[9px] bg-red-400/10 text-red-300 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
          {{ getStrokeTypeName(activeStrokeItem().type) }}
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Start time adjustment -->
        <div class="flex flex-col gap-1.5">
          <div class="text-[10px] font-medium text-neutral-400 flex justify-between">
            <span>{{ lang() === 'vi' ? 'Thời điểm xuất hiện' : 'Start Time' }}</span>
            <span class="font-mono text-neutral-300">{{ activeStrokeItem().startTime.toFixed(2) }}s / {{ formatTimeShort(videoDuration()) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <input type="range" 
                   [ngModel]="activeStrokeItem().startTime" 
                   (ngModelChange)="onStartTimeChange($event)" 
                   [min]="0" 
                   [max]="videoDuration()" 
                   step="0.05"
                   class="flex-1 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                   title="Start Time Slider">
            <input type="number" 
                   [ngModel]="activeStrokeItem().startTime" 
                   (ngModelChange)="onStartTimeChange($event)" 
                   [min]="0" 
                   [max]="videoDuration()" 
                   step="0.1"
                   class="w-16 px-1.5 py-0.5 bg-neutral-900 border border-white/10 rounded text-neutral-200 text-center font-mono text-[11px]"
                   title="Start Time Input">
          </div>
        </div>

        <!-- Duration Adjustment -->
        <div class="flex flex-col gap-1.5">
          <div class="text-[10px] font-medium text-neutral-400 flex justify-between">
            <span>{{ lang() === 'vi' ? 'Thời lượng hiển thị' : 'Display Duration' }}</span>
            <span class="font-mono text-neutral-300">{{ activeStrokeItem().duration.toFixed(1) }}s</span>
          </div>
          <div class="flex items-center gap-2">
            <input type="range" 
                   [ngModel]="activeStrokeItem().duration" 
                   (ngModelChange)="onDurationChange($event)" 
                   [min]="0.5" 
                   [max]="10" 
                   step="0.1"
                   class="flex-1 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                   title="Display Duration Slider">
            <input type="number" 
                   [ngModel]="activeStrokeItem().duration" 
                   (ngModelChange)="onDurationChange($event)" 
                   [min]="0.1" 
                   [max]="60" 
                   step="0.5"
                   class="w-16 px-1.5 py-0.5 bg-neutral-900 border border-white/10 rounded text-neutral-200 text-center font-mono text-[11px]"
                   title="Duration Input">
          </div>
        </div>
      </div>

      @if (activeStrokeItem().type === 'text') {
        <div class="border-t border-white/5 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Input Text Content -->
          <div class="flex flex-col gap-1.5">
            <span class="text-[10px] font-medium text-neutral-400">{{ lang() === 'vi' ? 'Nội dung chữ' : 'Text Content' }}</span>
            <input type="text"
                   [ngModel]="activeStrokeItem().text"
                   (ngModelChange)="onTextChange($event)"
                   class="w-full px-3 py-1.5 bg-neutral-900 border border-white/10 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-red-500"
                   [placeholder]="lang() === 'vi' ? 'Nhập chữ...' : 'Type text...'">
          </div>

          <!-- Font Size Adjustment -->
          <div class="flex flex-col gap-1.5">
            <div class="text-[10px] font-medium text-neutral-400 flex justify-between">
              <span>{{ lang() === 'vi' ? 'Cỡ chữ' : 'Font Size' }}</span>
              <span class="font-mono text-neutral-300">{{ activeStrokeItem().fontSize || 24 }}px</span>
            </div>
            <div class="flex items-center gap-2">
              <input type="range" 
                     [ngModel]="activeStrokeItem().fontSize || 24" 
                     (ngModelChange)="onFontSizeChange($event)" 
                     [min]="10" 
                     [max]="80" 
                     step="1"
                     class="flex-1 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                     title="Font Size Slider">
              <input type="number" 
                     [ngModel]="activeStrokeItem().fontSize || 24" 
                     (ngModelChange)="onFontSizeChange($event)" 
                     [min]="6" 
                     [max]="120" 
                     step="1"
                     class="w-16 px-1.5 py-0.5 bg-neutral-900 border border-white/10 rounded text-neutral-200 text-center font-mono text-[11px]"
                     title="Font Size Input">
            </div>
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StrokePropertiesPanel {
  activeStrokeItem = input.required<Stroke>();
  videoDuration = input<number>(0);
  lang = input<string>('vi');

  // Outputs
  updateStartTime = output<{id: string, value: number}>();
  updateDuration = output<{id: string, value: number}>();
  updateText = output<{id: string, value: string}>();
  updateFontSize = output<{id: string, value: number}>();

  onStartTimeChange(val: string | number) {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (!isNaN(num)) {
      this.updateStartTime.emit({ id: this.activeStrokeItem().id, value: num });
    }
  }

  onDurationChange(val: string | number) {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (!isNaN(num)) {
      this.updateDuration.emit({ id: this.activeStrokeItem().id, value: num });
    }
  }

  onTextChange(val: string) {
    this.updateText.emit({ id: this.activeStrokeItem().id, value: val });
  }

  onFontSizeChange(val: string | number) {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (!isNaN(num)) {
      this.updateFontSize.emit({ id: this.activeStrokeItem().id, value: num });
    }
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
