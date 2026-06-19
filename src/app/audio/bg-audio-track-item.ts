import { 
  Component, 
  ChangeDetectionStrategy, 
  input, 
  output, 
  signal, 
  ElementRef, 
  ViewChild, 
  AfterViewInit, 
  OnDestroy, 
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AudioTrack } from './background-audio';
import { AppTranslations } from '../core/translations';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';

@Component({
  selector: 'app-bg-audio-track-item',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="flex flex-col gap-2 p-3 rounded-xl bg-neutral-950/40 border border-white/5 hover:border-emerald-500/30 transition-all duration-300"
         [class.opacity-50]="isDragging()"
         (dragover)="onDragOver($event)"
         (drop)="onDrop($event)">
       
       <!-- Header Row: Title & Drag handle -->
       <div class="flex items-center justify-between group">
           <div class="flex items-center gap-2 overflow-hidden flex-1 cursor-grab active:cursor-grabbing relative py-1 rounded-lg hover:bg-neutral-900/40 transition-colors"
                draggable="true" 
                (dragstart)="onDragStart()"
                (dragend)="onDragEnd()">
              <span class="text-[10px] bg-neutral-900 border border-emerald-500/10 text-neutral-400 font-mono px-2 py-0.5 rounded flex items-center justify-center">{{ idx() + 1 }}</span>
              <mat-icon class="text-emerald-500/60 group-hover:text-emerald-500 transition-colors" style="font-size: 16px; width: 16px; height: 16px;">drag_indicator</mat-icon>
              <span class="text-xs text-neutral-200 truncate font-medium">{{ track().file.name }}</span>
              <span class="text-[10px] bg-emerald-900/10 border border-emerald-500/20 text-emerald-400 font-mono px-1.5 py-0.5 rounded ml-auto mr-2">{{ formatTimeShort(track().duration) }}</span>
           </div>
           
           <div class="flex items-center gap-1">
              <button (click)="removeTrack.emit()" class="text-neutral-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg border border-transparent hover:border-red-500/20 cursor-pointer transition-all">
                 <mat-icon style="font-size: 14px; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;">close</mat-icon>
              </button>
           </div>
       </div>

       <!-- Volume & Audio Controls -->
       <div class="flex flex-col gap-2.5 pl-[28px] mt-1 text-neutral-400">
         
         <!-- Volume Slider -->
         <div class="flex items-center gap-2">
           <mat-icon class="text-neutral-500" style="font-size: 14px; width: 14px; height: 14px;">volume_up</mat-icon>
           <input type="range" 
                  [ngModel]="track().volume" 
                  (ngModelChange)="onVolumeChange($event)" 
                  min="0" 
                  max="100" 
                  class="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500">
           <span class="text-[10px] font-mono w-8 text-right text-neutral-400">{{ track().volume }}%</span>
         </div>
         
         <!-- Visual Waveform Container (WaveSurfer.js) -->
         <div class="flex flex-col gap-1 mt-1">
           <div class="flex justify-between items-center text-[10px] text-neutral-500 font-mono">
             <span>{{ formatTimeShort(track().trimStart) }}</span>
             <span class="text-xs text-neutral-300 font-medium bg-neutral-900/60 px-2 py-0.5 border border-white/5 rounded-full">
               ✂️ {{ translations().trimRange || 'Khoảng cắt' }}: {{ formatTimeShort(track().trimEnd - track().trimStart) }}
             </span>
             <span>{{ formatTimeShort(track().trimEnd) }}</span>
           </div>

           <!-- WaveSurfer Element -->
           <div #waveformContainer class="relative w-full rounded-lg bg-neutral-900/90 border border-white/5 overflow-hidden py-1 transition-all duration-300">
              <!-- Loading visual placeholder -->
              @if (isLoadingWave()) {
                <div class="absolute inset-0 bg-neutral-950/80 z-20 flex items-center justify-center gap-2 text-xs text-neutral-400">
                  <div class="w-3.5 h-3.5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
                  <span>Rendering...</span>
                </div>
              }
              
              <!-- Underlay elements for interactive trim region visualization -->
              <div class="waveform-body h-12" [id]="'ws-render-' + track().id"></div>
           </div>
         </div>
         
         <!-- Controls Row: Visual Region Manipulation Help & Preview -->
         <div class="flex justify-between items-center mt-1">
           <span class="text-[9px] text-neutral-500 italic flex items-center gap-1">
             <mat-icon style="font-size: 10px; width: 10px; height: 10px; display: inline-flex; align-items: center; justify-content: center;">touch_app</mat-icon>
             {{ lang() === 'vi' ? 'Kéo rìa vùng mờ để cắt vùng nhạc nền trực quan' : 'Drag edges of shaded area to trim visually' }}
           </span>
           
           <button (click)="preview.emit()" class="text-emerald-400 hover:text-emerald-300 bg-neutral-950 hover:bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 hover:border-emerald-500/40 cursor-pointer flex items-center gap-1.5 transition-all text-xs font-semibold">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;">
                  {{ playingTrackId() === track().id ? 'stop' : 'play_arrow' }}
              </mat-icon>
              <span>{{ playingTrackId() === track().id ? (lang() === 'vi' ? 'Dừng thử' : 'Stop') : (lang() === 'vi' ? 'Nghe thử' : 'Play') }}</span>
           </button>
         </div>

       </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    /* Custom styling for WaveSurfer crop/trim region overlay */
    :host ::ng-deep ::part(region) {
      border: 1.5px dashed rgba(16, 185, 129, 0.45) !important;
      border-left: none !important;
      border-right: none !important;
    }

    /* Style the vertical edge line of the resize handle (both left and right sides) */
    :host ::ng-deep ::part(region-handle) {
      width: 4px !important;
      background-color: #10b981 !important; /* emerald-500 */
      opacity: 1 !important;
      cursor: ew-resize !important;
      transition: all 0.2s ease !important;
      z-index: 30 !important;
    }

    /* Create the elegant circular pill handle on top of the edge line */
    :host ::ng-deep ::part(region-handle)::after {
      content: '' !important;
      position: absolute !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      width: 12px !important;
      height: 24px !important;
      background-color: #10b981 !important; /* emerald-500 */
      border: 2px solid #ffffff !important;
      border-radius: 6px !important;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.5) !important;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    /* Position handles correctly at left and right boundaries inside the shadow root */
    :host ::ng-deep ::part(region-handle-left) {
      left: 0px !important;
    }

    :host ::ng-deep ::part(region-handle-right) {
      right: 0px !important;
    }

    /* Add micro-interaction feedback on hover/drag */
    :host ::ng-deep ::part(region-handle):hover::after {
      background-color: #059669 !important; /* emerald-600 */
      transform: translate(-50%, -50%) scale(1.15) !important;
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.8) !important;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BgAudioTrackItem implements AfterViewInit, OnDestroy, OnChanges {
  track = input.required<AudioTrack>();
  idx = input.required<number>();
  playingTrackId = input<string | null>(null);
  isolatedPreviewTime = input<number>(0);
  translations = input.required<AppTranslations>();
  lang = input<string>('vi');

  // Outputs
  removeTrack = output<void>();
  volumeChanged = output<number>();
  trimStartChanged = output<number>();
  trimEndChanged = output<number>();
  preview = output<void>();
  dragStart = output<void>();
  dragEnd = output<void>();
  trackDragOver = output<DragEvent>();
  trackDrop = output<DragEvent>();

  @ViewChild('waveformContainer') waveformContainerRef!: ElementRef<HTMLDivElement>;

  wavesurfer: WaveSurfer | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  regionsPlugin: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeRegion: any = null;

  isLoadingWave = signal<boolean>(true);
  isDragging = signal<boolean>(false);

  ngAfterViewInit() {
    this.initWaveSurfer();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Update playhead position visually in WaveSurfer when isolated preview updates
    if (this.wavesurfer && changes['isolatedPreviewTime'] && this.playingTrackId() === this.track().id) {
      const time = changes['isolatedPreviewTime'].currentValue;
      if (typeof time === 'number' && !isNaN(time)) {
        this.wavesurfer.setTime(time);
      }
    }

    // Sync region values if trim changed externally
    if (this.activeRegion && (changes['track'])) {
      const currentTrack = this.track();
      const needsUpdate = Math.abs(this.activeRegion.start - currentTrack.trimStart) > 0.05 || 
                          Math.abs(this.activeRegion.end - currentTrack.trimEnd) > 0.05;
      if (needsUpdate) {
        this.activeRegion.setOptions({
          start: currentTrack.trimStart,
          end: currentTrack.trimEnd
        });
      }
    }
  }

  private initWaveSurfer() {
    try {
      this.isLoadingWave.set(true);
      const containerId = `#ws-render-${this.track().id}`;
      
      this.wavesurfer = WaveSurfer.create({
        container: containerId,
        waveColor: '#262626', // dark grey neutral-800
        progressColor: '#059669', // dark emerald-600
        cursorColor: '#fbbf24', // yellow-400
        cursorWidth: 2,
        height: 48,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        url: this.track().url,
        interact: true,
        plugins: []
      });

      // Register the Regions plugin for premium, drag-and-resize music cutting
      this.regionsPlugin = this.wavesurfer.registerPlugin(RegionsPlugin.create());

      this.wavesurfer.on('ready', () => {
        this.isLoadingWave.set(false);
        const t = this.track();
        
        // Add the green active selection region overlay
        this.activeRegion = this.regionsPlugin.addRegion({
          id: 'trim',
          start: t.trimStart,
          end: t.trimEnd,
          color: 'rgba(16, 185, 129, 0.16)', // emerald translucency
          drag: true,
          resize: true
        });

        // Whenever region elements are resized or dragged by the user, emit trims
        this.regionsPlugin.on('region-updated', (region: { id: string; start: number; end: number }) => {
          if (region.id === 'trim') {
            this.trimStartChanged.emit(region.start);
            this.trimEndChanged.emit(region.end);
          }
        });
      });

      this.wavesurfer.on('error', (err) => {
        console.warn('Wavesurfer failed loading, using fallback container:', err);
        this.isLoadingWave.set(false);
      });

    } catch (e) {
      console.error('Error initializing WaveSurfer:', e);
      this.isLoadingWave.set(false);
    }
  }

  onVolumeChange(val: string | number) {
    const value = typeof val === 'string' ? parseFloat(val) : val;
    if (!isNaN(value)) {
      this.volumeChanged.emit(value);
    }
  }

  // Drag and Drop reordering relays
  onDragStart() {
    this.isDragging.set(true);
    this.dragStart.emit();
  }

  onDragEnd() {
    this.isDragging.set(false);
    this.dragEnd.emit();
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.trackDragOver.emit(event);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.trackDrop.emit(event);
  }

  formatTimeShort(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  ngOnDestroy() {
    if (this.wavesurfer) {
      try {
        this.wavesurfer.destroy();
      } catch (e) {
        console.warn('Error destroying Wavesurfer:', e);
      }
    }
  }
}
