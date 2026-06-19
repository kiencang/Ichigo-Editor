import { Component, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AppTranslations } from '../core/translations';
import { ToolType } from './stroke.types';

@Component({
  selector: 'app-annotation-tools',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div
      class="p-4 rounded-2xl bg-neutral-900 border border-white/5 flex flex-wrap items-center gap-4"
    >
      <span class="text-sm font-medium text-neutral-400"
        >{{ translations().annotationsLabel }}</span
      >
      <div
        class="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-white/5"
      >
        <button
          class="p-2 rounded-lg flex items-center justify-center transition-colors hover:text-white cursor-pointer"
          [class.bg-neutral-800]="currentTool() === 'pointer'"
          [class.text-white]="currentTool() === 'pointer'"
          [class.text-neutral-500]="currentTool() !== 'pointer'"
          (click)="currentTool.set('pointer')"
          [attr.title]="translations().toolPointer"
        >
          <mat-icon size="sm">ads_click</mat-icon>
        </button>
        <button
          class="p-2 rounded-lg flex items-center justify-center transition-colors hover:text-white cursor-pointer"
          [class.bg-red-500]="currentTool() === 'pen'"
          [class.bg-opacity-20]="currentTool() === 'pen'"
          [class.text-red-400]="currentTool() === 'pen'"
          [class.text-neutral-500]="currentTool() !== 'pen'"
          (click)="currentTool.set('pen')"
          [attr.title]="translations().toolPen"
        >
          <mat-icon size="sm">draw</mat-icon>
        </button>
        <button
          class="p-2 rounded-lg flex items-center justify-center transition-colors hover:text-white cursor-pointer"
          [class.bg-red-500]="currentTool() === 'arrow'"
          [class.bg-opacity-20]="currentTool() === 'arrow'"
          [class.text-red-400]="currentTool() === 'arrow'"
          [class.text-neutral-500]="currentTool() !== 'arrow'"
          (click)="currentTool.set('arrow')"
          [attr.title]="translations().toolArrow"
        >
          <mat-icon size="sm">moving</mat-icon>
        </button>
        <button
          class="p-2 rounded-lg flex items-center justify-center transition-colors hover:text-white cursor-pointer"
          [class.bg-red-500]="currentTool() === 'rect'"
          [class.bg-opacity-20]="currentTool() === 'rect'"
          [class.text-red-400]="currentTool() === 'rect'"
          [class.text-neutral-500]="currentTool() !== 'rect'"
          (click)="currentTool.set('rect')"
          [attr.title]="translations().toolRect"
        >
          <mat-icon size="sm">crop_square</mat-icon>
        </button>
        <button
          class="p-2 rounded-lg flex items-center justify-center transition-colors hover:text-white cursor-pointer"
          [class.bg-red-500]="currentTool() === 'circle'"
          [class.bg-opacity-20]="currentTool() === 'circle'"
          [class.text-red-400]="currentTool() === 'circle'"
          [class.text-neutral-500]="currentTool() !== 'circle'"
          (click)="currentTool.set('circle')"
          [attr.title]="translations().toolCircle"
        >
          <mat-icon size="sm">radio_button_unchecked</mat-icon>
        </button>
        <button
          class="p-2 rounded-lg flex items-center justify-center transition-colors hover:text-white cursor-pointer"
          [class.bg-red-500]="currentTool() === 'line'"
          [class.bg-opacity-20]="currentTool() === 'line'"
          [class.text-red-400]="currentTool() === 'line'"
          [class.text-neutral-500]="currentTool() !== 'line'"
          (click)="currentTool.set('line')"
          [attr.title]="translations().toolLine"
        >
          <mat-icon size="sm">horizontal_rule</mat-icon>
        </button>
        <button
          class="p-2 rounded-lg flex items-center justify-center transition-colors hover:text-white cursor-pointer"
          [class.bg-red-500]="currentTool() === 'text'"
          [class.bg-opacity-20]="currentTool() === 'text'"
          [class.text-red-400]="currentTool() === 'text'"
          [class.text-neutral-500]="currentTool() !== 'text'"
          (click)="currentTool.set('text')"
          [attr.title]="translations().toolText"
        >
          <mat-icon size="sm">title</mat-icon>
        </button>
      </div>

      <div class="flex items-center gap-2 ml-auto justify-end">
        <input
          type="color"
          [ngModel]="color()"
          (ngModelChange)="color.set($event)"
          class="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
          title="Select color"
        />
      </div>
    </div>
  `
})
export class AnnotationToolsComponent {
  translations = input.required<AppTranslations>();
  currentTool = model.required<ToolType>();
  color = model.required<string>();
}
