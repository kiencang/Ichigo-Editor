import { Injectable, signal, computed } from '@angular/core';
import { AppliedFilter, VIDEO_FILTERS, getAppliedFiltersCSSAtTime } from './filters.types';

@Injectable({ providedIn: 'root' })
export class VideoFiltersService {
  videoFiltersList = VIDEO_FILTERS;
  appliedFilters = signal<AppliedFilter[]>([]);
  activeFilterId = signal<string | null>(null);

  currentActiveFilter = computed(() => {
    return (
      this.appliedFilters().find((f) => f.id === this.activeFilterId()) || null
    );
  });

  getVideoFilterStyle(currentTime: number) {
    return getAppliedFiltersCSSAtTime(this.appliedFilters(), currentTime);
  }

  addAppliedFilter(presetId: string, current: number, videoDur: number) {
    if (videoDur <= 0) return null;
    const dur = Math.min(3, Math.max(0.1, videoDur - current));
    if (dur <= 0) return null;

    const newFilter: AppliedFilter = {
      id: "filter_" + Math.random().toString(36).substring(2, 11),
      presetId: presetId,
      startTime: current,
      duration: dur,
      intensity: 100,
    };

    this.appliedFilters.update((filters) => [...filters, newFilter]);
    this.activeFilterId.set(newFilter.id);
    return newFilter;
  }

  deleteAppliedFilter(id: string) {
    this.appliedFilters.update((all) => all.filter((f) => f.id !== id));
    if (this.activeFilterId() === id) {
      this.activeFilterId.set(null);
    }
  }

  updateFilterStartTime(id: string, newTime: number, videoDur: number) {
    const validTime = Math.max(0, Math.min(videoDur, Number(newTime)));
    this.appliedFilters.update((all) =>
      all.map((f) => (f.id === id ? { ...f, startTime: validTime } : f)),
    );
  }

  updateFilterDuration(id: string, newDuration: number, videoDur: number) {
    const validDur = Math.max(0.1, Math.min(videoDur, Number(newDuration)));
    this.appliedFilters.update((all) =>
      all.map((f) => (f.id === id ? { ...f, duration: validDur } : f)),
    );
  }

  updateFilterIntensity(id: string, intensity: number) {
    const validIntensity = Math.max(10, Math.min(100, Number(intensity)));
    this.appliedFilters.update((all) =>
      all.map((f) => (f.id === id ? { ...f, intensity: validIntensity } : f)),
    );
  }

  getFilterPresetName(presetId: string, lang: 'vi' | 'en'): string {
    const preset = this.videoFiltersList.find((f) => f.id === presetId);
    if (!preset) return presetId;
    return lang === "vi" ? preset.nameVi : preset.nameEn;
  }
}
