import { Injectable, signal, inject } from '@angular/core';
import { WaveformProcessor } from './waveform-processor';

export interface AudioTrack {
  id: string;
  file: File;
  url: string;
  duration: number;
  waveform: number[];
  volume: number; // 0-100
  trimStart: number;
  trimEnd: number;
}

@Injectable({
  providedIn: 'root'
})
export class BackgroundAudio {
  private waveformProcessor = inject(WaveformProcessor);

  audioTracks = signal<AudioTrack[]>([]);
  isExtractingBgWaveform = signal<boolean>(false);
  
  previewAudio: HTMLAudioElement | null = null;
  playingTrackId = signal<string | null>(null);
  isolatedPreviewTime = signal<number>(0);
  isolatedPreviewAudio: HTMLAudioElement | null = null;
  isolatedPreviewInterval: ReturnType<typeof setInterval> | null = null;

  async onAudioSelected(event: Event, syncCallback: () => void) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      input.value = ''; // Reset input
      this.isExtractingBgWaveform.set(true);

      const newTracks: AudioTrack[] = [];
      for (const file of files) {
        const url = URL.createObjectURL(file);
        const duration = await new Promise<number>((resolve) => {
          const a = document.createElement('audio');
          a.onloadedmetadata = () => resolve(a.duration);
          a.src = url;
        });
        
        let waveform: number[] = [];
        try {
          const bars = Math.max(30, Math.floor((duration / 60) * 100));
          waveform = await this.waveformProcessor.extractWaveform(file, Math.min(200, bars));
        } catch(e) {
          console.warn('Could not extract waveform', e);
        }
        
        newTracks.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          url,
          duration,
          waveform,
          volume: 10,
          trimStart: 0,
          trimEnd: duration
        });
      }
      
      this.audioTracks.update(tracks => [...tracks, ...newTracks]);
      this.isExtractingBgWaveform.set(false);
      
      // Attempt to play if currently playing
      syncCallback();
    }
  }

  removeAudioTrack(id: string, syncCallback: () => void) {
    this.audioTracks.update(tracks => {
      const track = tracks.find(t => t.id === id);
      if (track) URL.revokeObjectURL(track.url);
      return tracks.filter(t => t.id !== id);
    });
    syncCallback();
  }

  setTrackVolume(id: string, volume: number, syncCallback: () => void) {
    this.audioTracks.update(tracks => tracks.map(t => t.id === id ? { ...t, volume } : t));
    
    if (this.playingTrackId() === id && this.isolatedPreviewAudio) {
      this.isolatedPreviewAudio.volume = volume / 100;
    }
    
    syncCallback();
  }

  setTrackTrimStart(id: string, start: number, syncCallback: () => void) {
    this.audioTracks.update(tracks => tracks.map(t => {
      if (t.id === id) {
          const newStart = Math.min(start, t.trimEnd - 0.1);
          return { ...t, trimStart: newStart };
      }
      return t;
    }));
    syncCallback();
  }

  setTrackTrimEnd(id: string, end: number, syncCallback: () => void) {
    this.audioTracks.update(tracks => tracks.map(t => {
      if (t.id === id) {
          const newEnd = Math.max(end, t.trimStart + 0.1);
          return { ...t, trimEnd: newEnd };
      }
      return t;
    }));
    syncCallback();
  }

  previewSpecificTrack(id: string, isPlaying: boolean, togglePlayCallback: () => void) {
    if (this.playingTrackId() === id) {
      this.stopIsolatedPreview();
      return;
    }

    this.stopIsolatedPreview();

    if (isPlaying) {
      togglePlayCallback();
    }

    const track = this.audioTracks().find(t => t.id === id);
    if (!track) return;

    this.playingTrackId.set(id);
    this.isolatedPreviewTime.set(track.trimStart);
    this.isolatedPreviewAudio = new Audio(track.url);
    this.isolatedPreviewAudio.currentTime = track.trimStart;
    this.isolatedPreviewAudio.volume = track.volume / 100;
    this.isolatedPreviewAudio.play().catch(e => console.error(e));

    this.isolatedPreviewInterval = setInterval(() => {
        if (this.isolatedPreviewAudio) {
            this.isolatedPreviewTime.set(this.isolatedPreviewAudio.currentTime);
            if (this.isolatedPreviewAudio.currentTime >= track.trimEnd) {
                this.stopIsolatedPreview();
            }
        }
    }, 1000 / 30); // ~30fps update
  }

  stopIsolatedPreview() {
    if (this.isolatedPreviewAudio) {
        this.isolatedPreviewAudio.pause();
        this.isolatedPreviewAudio = null;
    }
    if (this.isolatedPreviewInterval) {
        clearInterval(this.isolatedPreviewInterval);
        this.isolatedPreviewInterval = null;
    }
    this.isolatedPreviewTime.set(0);
    this.playingTrackId.set(null);
  }

  syncBackgroundAudio(
    videoEl: HTMLVideoElement | null | undefined,
    trimStart: number,
    trimEnd: number
  ) {
    if (this.playingTrackId()) return;

    if (this.audioTracks().length === 0) {
      if (this.previewAudio) {
        this.previewAudio.pause();
      }
      return;
    }
    
    // Find which track corresponds to the current video time relative to trimStart
    if (!videoEl) return;
    const videoCurrentTime = videoEl.currentTime;
    const relativeTime = Math.max(0, videoCurrentTime - trimStart);
    
    let accumulatedTime = 0;
    let targetTrack = null;
    let trackLocalTime = 0;
    
    for (const track of this.audioTracks()) {
      const activeDuration = track.trimEnd - track.trimStart;
      if (relativeTime >= accumulatedTime && relativeTime < accumulatedTime + activeDuration) {
        targetTrack = track;
        trackLocalTime = track.trimStart + (relativeTime - accumulatedTime);
        break;
      }
      accumulatedTime += activeDuration;
    }

    if (!targetTrack) {
        if (this.previewAudio) {
           this.previewAudio.pause();
        }
        return;
    }

    if (!this.previewAudio) {
      this.previewAudio = new Audio();
    }

    this.previewAudio.volume = targetTrack.volume / 100;
    
    if (this.previewAudio.src !== targetTrack.url) {
      const wasPlaying = !this.previewAudio.paused;
      this.previewAudio.src = targetTrack.url;
      this.previewAudio.currentTime = trackLocalTime;
      if (wasPlaying || (!videoEl.paused && videoCurrentTime < trimEnd)) {
         this.previewAudio.play().catch(e => console.warn(e));
      }
    } else {
      if (Math.abs(this.previewAudio.currentTime - trackLocalTime) > 0.15) {
        this.previewAudio.currentTime = trackLocalTime;
      }
      if ((videoEl.paused || videoCurrentTime >= trimEnd) && !this.previewAudio.paused) {
        this.previewAudio.pause();
      } else if (!videoEl.paused && videoCurrentTime < trimEnd && this.previewAudio.paused) {
        this.previewAudio.play().catch(e => console.warn(e));
      }
    }
  }
}
