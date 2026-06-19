import { Component, input, output, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { VIDEO_FILTERS } from './filters.types';
import { AppTranslations } from '../core/translations';

@Component({
  selector: 'app-video-filters',
  imports: [MatIconModule],
  template: `
    <!-- Video Filters Section -->
    <div class="flex flex-col gap-3">
      <!-- Accordion Header -->
      <button (click)="toggleExpand()"
              type="button"
              class="flex items-center justify-between w-full cursor-pointer text-left focus:outline-none group p-3 rounded-xl border border-white/5 hover:border-white/10 bg-neutral-950/50 transition-colors">
        <div class="flex items-center">
          <span class="text-sm font-medium text-neutral-300">
            {{ translations().videoFilters }}
          </span>
        </div>
        <mat-icon class="text-neutral-500 group-hover:text-neutral-300 transition-colors" style="font-size: 20px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
          {{ isExpanded() ? 'expand_less' : 'expand_more' }}
        </mat-icon>
      </button>
      
      <!-- Collapsible region -->
      @if (isExpanded()) {
        <div class="p-3.5 rounded-xl bg-neutral-950/45 border border-white/5 flex flex-col gap-3 animate-fade-in">
          <p class="text-[10px] text-neutral-500 leading-normal">
            {{ lang() === 'vi' 
              ? 'Nhấp vào một hiệu ứng dưới đây để áp dụng vào thời điểm hiện tại của video trên dòng thời gian.' 
              : "Click on a preset below to apply the filter at the video's current playback time." 
            }}
          </p>
          <div class="grid grid-cols-2 gap-2">
            @for (f of videoFiltersList; track f.id) {
              @if (f.id !== 'none') {
                <button (click)="onSelectFilter(f.id)"
                        class="p-2.5 rounded-xl border border-white/5 cursor-pointer text-center bg-neutral-900 text-neutral-300 transition-all hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 flex flex-col items-center justify-center gap-1 group"
                        style="min-height: 48px;">
                  <span class="text-[11px] font-medium leading-tight select-none truncate max-w-full">
                    {{ lang() === 'vi' ? f.nameVi : f.nameEn }}
                  </span>
                </button>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoFilters {
  lang = input<'vi' | 'en'>('vi');
  translations = input.required<AppTranslations>();
  filterSelected = output<string>();

  videoFiltersList = VIDEO_FILTERS;
  isExpanded = signal(false);

  toggleExpand() {
    this.isExpanded.update(val => !val);
  }

  onSelectFilter(id: string) {
    this.filterSelected.emit(id);
  }
}


