import { Component, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AppTranslations } from '../core/translations';

@Component({
  selector: 'app-watermark-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <label for="logo-upload" class="flex-1 flex items-center p-3 rounded-xl border border-white/5 hover:border-white/20 bg-neutral-950/50 cursor-pointer transition-colors group">
             <div class="flex-1 overflow-hidden">
                <div class="text-sm font-medium truncate">{{ logoFile() ? logoFile()!.name : translations().addWatermark }}</div>
             </div>
          </label>
          @if (logoFile()) {
            <button (click)="removeWatermark()" class="p-3 bg-neutral-950/50 hover:bg-red-500/10 hover:text-red-400 text-neutral-500 rounded-xl border border-white/5 hover:border-red-500/20 transition-colors cursor-pointer" [title]="translations().removeWatermark">
              <mat-icon class="text-base !flex !items-center !justify-center" style="font-size: 16px; width: 16px; height: 16px;">delete</mat-icon>
            </button>
          }
        </div>
        <input id="logo-upload" type="file" accept="image/*" class="hidden" (change)="onLogoSelected($event)">

        @if (logoFile()) {
          <div class="p-3.5 rounded-xl bg-neutral-950/45 border border-white/5 flex flex-col gap-3">
             <div class="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
               {{ translations().logoSettings }}
             </div>
             
             <div class="flex items-center gap-4">
                <!-- Position choice 2x2 dots grid -->
                <div class="flex flex-col gap-1 items-center">
                   <div class="text-[9px] text-neutral-500 font-mono">{{ translations().logoPosition }}</div>
                   <div class="grid grid-cols-2 gap-1 w-[72px] h-[52px] bg-neutral-955 p-1 rounded-lg border border-white/5">
                      <button (click)="logoPosition.set('top-left')" 
                              class="rounded transition-all duration-200 border cursor-pointer flex items-center justify-center p-0.5"
                              [class.bg-red-500]="logoPosition() === 'top-left'"
                              [class.bg-opacity-20]="logoPosition() === 'top-left'"
                              [class.border-red-500]="logoPosition() === 'top-left'"
                              [class.border-opacity-40]="logoPosition() === 'top-left'"
                              [class.bg-neutral-900]="logoPosition() !== 'top-left'"
                              [class.border-white]="logoPosition() !== 'top-left'"
                              [class.border-opacity-5]="logoPosition() !== 'top-left'"
                              [title]="translations().logoTopLeft">
                        <div class="w-1.5 h-1.5 rounded-full" [class.bg-red-400]="logoPosition() === 'top-left'" [class.bg-neutral-700]="logoPosition() !== 'top-left'"></div>
                      </button>
                      <button (click)="logoPosition.set('top-right')" 
                              class="rounded transition-all duration-200 border cursor-pointer flex items-center justify-center p-0.5"
                              [class.bg-red-500]="logoPosition() === 'top-right'"
                              [class.bg-opacity-20]="logoPosition() === 'top-right'"
                              [class.border-red-500]="logoPosition() === 'top-right'"
                              [class.border-opacity-40]="logoPosition() === 'top-right'"
                              [class.bg-neutral-900]="logoPosition() !== 'top-right'"
                              [class.border-white]="logoPosition() !== 'top-right'"
                              [class.border-opacity-5]="logoPosition() !== 'top-right'"
                              [title]="translations().logoTopRight">
                        <div class="w-1.5 h-1.5 rounded-full" [class.bg-red-400]="logoPosition() === 'top-right'" [class.bg-neutral-700]="logoPosition() !== 'top-right'"></div>
                      </button>
                      <button (click)="logoPosition.set('bottom-left')" 
                              class="rounded transition-all duration-200 border cursor-pointer flex items-center justify-center p-0.5"
                              [class.bg-red-500]="logoPosition() === 'bottom-left'"
                              [class.bg-opacity-20]="logoPosition() === 'bottom-left'"
                              [class.border-red-500]="logoPosition() === 'bottom-left'"
                              [class.border-opacity-40]="logoPosition() === 'bottom-left'"
                              [class.bg-neutral-900]="logoPosition() !== 'bottom-left'"
                              [class.border-white]="logoPosition() !== 'bottom-left'"
                              [class.border-opacity-5]="logoPosition() !== 'bottom-left'"
                              [title]="translations().logoBottomLeft">
                        <div class="w-1.5 h-1.5 rounded-full" [class.bg-red-400]="logoPosition() === 'bottom-left'" [class.bg-neutral-700]="logoPosition() !== 'bottom-left'"></div>
                      </button>
                      <button (click)="logoPosition.set('bottom-right')" 
                              class="rounded transition-all duration-200 border cursor-pointer flex items-center justify-center p-0.5"
                              [class.bg-red-500]="logoPosition() === 'bottom-right'"
                              [class.bg-opacity-20]="logoPosition() === 'bottom-right'"
                              [class.border-red-500]="logoPosition() === 'bottom-right'"
                              [class.border-opacity-40]="logoPosition() === 'bottom-right'"
                              [class.bg-neutral-900]="logoPosition() !== 'bottom-right'"
                              [class.border-white]="logoPosition() !== 'bottom-right'"
                              [class.border-opacity-5]="logoPosition() !== 'bottom-right'"
                              [title]="translations().logoBottomRight">
                        <div class="w-1.5 h-1.5 rounded-full" [class.bg-red-400]="logoPosition() === 'bottom-right'" [class.bg-neutral-700]="logoPosition() !== 'bottom-right'"></div>
                      </button>
                   </div>
                </div>
                
                <!-- Sizing and transparency range controls -->
                <div class="flex-1 flex flex-col gap-4">
                   <div class="flex flex-col gap-1.5">
                      <div class="flex justify-between text-[10px] text-neutral-400">
                         <span>{{ translations().logoOpacity }}</span>
                         <span class="font-mono text-neutral-500">{{ logoOpacity() }}%</span>
                      </div>
                      <input type="range" [ngModel]="logoOpacity()" (ngModelChange)="logoOpacity.set($event)" min="10" max="100"
                             class="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-red-500">
                   </div>
                   <div class="flex flex-col gap-1.5">
                      <div class="flex justify-between text-[10px] text-neutral-400">
                         <span>{{ translations().logoSize }}</span>
                         <span class="font-mono text-neutral-500">{{ logoSize() }}%</span>
                      </div>
                      <input type="range" [ngModel]="logoSize()" (ngModelChange)="logoSize.set($event)" min="5" max="35"
                             class="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-red-500">
                   </div>
                </div>
             </div>
          </div>
        }
    </div>
  `
})
export class WatermarkPanel {
  translations = input.required<AppTranslations>();

  logoFile = model<File | null>(null);
  logoPreviewUrl = model<string | null>(null);
  logoPosition = model<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-right');
  logoOpacity = model<number>(50);
  logoSize = model<number>(15);

  onLogoSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        this.logoFile.set(file);
        if (this.logoPreviewUrl()) {
          URL.revokeObjectURL(this.logoPreviewUrl()!);
        }
        this.logoPreviewUrl.set(URL.createObjectURL(file));
      }
    }
    if (target) {
      target.value = '';
    }
  }

  removeWatermark() {
    this.logoFile.set(null);
    if (this.logoPreviewUrl()) {
      URL.revokeObjectURL(this.logoPreviewUrl()!);
      this.logoPreviewUrl.set(null);
    }
  }
}
