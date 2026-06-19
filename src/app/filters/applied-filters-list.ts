import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AppliedFilter, VIDEO_FILTERS } from './filters.types';
import { AppTranslations } from '../core/translations';

@Component({
  selector: 'app-applied-filters-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, DecimalPipe],
  template: `
    @if (appliedFilters().length > 0) {
      <div class="p-5 rounded-2xl bg-neutral-900 border border-white/5 flex flex-col gap-4">
        <div class="flex items-center justify-between border-b border-white/10 pb-3">
          <span class="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
            <mat-icon class="text-red-400" style="font-size: 16px; width: 16px; height: 16px;">filter_b_and_w</mat-icon>
            {{ lang() === 'vi' ? 'Danh sách hiệu ứng màu & Dòng thời gian' : 'Video Filter Layers & Timeline' }}
          </span>
          <span class="text-[10px] bg-neutral-800 text-neutral-400 font-mono font-medium px-2 py-0.5 rounded-full">
            {{ appliedFilters().length }} {{ lang() === 'vi' ? 'mục' : 'items' }}
          </span>
        </div>

        <!-- List of applied filter layers -->
        <div class="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
          @for (filter of appliedFilters(); track filter.id) {
            <div class="flex flex-col gap-2 shrink-0">
              <div class="flex items-center justify-between p-3 rounded-xl border transition-all text-xs select-none"
                   [class.bg-red-500/10]="activeFilterId() === filter.id"
                   [class.border-red-500/30]="activeFilterId() === filter.id"
                   [class.bg-neutral-950/40]="activeFilterId() !== filter.id"
                   [class.border-white/5]="activeFilterId() !== filter.id">
                
                <!-- Info Left side -->
                <button type="button" class="flex items-center gap-3 text-left flex-1 cursor-pointer"
                        (click)="onFilterClick(filter.id, filter.startTime)">
                  <mat-icon class="text-neutral-400" style="font-size: 16px; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;">movie_filter</mat-icon>
                  
                  <div class="flex flex-col gap-0.5">
                    <span class="font-semibold text-neutral-300">
                      {{ getFilterPresetName(filter.presetId) }}
                    </span>
                    <span class="text-[10px] font-mono text-neutral-500">
                      {{ lang() === 'vi' ? 'Bắt đầu' : 'Start' }}: {{ formatTimeShort(filter.startTime) }} | {{ lang() === 'vi' ? 'Thời lượng' : 'Duration' }}: {{ filter.duration.toFixed(1) }}s | {{ lang() === 'vi' ? 'Cường độ' : 'Intensity' }}: {{ filter.intensity }}%
                    </span>
                  </div>
                </button>

                <!-- Control actions -->
                <div class="flex items-center gap-2 shrink-0">
                  <button type="button" (click)="deleteAppliedFilter.emit(filter.id)" 
                          class="p-1 px-2.5 rounded-lg bg-neutral-950/80 border border-white/5 hover:bg-red-500/10 hover:text-red-400 text-neutral-400 hover:border-red-500/20 transition-all cursor-pointer"
                          [attr.title]="lang() === 'vi' ? 'Xóa bộ lọc' : 'Delete filter'">
                    <mat-icon style="font-size: 14px; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;">delete</mat-icon>
                  </button>
                </div>
              </div>

              <!-- Conditionally render properties tuner for THIS filter right here -->
              @if (activeFilterId() === filter.id) {
                <div class="p-3.5 rounded-xl bg-neutral-950 border border-red-500/20 flex flex-col gap-3.5 animate-fade-in mb-2 mx-0.5">
                  <div class="text-xs font-semibold text-neutral-250 flex items-center justify-between">
                    <span class="flex items-center gap-1.5 font-medium text-neutral-300">
                      <mat-icon class="text-red-400" style="font-size: 14px; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;">tune</mat-icon>
                      {{ lang() === 'vi' ? 'Thiết lập hiệu ứng đang chọn' : 'Properties of Selected Video Filter' }}
                    </span>
                    <span class="text-[9px] bg-red-400/10 text-red-300 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                      {{ filter.presetId }}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <!-- Start time adjustment -->
                    <div class="flex flex-col gap-1.5">
                      <div class="text-[10px] font-medium text-neutral-400 flex justify-between">
                        <span>{{ lang() === 'vi' ? 'Thời điểm xuất hiện' : 'Start Time' }}</span>
                        <span class="font-mono text-neutral-300">{{ filter.startTime.toFixed(2) }}s / {{ formatTimeShort(videoDuration()) }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <input type="range" 
                               [ngModel]="filter.startTime" 
                               (ngModelChange)="onStartTimeChange(filter.id, $event)" 
                               [min]="0" 
                               [max]="videoDuration()" 
                               step="0.05"
                               class="flex-1 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                               title="Start Time Slider">
                        <input type="number" 
                               [ngModel]="filter.startTime" 
                               (ngModelChange)="onStartTimeChange(filter.id, $event)" 
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
                        <span>{{ lang() === 'vi' ? 'Thời lượng hiển thị / giây' : 'Display Duration / sec' }}</span>
                        <span class="font-mono text-neutral-300">{{ filter.duration.toFixed(1) }}s / {{ formatTimeShort(videoDuration()) }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <input type="range" 
                               [ngModel]="filter.duration" 
                               (ngModelChange)="onDurationChange(filter.id, $event)" 
                               [min]="0.1" 
                               [max]="videoDuration()" 
                               step="0.1"
                               class="flex-1 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                               title="Display Duration Slider">
                        <input type="number" 
                               [ngModel]="filter.duration" 
                               (ngModelChange)="onDurationChange(filter.id, $event)" 
                               [min]="0.1" 
                               [max]="videoDuration()" 
                               step="0.1"
                               class="w-16 px-1.5 py-0.5 bg-neutral-900 border border-white/10 rounded text-neutral-200 text-center font-mono text-[11px]"
                               title="Duration Input">
                      </div>
                    </div>

                    <!-- Intensity Adjustment -->
                    <div class="flex flex-col gap-1.5 md:col-span-2">
                      <div class="text-[10px] font-medium text-neutral-400 flex justify-between">
                        <span>{{ translations().filterIntensity }}</span>
                        <span class="font-mono text-neutral-300">{{ filter.intensity }}%</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <input type="range" 
                               [ngModel]="filter.intensity" 
                               (ngModelChange)="onIntensityChange(filter.id, $event)" 
                               [min]="10" 
                               [max]="100" 
                               step="1"
                               class="flex-1 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                               title="Intensity Slider">
                        <input type="number" 
                               [ngModel]="filter.intensity" 
                               (ngModelChange)="onIntensityChange(filter.id, $event)" 
                               [min]="10" 
                               [max]="100" 
                               step="1"
                               class="w-16 px-1.5 py-0.5 bg-neutral-900 border border-white/10 rounded text-neutral-200 text-center font-mono text-[11px]"
                               title="Intensity Input">
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppAppliedFiltersList {
  appliedFilters = input.required<AppliedFilter[]>();
  activeFilterId = input<string | null>(null);
  videoDuration = input<number>(0);
  lang = input<string>('vi');
  translations = input.required<AppTranslations>();

  // Outputs
  activeFilterIdSet = output<string>();
  seekTo = output<number>();
  deleteAppliedFilter = output<string>();
  updateFilterStartTime = output<{id: string, value: number}>();
  updateFilterDuration = output<{id: string, value: number}>();
  updateFilterIntensity = output<{id: string, value: number}>();

  onFilterClick(id: string, startTime: number) {
    this.activeFilterIdSet.emit(id);
    this.seekTo.emit(startTime);
  }

  onStartTimeChange(id: string, val: string | number) {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (!isNaN(num)) {
      this.updateFilterStartTime.emit({ id, value: num });
    }
  }

  onDurationChange(id: string, val: string | number) {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (!isNaN(num)) {
      this.updateFilterDuration.emit({ id, value: num });
    }
  }

  onIntensityChange(id: string, val: string | number) {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (!isNaN(num)) {
      this.updateFilterIntensity.emit({ id, value: num });
    }
  }

  getFilterPresetName(presetId: string): string {
    const isVi = this.lang() === 'vi';
    const filter = VIDEO_FILTERS.find(f => f.id === presetId);
    if (!filter) return isVi ? 'Gốc' : 'Original';
    return isVi ? filter.nameVi : filter.nameEn;
  }

  formatTimeShort(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
}
