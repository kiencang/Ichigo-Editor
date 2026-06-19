import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AppTranslations } from '../core/translations';

@Component({
  selector: 'app-upload-panel',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="col-span-full h-[60vh] flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl bg-neutral-900/50 hover:bg-neutral-800/50 hover:border-red-500/50 transition-all">
      <div class="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-6">
        <mat-icon class="text-3xl">upload_file</mat-icon>
      </div>
      <h2 class="text-2xl font-medium mb-2 tracking-tight">{{ translations().selectVideo }}</h2>
      <p class="text-neutral-500 mb-8 max-w-lg text-center" [innerHTML]="translations().processDevice"></p>
      <label for="video-upload" class="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl cursor-pointer transition-colors flex items-center gap-2 shadow-sm">
        <mat-icon>folder_open</mat-icon>
        {{ translations().browseFiles }}
      </label>
      <input id="video-upload" type="file" accept="video/*" class="hidden" (change)="onFileChanged($event)">
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadPanel {
  translations = input.required<AppTranslations>();
  videoSelected = output<Event>();

  onFileChanged(event: Event) {
    this.videoSelected.emit(event);
  }
}
