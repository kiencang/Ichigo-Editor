import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { WaveformProcessor } from './waveform-processor';
import * as Tone from 'tone';
import { getVirtualTime, VideoSegment } from '../segments/segments';

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
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  audioTracks = signal<AudioTrack[]>([]);
  isExtractingBgWaveform = signal<boolean>(false);
  
  previewAudio: HTMLAudioElement | null = null;
  playingTrackId = signal<string | null>(null);
  isolatedPreviewTime = signal<number>(0);
  isolatedPreviewAudio: HTMLAudioElement | null = null;
  isolatedPreviewInterval: ReturnType<typeof setInterval> | null = null;

  // Tone.js Routing Elements
  private toneContextInitialized = false;
  private mainFilter: Tone.Filter | null = null;
  private mainVolume: Tone.Volume | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;

  private isolatedFilter: Tone.Filter | null = null;
  private isolatedVolume: Tone.Volume | null = null;
  private isolatedMediaSource: MediaElementAudioSourceNode | null = null;

  constructor() {
    if (this.isBrowser) {
      this.previewAudio = new Audio();
      this.isolatedPreviewAudio = new Audio();
    }
  }

  initTone() {
    if (this.toneContextInitialized) return;
    try {
      // Start context
      Tone.start();

      // Master EQ & Filter for main video sync audio
      this.mainFilter = new Tone.Filter({
        frequency: 20000,
        type: 'lowpass',
        rolloff: -12
      }).toDestination();
      
      this.mainVolume = new Tone.Volume(0).connect(this.mainFilter);
      
      const rawCtx = Tone.context;
      if (this.previewAudio && rawCtx) {
        // Create standard browser MediaElementSourceNode and connect via Tone.connect
        this.mediaSource = rawCtx.createMediaElementSource(this.previewAudio);
        Tone.connect(this.mediaSource, this.mainVolume);
      }

      // Filter and volume control for hearing/isolated audio track previewing
      this.isolatedFilter = new Tone.Filter({
        frequency: 20000,
        type: 'lowpass'
      }).toDestination();

      this.isolatedVolume = new Tone.Volume(0).connect(this.isolatedFilter);

      if (this.isolatedPreviewAudio && rawCtx) {
        this.isolatedMediaSource = rawCtx.createMediaElementSource(this.isolatedPreviewAudio);
        Tone.connect(this.isolatedMediaSource, this.isolatedVolume);
      }

      this.toneContextInitialized = true;
    } catch (e) {
      console.warn('Failed to initialize Tone.js architecture:', e);
    }
  }

  async onAudioSelected(event: Event, syncCallback: () => void) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      // Ensure Tone.js is initialized on user interaction
      this.initTone();

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
        const bars = Math.max(30, Math.floor((duration / 60) * 100));
        const numSamples = Math.min(200, bars);
        try {
          waveform = await this.waveformProcessor.extractWaveform(file, numSamples);
        } catch(e) {
          console.warn('Could not extract waveform, using flat baseline:', e);
          waveform = Array(numSamples).fill(0.12);
        }
        
        newTracks.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          url,
          duration,
          waveform,
          volume: 10, // default volume at 10%
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
    
    this.initTone();
    const dbValue = Tone.gainToDb(Math.max(0.001, volume / 100));

    if (this.playingTrackId() === id && this.isolatedVolume) {
      this.isolatedVolume.volume.rampTo(dbValue, 0.1);
    } else if (this.previewAudio && this.mainVolume) {
      const track = this.audioTracks().find(t => t.id === id);
      if (track && this.previewAudio.src === track.url) {
        this.mainVolume.volume.rampTo(dbValue, 0.1);
      }
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
    this.initTone();

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

    if (this.isolatedPreviewAudio) {
      this.isolatedPreviewAudio.src = track.url;
      this.isolatedPreviewAudio.currentTime = track.trimStart;
      
      if (this.isolatedVolume) {
        const dbValue = Tone.gainToDb(Math.max(0.001, track.volume / 100));
        this.isolatedVolume.volume.value = dbValue;
      }

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
  }

  stopIsolatedPreview() {
    if (this.isolatedPreviewAudio) {
        this.isolatedPreviewAudio.pause();
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
    segments: VideoSegment[],
    trimStart: number,
    trimEnd: number,
    muffled = false
  ) {
    if (this.playingTrackId()) return;

    if (this.audioTracks().length === 0) {
      if (this.previewAudio) {
        this.previewAudio.pause();
      }
      return;
    }

    this.initTone();

    // Muffled sweep transitions using Tone.jsFilter!
    if (this.mainFilter) {
      const targetFreq = muffled ? 650 : 20000;
      this.mainFilter.frequency.rampTo(targetFreq, 0.45);
    }
    
    // Find which track corresponds to the current video time relative to trimStart
    if (!videoEl) return;
    const videoCurrentTime = videoEl.currentTime;

    // Use virtualTime mappings to avoid audio cutting out on deleted segments
    const relativeTime = segments && segments.length > 0 
      ? getVirtualTime(videoCurrentTime, segments)
      : Math.max(0, videoCurrentTime - trimStart);
    
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

    if (this.mainVolume) {
      let transitionFadeOpacity = 0;
      if (segments && segments.length > 1 && videoEl) {
        const idx = segments.findIndex(s => videoCurrentTime >= s.start && videoCurrentTime <= s.end);
        if (idx !== -1) {
          const seg = segments[idx];
          const segDuration = seg.end - seg.start;
          const activeFadeDuration = Math.min(0.25, segDuration / 2);

          if (idx > 0 && videoCurrentTime < seg.start + activeFadeDuration) {
            const progress = (videoCurrentTime - seg.start) / activeFadeDuration;
            transitionFadeOpacity = Math.max(0, Math.min(1, 1 - progress));
          } else if (idx < segments.length - 1 && videoCurrentTime > seg.end - activeFadeDuration) {
            const progress = (seg.end - videoCurrentTime) / activeFadeDuration;
            transitionFadeOpacity = Math.max(0, Math.min(1, 1 - progress));
          }
        }
      }

      const baseGain = targetTrack.volume / 100;
      const fadedGain = baseGain * (1 - transitionFadeOpacity);
      const dbValue = Tone.gainToDb(Math.max(0.001, fadedGain));
      this.mainVolume.volume.value = dbValue;
    }
    
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
