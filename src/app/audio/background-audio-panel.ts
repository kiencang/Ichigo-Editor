import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AudioTrack } from './background-audio';
import { AppTranslations } from '../core/translations';
import { BgAudioTrackItem } from './bg-audio-track-item';

@Component({
  selector: 'app-background-audio-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, BgAudioTrackItem],
  template: `
    <!-- Background Audio Tracks -->
    <div class="p-4 rounded-2xl bg-neutral-900 border border-white/5 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-neutral-400">{{ translations().bgAudioTrack }}</span>
          <label for="bg-audio-upload" class="px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-xs font-medium border border-white/10 cursor-pointer transition-colors text-neutral-300 flex items-center gap-1">
             <mat-icon style="font-size: 14px; width: 14px; height: 14px;">add</mat-icon>
             {{ translations().addBgAudio }}
          </label>
          <input id="bg-audio-upload" type="file" accept="audio/*" multiple class="hidden" (change)="onAudioSelected($event)">
        </div>
        
        @if (audioTracks().length > 0) {
          <div class="flex flex-col gap-3">
             @for (track of audioTracks(); track track.id; let idx = $index) {
                <app-bg-audio-track-item
                   [track]="track"
                   [idx]="idx"
                   [playingTrackId]="playingTrackId()"
                   [isolatedPreviewTime]="isolatedPreviewTime()"
                   [translations]="translations()"
                   [lang]="lang()"
                   (removeTrack)="removeTrack.emit(track.id)"
                   (volumeChanged)="onVolumeChange(track.id, $event)"
                   (trimStartChanged)="onTrimStartChange(track.id, $event)"
                   (trimEndChanged)="onTrimEndChange(track.id, $event)"
                   (preview)="previewSpecificTrack.emit(track.id)"
                   (dragStart)="onDragStart(idx)"
                   (dragEnd)="onDragEnd()"
                   (trackDragOver)="onDragOver($event, idx)"
                   (trackDrop)="onDrop($event, idx)">
                </app-bg-audio-track-item>
             }
          </div>
        }
    </div>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackgroundAudioPanel {
  lang = input<string>('vi');
  translations = input.required<AppTranslations>();
  audioTracks = input.required<AudioTrack[]>();
  playingTrackId = input<string | null>(null);
  isolatedPreviewTime = input<number>(0);

  // Outputs
  audioSelected = output<Event>();
  removeTrack = output<string>();
  trackVolumeChanged = output<{ id: string; volume: number }>();
  trackTrimStartChanged = output<{ id: string; value: number }>();
  trackTrimEndChanged = output<{ id: string; value: number }>();
  previewSpecificTrack = output<string>();
  audioTracksReordered = output<{ draggedIndex: number; targetIndex: number }>();

  // Internal drag state
  draggedTrackIndex = signal<number | null>(null);
  dragOverTrackIndex = signal<number | null>(null);

  onAudioSelected(event: Event) {
    this.audioSelected.emit(event);
  }

  onVolumeChange(id: string, value: string | number) {
    const val = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(val)) {
      this.trackVolumeChanged.emit({ id, volume: val });
    }
  }

  onTrimStartChange(id: string, value: string | number) {
    const val = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(val)) {
      this.trackTrimStartChanged.emit({ id, value: val });
    }
  }

  onTrimEndChange(id: string, value: string | number) {
    const val = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(val)) {
      this.trackTrimEndChanged.emit({ id, value: val });
    }
  }

  onDragStart(index: number) {
    this.draggedTrackIndex.set(index);
  }

  onDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    this.dragOverTrackIndex.set(index);
  }

  onDrop(event: DragEvent, index: number) {
    event.preventDefault();
    const draggedIdx = this.draggedTrackIndex();
    if (draggedIdx !== null && draggedIdx !== index) {
      this.audioTracksReordered.emit({ draggedIndex: draggedIdx, targetIndex: index });
    }
    this.draggedTrackIndex.set(null);
    this.dragOverTrackIndex.set(null);
  }

  onDragEnd() {
    this.draggedTrackIndex.set(null);
    this.dragOverTrackIndex.set(null);
  }

  formatTimeShort(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
}
