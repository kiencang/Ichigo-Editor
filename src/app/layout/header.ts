import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <header class="border-b border-white/10 bg-neutral-950 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center">
          <mat-icon class="text-xl">movie_edit</mat-icon>
        </div>
        <h1 class="text-xl font-medium tracking-tight">Ichigo Screen Editor</h1>
      </div>

      <!-- Language Selector Toggle -->
      <div class="flex items-center gap-1 bg-neutral-900 border border-white/5 p-1 rounded-xl">
        <button 
          (click)="changeLang('vi')" 
          class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer"
          [class.bg-red-500]="lang() === 'vi'"
          [class.text-white]="lang() === 'vi'"
          [class.text-neutral-400]="lang() !== 'vi'"
          [class.hover:text-neutral-100]="lang() !== 'vi'">
          Tiếng Việt
        </button>
        <button 
          (click)="changeLang('en')" 
          class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer"
          [class.bg-red-500]="lang() === 'en'"
          [class.text-white]="lang() === 'en'"
          [class.text-neutral-400]="lang() !== 'en'"
          [class.hover:text-neutral-100]="lang() !== 'en'">
          English
        </button>
      </div>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeader {
  lang = input.required<'vi' | 'en'>();
  langChanged = output<'vi' | 'en'>();

  changeLang(newLang: 'vi' | 'en') {
    this.langChanged.emit(newLang);
  }
}
