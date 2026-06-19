import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from "@angular/core";
import { CommonModule, DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { ZoomRegion } from "./zoom.types";

@Component({
  selector: "app-zoom-regions-list",
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, DecimalPipe],
  template: `
    <div
      class="p-4 rounded-2xl bg-neutral-900 border border-white/5 flex flex-col gap-4"
    >
      <div class="border-b border-white/10 pb-3 flex flex-col gap-3">
        <span
          class="text-lg font-medium text-neutral-200 flex items-center gap-2"
        >
          <mat-icon
            class="text-emerald-400"
            style="font-size: 22px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;"
            >zoom_in</mat-icon
          >
          {{ lang() === "vi" ? "Thu phóng tiêu điểm" : "Zoom & focus areas" }}
        </span>

        <button
          type="button"
          (click)="addZoomRegion.emit()"
          class="w-full justify-center px-2.5 py-2 text-[11px] rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
        >
          <mat-icon
            style="font-size: 14px; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;"
            >add</mat-icon
          >
          <span>{{
            lang() === "vi" ? "Thêm thu phóng" : "Add Zoom Region"
          }}</span>
        </button>
      </div>

      @if (zoomRegions().length === 0) {
        <div
          class="py-6 px-4 text-center text-xs text-neutral-500 border border-dashed border-white/5 rounded-xl"
        >
          {{
            lang() === "vi"
              ? 'Chưa cấu hình thu phóng. Hãy phát video đến đoạn cần phóng to và bấm "Thêm Thu Phóng" để phóng 2x vào phân vùng mong muốn.'
              : 'No zoom regions defined yet. Seek to a timeframe and click "Add Zoom Region" to zoom 2x into any desired quadrant.'
          }}
        </div>
      } @else {
        <!-- List of zoom regions -->
        <div
          class="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar"
        >
          @for (zoom of zoomRegions(); track zoom.id) {
            <div class="flex flex-col gap-2 shrink-0">
              <div
                class="flex items-center justify-between p-3 rounded-xl border transition-all text-xs select-none"
                [class.bg-emerald-500/10]="activeZoomId() === zoom.id"
                [class.border-emerald-500/30]="activeZoomId() === zoom.id"
                [class.bg-neutral-950/40]="activeZoomId() !== zoom.id"
                [class.border-white/5]="activeZoomId() !== zoom.id"
              >
                <!-- Info Left side -->
                <button
                  type="button"
                  class="text-left flex-1 cursor-pointer"
                  (click)="onZoomClick(zoom.id, zoom.startTime)"
                >
                  <div class="flex flex-col gap-0.5">
                    <span class="font-semibold text-neutral-300">
                      {{ lang() === "vi" ? "Thu phóng" : "Zoom" }}
                      {{ zoom.scale }}x ({{
                        getQuadrantLabel(zoom.panX, zoom.panY)
                      }})
                    </span>
                    <span class="text-[10px] font-mono text-neutral-500">
                      {{ lang() === "vi" ? "Kích hoạt" : "Start" }}:
                      {{ formatTimeShort(zoom.startTime) }} |
                      {{ lang() === "vi" ? "Thời lượng" : "Dur" }}:
                      {{ zoom.duration.toFixed(1) }}s
                    </span>
                  </div>
                </button>

                <!-- Control actions -->
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    (click)="deleteZoomRegion.emit(zoom.id)"
                    class="p-1 px-2.5 rounded-lg bg-neutral-950/80 border border-white/5 hover:bg-red-500/10 hover:text-red-400 text-neutral-400 hover:border-red-500/20 transition-all cursor-pointer"
                    [attr.title]="lang() === 'vi' ? 'Xóa' : 'Delete'"
                  >
                    <mat-icon
                      style="font-size: 14px; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;"
                      >delete</mat-icon
                    >
                  </button>
                </div>
              </div>

              <!-- Zoom Properties Panel -->
              @if (activeZoomId() === zoom.id) {
                <div
                  class="p-4 rounded-xl bg-neutral-950 border border-emerald-500/20 flex flex-col gap-4 animate-fade-in mb-2 mx-0.5"
                >
                  <div
                    class="text-xs font-semibold text-neutral-300 flex items-center justify-between"
                  >
                    <span class="flex items-center gap-1.5 font-medium">
                      <mat-icon
                        class="text-emerald-400"
                        style="font-size: 14px; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;"
                        >center_focus_strong</mat-icon
                      >
                      {{
                        lang() === "vi"
                          ? "Cấu hình vùng tiêu điểm"
                          : "Focus Area Configuration"
                      }}
                    </span>
                  </div>

                  <!-- Start Time & Duration Config Row -->
                  <div class="flex flex-col gap-4">
                    <!-- Start time adjustment -->
                    <div class="flex flex-col gap-1.5">
                      <div
                        class="text-[10px] font-medium text-neutral-400 flex justify-between"
                      >
                        <span>{{
                          lang() === "vi" ? "Thời điểm bắt đầu" : "Start Time"
                        }}</span>
                        <span class="font-mono text-neutral-300"
                          >{{ zoom.startTime.toFixed(2) }}s /
                          {{ formatTimeShort(videoDuration()) }}</span
                        >
                      </div>
                      <div class="flex items-center gap-2">
                        <input
                          type="range"
                          [ngModel]="zoom.startTime"
                          (ngModelChange)="onStartTimeChange(zoom.id, $event)"
                          [min]="0"
                          [max]="videoDuration()"
                          step="0.05"
                          class="flex-1 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          title="Start Time Slider"
                        />
                        <input
                          type="number"
                          [ngModel]="zoom.startTime"
                          (ngModelChange)="onStartTimeChange(zoom.id, $event)"
                          [min]="0"
                          [max]="videoDuration()"
                          step="0.1"
                          class="w-16 px-1.5 py-0.5 bg-neutral-900 border border-white/10 rounded text-neutral-200 text-center font-mono text-[11px]"
                          title="Start Time Input"
                        />
                      </div>
                    </div>

                    <!-- Duration Adjustment -->
                    <div class="flex flex-col gap-1.5">
                      <div
                        class="text-[10px] font-medium text-neutral-400 flex justify-between"
                      >
                        <span>{{
                          lang() === "vi" ? "Thời lượng hiển thị" : "Duration"
                        }}</span>
                        <span class="font-mono text-neutral-300"
                          >{{ zoom.duration.toFixed(1) }}s /
                          {{ formatTimeShort(videoDuration()) }}</span
                        >
                      </div>
                      <div class="flex items-center gap-2">
                        <input
                          type="range"
                          [ngModel]="zoom.duration"
                          (ngModelChange)="onDurationChange(zoom.id, $event)"
                          [min]="0.1"
                          [max]="videoDuration()"
                          step="0.1"
                          class="flex-1 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          title="Duration Slider"
                        />
                        <input
                          type="number"
                          [ngModel]="zoom.duration"
                          (ngModelChange)="onDurationChange(zoom.id, $event)"
                          [min]="0.1"
                          [max]="videoDuration()"
                          step="0.1"
                          class="w-16 px-1.5 py-0.5 bg-neutral-900 border border-white/10 rounded text-neutral-200 text-center font-mono text-[11px]"
                          title="Duration Input"
                        />
                      </div>
                    </div>
                  </div>

                  <!-- 4-Quadrant Visual Focus Area Grid Selector -->
                  <div class="flex flex-col gap-2 border-t border-white/5 pt-3">
                    <span
                      class="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide"
                    >
                      {{
                        lang() === "vi"
                          ? "Nhấp chọn 1 trong 4 phân vùng để phóng to (2x)"
                          : "Click 1 of 4 quadrants to focus & zoom (2x)"
                      }}
                    </span>

                    <div
                      class="grid grid-cols-2 gap-2.5 w-full bg-neutral-900/60 border border-white/5 rounded-xl p-3 max-w-sm mx-auto"
                    >
                      <!-- Top Left Area -->
                      <button
                        type="button"
                        (click)="setQuadrant(zoom.id, 0, 0)"
                        [class.bg-emerald-500/10]="
                          zoom.panX === 0 && zoom.panY === 0
                        "
                        [class.border-emerald-500/40]="
                          zoom.panX === 0 && zoom.panY === 0
                        "
                        [class.text-emerald-400]="
                          zoom.panX === 0 && zoom.panY === 0
                        "
                        [class.border-white/5]="
                          zoom.panX !== 0 || zoom.panY !== 0
                        "
                        [class.text-neutral-500]="
                          zoom.panX !== 0 || zoom.panY !== 0
                        "
                        class="border rounded-lg p-3 hover:bg-white/5 hover:text-neutral-300 transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 h-16"
                      >
                        <mat-icon
                          style="font-size: 16px; width: 16px; height: 16px;"
                          >north_west</mat-icon
                        >
                        <span
                          class="text-[9px] font-semibold tracking-wide uppercase"
                          >{{
                            lang() === "vi" ? "Trên - Trái" : "Top Left"
                          }}</span
                        >
                      </button>

                      <!-- Top Right Area -->
                      <button
                        type="button"
                        (click)="setQuadrant(zoom.id, 100, 0)"
                        [class.bg-emerald-500/10]="
                          zoom.panX === 100 && zoom.panY === 0
                        "
                        [class.border-emerald-500/40]="
                          zoom.panX === 100 && zoom.panY === 0
                        "
                        [class.text-emerald-400]="
                          zoom.panX === 100 && zoom.panY === 0
                        "
                        [class.border-white/5]="
                          zoom.panX !== 100 || zoom.panY !== 0
                        "
                        [class.text-neutral-500]="
                          zoom.panX !== 100 || zoom.panY !== 0
                        "
                        class="border rounded-lg p-3 hover:bg-white/5 hover:text-neutral-300 transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 h-16"
                      >
                        <mat-icon
                          style="font-size: 16px; width: 16px; height: 16px;"
                          >north_east</mat-icon
                        >
                        <span
                          class="text-[9px] font-semibold tracking-wide uppercase"
                          >{{
                            lang() === "vi" ? "Trên - Phải" : "Top Right"
                          }}</span
                        >
                      </button>

                      <!-- Bottom Left Area -->
                      <button
                        type="button"
                        (click)="setQuadrant(zoom.id, 0, 100)"
                        [class.bg-emerald-500/10]="
                          zoom.panX === 0 && zoom.panY === 100
                        "
                        [class.border-emerald-500/40]="
                          zoom.panX === 0 && zoom.panY === 100
                        "
                        [class.text-emerald-400]="
                          zoom.panX === 0 && zoom.panY === 100
                        "
                        [class.border-white/5]="
                          zoom.panX !== 0 || zoom.panY !== 100
                        "
                        [class.text-neutral-500]="
                          zoom.panX !== 0 || zoom.panY !== 100
                        "
                        class="border rounded-lg p-3 hover:bg-white/5 hover:text-neutral-300 transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 h-16"
                      >
                        <mat-icon
                          style="font-size: 16px; width: 16px; height: 16px;"
                          >south_west</mat-icon
                        >
                        <span
                          class="text-[9px] font-semibold tracking-wide uppercase"
                          >{{
                            lang() === "vi" ? "Dưới - Trái" : "Btm Left"
                          }}</span
                        >
                      </button>

                      <!-- Bottom Right Area -->
                      <button
                        type="button"
                        (click)="setQuadrant(zoom.id, 100, 100)"
                        [class.bg-emerald-500/10]="
                          zoom.panX === 100 && zoom.panY === 100
                        "
                        [class.border-emerald-500/40]="
                          zoom.panX === 100 && zoom.panY === 100
                        "
                        [class.text-emerald-400]="
                          zoom.panX === 100 && zoom.panY === 100
                        "
                        [class.border-white/5]="
                          zoom.panX !== 100 || zoom.panY !== 100
                        "
                        [class.text-neutral-500]="
                          zoom.panX !== 100 || zoom.panY !== 100
                        "
                        class="border rounded-lg p-3 hover:bg-white/5 hover:text-neutral-300 transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 h-16"
                      >
                        <mat-icon
                          style="font-size: 16px; width: 16px; height: 16px;"
                          >south_east</mat-icon
                        >
                        <span
                          class="text-[9px] font-semibold tracking-wide uppercase"
                          >{{
                            lang() === "vi" ? "Dưới - Phải" : "Btm Right"
                          }}</span
                        >
                      </button>
                    </div>
                  </div>

                  <button
                    class="w-full py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 transition-colors border border-white/10 text-xs font-medium text-neutral-300 flex items-center justify-center gap-1 cursor-pointer"
                    (click)="preview.emit(zoom.id)"
                  >
                    <mat-icon style="font-size: 14px; width: 14px; height: 14px"
                      >play_arrow</mat-icon
                    >
                    {{
                      lang() === "vi"
                        ? "Xem trước vùng này"
                        : "Preview this region"
                    }}
                  </button>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .animate-fade-in {
        animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-5px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppZoomRegionsList {
  zoomRegions = input.required<ZoomRegion[]>();
  activeZoomId = input<string | null>(null);
  videoDuration = input.required<number>();
  lang = input<"vi" | "en">("vi");

  activeZoomIdSet = output<string>();
  seekTo = output<number>();
  deleteZoomRegion = output<string>();

  updateZoomStartTime = output<{ id: string; value: number }>();
  updateZoomDuration = output<{ id: string; value: number }>();
  updateZoomScale = output<{ id: string; value: number }>();
  updateZoomPanX = output<{ id: string; value: number }>();
  updateZoomPanY = output<{ id: string; value: number }>();
  addZoomRegion = output<void>();
  preview = output<string>();

  onZoomClick(id: string, time: number) {
    this.activeZoomIdSet.emit(id);
    this.seekTo.emit(time);
  }

  onStartTimeChange(id: string, val: number) {
    this.updateZoomStartTime.emit({ id, value: Number(val) });
  }

  onDurationChange(id: string, val: number) {
    this.updateZoomDuration.emit({ id, value: Number(val) });
  }

  getQuadrantLabel(panX: number, panY: number): string {
    const isVi = this.lang() === "vi";
    if (panX === 0 && panY === 0) return isVi ? "Trên - Trái" : "Top Left";
    if (panX === 100 && panY === 0) return isVi ? "Trên - Phải" : "Top Right";
    if (panX === 0 && panY === 100) return isVi ? "Dưới - Trái" : "Btm Left";
    if (panX === 100 && panY === 100) return isVi ? "Dưới - Phải" : "Btm Right";
    return isVi ? "Trung tâm" : "Center";
  }

  setQuadrant(id: string, x: number, y: number) {
    // Lock scale to 2.0 when user selects quadrant
    this.updateZoomScale.emit({ id, value: 2.0 });
    this.updateZoomPanX.emit({ id, value: x });
    this.updateZoomPanY.emit({ id, value: y });
  }

  formatTimeShort(s: number): string {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${min}:${sec < 10 ? "0" : ""}${sec}.${ms}`;
  }
}
