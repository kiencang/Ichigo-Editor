import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="mt-auto border-t border-white/5 py-4 px-8 bg-neutral-950/40">
      <div class="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-500">
        <div class="flex items-center gap-1.5">
          <span class="font-medium text-neutral-300">Ichigo Screen Editor</span>
          <span class="text-neutral-700">•</span>
          <span>v1.0.13</span>
        </div>
        <div class="flex flex-wrap justify-center items-center gap-1.5 font-sans">
          <a href="https://github.com/kiencang/Ichigo-Screen-Editor" target="_blank" rel="noopener noreferrer" class="hover:text-neutral-300 transition-colors cursor-pointer">GitHub</a>
          <span class="text-neutral-700">•</span>
          <span class="text-neutral-400">Nguyễn Đức Anh</span>
          <span class="text-neutral-700">•</span>
          <a href="mailto:contact@wpsila.com" class="hover:text-neutral-300 transition-colors cursor-pointer">contact@wpsila.com</a>
        </div>
      </div>
    </footer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppFooter {}
