import { Component, model, input, ChangeDetectionStrategy } from '@angular/core';
import { VIDEO_FILTERS } from './filters.types';
import { AppTranslations } from './translations';

@Component({
  selector: 'app-video-filters',
  template: `
    <!-- Video Filters Section -->
    <div class="flex flex-col gap-3">
      <span class="text-sm font-medium text-neutral-400">
        {{ translations().videoFilters }}
      </span>
      
      <div class="grid grid-cols-2 gap-2">
        @for (f of videoFiltersList; track f.id) {
          <button (click)="onSelectFilter(f.id)"
                  class="p-2 py-2.5 rounded-xl border cursor-pointer text-center transition-all flex flex-col items-center justify-center gap-1 group"
                  [class.bg-red-500/10]="selectedFilterId() === f.id"
                  [class.border-red-500/30]="selectedFilterId() === f.id"
                  [class.text-red-400]="selectedFilterId() === f.id"
                  [class.font-medium]="selectedFilterId() === f.id"
                  [class.bg-neutral-950/40]="selectedFilterId() !== f.id"
                  [class.border-white/5]="selectedFilterId() !== f.id"
                  [class.text-neutral-400]="selectedFilterId() !== f.id"
                  style="min-height: 48px;">
            <span class="text-[11px] leading-tight select-none truncate max-w-full">
              {{ lang() === 'vi' ? f.nameVi : f.nameEn }}
            </span>
          </button>
        }
      </div>

      @if (selectedFilterId() !== 'none') {
        <div class="p-3 rounded-xl bg-neutral-950/45 border border-white/5 flex flex-col gap-1.5">
          <div class="flex justify-between text-[10px] text-neutral-400">
            <span>{{ translations().filterIntensity }}</span>
            <span class="font-mono text-neutral-500">{{ filterIntensity() }}%</span>
          </div>
          <input type="range" 
                 [value]="filterIntensity()" 
                 (input)="onIntensityChange($event)" 
                 min="10" 
                 max="100"
                 class="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-red-500">
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoFilters {
  lang = input<'vi' | 'en'>('vi');
  translations = input.required<AppTranslations>();
  selectedFilterId = model<string>('none');
  filterIntensity = model<number>(100);

  videoFiltersList = VIDEO_FILTERS;

  onSelectFilter(id: string) {
    this.selectedFilterId.set(id);
  }

  onIntensityChange(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    if (inputElement) {
      this.filterIntensity.set(Number(inputElement.value));
    }
  }
}
