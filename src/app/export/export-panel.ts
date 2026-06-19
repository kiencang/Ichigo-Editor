import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AppTranslations } from '../core/translations';

@Component({
  selector: 'app-export-panel',
  imports: [MatIconModule],
  template: `
    <div class="flex flex-col gap-6 relative">
      <!-- Export Settings Card -->
      <fieldset [disabled]="isProcessing()" class="p-4 rounded-2xl bg-neutral-900 border border-white/5 flex flex-col gap-6 disabled:opacity-50">
        <!-- Volume -->
        <div class="flex flex-col gap-4">
           <div class="flex flex-col gap-2">
              <div class="flex justify-between items-center">
                 <span class="text-sm font-medium text-neutral-400">{{ translations().videoVolume }}</span>
                 <span class="text-xs text-neutral-500">{{ volume() }}%</span>
              </div>
              <input type="range" 
                     [value]="volume()" 
                     (input)="onVolumeInput($event)" 
                     min="0" 
                     max="200"
                     class="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                     title="Video Volume">
           </div>
        </div>
        
        <!-- Format -->
        <div class="flex flex-col gap-2">
           <span class="text-sm font-medium text-neutral-400">{{ translations().outputFormat }}</span>
           <select [value]="outputFormat()" 
                   (change)="onFormatChange($event)"
                   class="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500/50 appearance-none cursor-pointer">
             <option value="mp4" [selected]="outputFormat() === 'mp4'">MP4 (.mp4)</option>
             <option value="webm" [selected]="outputFormat() === 'webm'">WebM (.webm)</option>
             <option value="gif" [selected]="outputFormat() === 'gif'" [disabled]="isGifDisabled()">GIF (.gif){{ isGifDisabled() ? translations().gifLimit : '' }}</option>
           </select>
        </div>
        
        <!-- Audio Bitrate -->
        @if (outputFormat() !== 'gif') {
          <div class="flex flex-col gap-2">
             <span class="text-sm font-medium text-neutral-400">{{ translations().audioBitrate }}</span>
             <select [value]="audioBitrate()" 
                     (change)="onAudioBitrateChange($event)"
                     class="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500/50 appearance-none cursor-pointer">
               <option [value]="128000" [selected]="audioBitrate() === 128000">128 Kbps</option>
               <option [value]="192000" [selected]="audioBitrate() === 192000">{{ translations().audioBitrateDefault }}</option>
               <option [value]="320000" [selected]="audioBitrate() === 320000">320 Kbps</option>
             </select>
          </div>
        }

        <!-- Video Bitrate -->
        @if (outputFormat() !== 'gif') {
          <div class="flex flex-col gap-2">
             <span class="text-sm font-medium text-neutral-400">{{ translations().videoBitrate }}</span>
             <select [value]="videoBitrate()" 
                     (change)="onVideoBitrateChange($event)"
                     class="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500/50 appearance-none cursor-pointer">
               <option [value]="0" [selected]="videoBitrate() === 0">{{ lang() === 'vi' ? 'Tự động (Khuyên dùng)' : 'Auto-detected (Recommended)' }}</option>
               <option [value]="2000000" [selected]="videoBitrate() === 2000000">2 Mbps</option>
               <option [value]="4000000" [selected]="videoBitrate() === 4000000">4 Mbps</option>
               <option [value]="8000000" [selected]="videoBitrate() === 8000000">8 Mbps</option>
             </select>
          </div>
        }

        <!-- Transition Duration -->
        <div class="flex flex-col gap-2 border-t border-white/5 pt-4 mt-2">
           <span class="text-sm font-medium text-neutral-400">{{ lang() === 'vi' ? 'Thời gian chuyển cảnh' : 'Transition Duration' }}</span>
           <select [value]="transitionDuration()" 
                   (change)="onTransitionDurationChange($event)"
                   class="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500/50 appearance-none cursor-pointer">
             <option [value]="0.5" [selected]="transitionDuration() === 0.5">0.5s</option>
             <option [value]="1" [selected]="transitionDuration() === 1">1.0s</option>
             <option [value]="2" [selected]="transitionDuration() === 2">2.0s</option>
           </select>
        </div>
      </fieldset>

      <!-- Action Button -->
      <button 
        (click)="exportVideo.emit()" 
        [disabled]="!isLoaded() || isProcessing()"
        class="w-full py-4 bg-red-500 hover:bg-red-600 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-white font-medium rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-sm font-sans tracking-wide cursor-pointer">
        @if (isProcessing()) {
          <mat-icon class="animate-spin">data_usage</mat-icon>
          {{ translations().rendering }} {{ progress() }}%
        } @else {
          <mat-icon>movie_filter</mat-icon>
          {{ translations().exportVideo }}
        }
      </button>
      
      <!-- Output Box -->
      @if (outputUrl()) {
        <div class="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex flex-col gap-2 animate-fade-in">
          <div class="flex items-start gap-2">
            <mat-icon class="text-emerald-500 mt-0.5 shrink-0">check_circle</mat-icon>
            <div class="flex flex-col">
              <span class="text-sm font-medium text-emerald-400 font-sans">{{ translations().exportComplete }}</span>
              <span class="text-xs text-neutral-400 mt-0.5">{{ translations().autoDownloaded }}</span>
            </div>
          </div>
          
          <div class="flex justify-end pt-2 border-t border-emerald-500/10 mt-1">
            <a [href]="outputUrl()" download class="text-xs text-emerald-500 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer font-medium hover:underline">
              <mat-icon class="text-xs">download</mat-icon>
              {{ translations().downloadFallback }}
            </a>
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExportPanel {
  lang = input<'vi' | 'en'>('vi');
  translations = input.required<AppTranslations>();
  isLoaded = input<boolean>(false);
  isProcessing = input<boolean>(false);
  progress = input<number>(0);
  outputUrl = input<string | null>(null);
  isGifDisabled = input<boolean>(false);

  volume = input<number>(100);
  outputFormat = input<string>('webm');
  audioBitrate = input<number>(192000);
  videoBitrate = input<number>(0);
  transitionDuration = input<number>(1);

  volumeChanged = output<number>();
  outputFormatChanged = output<string>();
  audioBitrateChanged = output<number>();
  videoBitrateChanged = output<number>();
  transitionDurationChanged = output<number>();
  exportVideo = output<void>();

  onVolumeInput(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    if (inputElement) {
      this.volumeChanged.emit(Number(inputElement.value));
    }
  }

  onFormatChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    if (selectElement) {
      this.outputFormatChanged.emit(selectElement.value);
    }
  }

  onAudioBitrateChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    if (selectElement) {
      this.audioBitrateChanged.emit(Number(selectElement.value));
    }
  }

  onVideoBitrateChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    if (selectElement) {
      this.videoBitrateChanged.emit(Number(selectElement.value));
    }
  }

  onTransitionDurationChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    if (selectElement) {
      this.transitionDurationChanged.emit(Number(selectElement.value));
    }
  }
}
