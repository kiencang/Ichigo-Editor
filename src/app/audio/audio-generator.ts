import { Injectable } from '@angular/core';

export type AudioEffectType = 'none' | 'swoosh' | 'digital-spark' | 'ambient-bell' | 'custom';

@Injectable({
  providedIn: 'root'
})
export class AudioGenerator {
  
  private audioCtx: AudioContext | null = null;
  
  private getContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    return this.audioCtx;
  }

  async generateEffectBlobUrl(type: 'swoosh' | 'digital-spark' | 'ambient-bell', duration: number): Promise<string> {
    const ctx = new OfflineAudioContext(1, 44100 * duration, 44100);
    
    if (type === 'swoosh') {
      this.renderSwoosh(ctx, duration);
    } else if (type === 'digital-spark') {
      this.renderDigitalSpark(ctx, duration);
    } else if (type === 'ambient-bell') {
      this.renderAmbientBell(ctx, duration);
    }
    
    const renderedBuffer = await ctx.startRendering();
    return this.bufferToWaveBlobUrl(renderedBuffer, ctx.length);
  }

  private renderSwoosh(ctx: OfflineAudioContext, duration: number) {
    const bufSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    
    // Pink-ish noise generation using Paul Kellet's method
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11; // compensate for gain
        b6 = white * 0.115926;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    // Wind filter sweep
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(200, 0);
    bandpass.frequency.exponentialRampToValueAtTime(3000, duration * 0.4);
    bandpass.frequency.exponentialRampToValueAtTime(200, duration);
    bandpass.Q.setValueAtTime(1.5, 0); // Some resonance
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, 0);
    noiseGain.gain.linearRampToValueAtTime(1.0, duration * 0.4);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, duration);
    
    noise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    // Sub bass drop
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(80, 0);
    subOsc.frequency.exponentialRampToValueAtTime(20, duration);
    
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0, 0);
    subGain.gain.linearRampToValueAtTime(0.8, duration * 0.1);
    subGain.gain.exponentialRampToValueAtTime(0.01, duration);
    
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    
    noise.start(0);
    subOsc.start(0);
    subOsc.stop(duration);
  }

  private renderDigitalSpark(ctx: OfflineAudioContext, duration: number) {
    // Generate a rapid sequence of high pitches with delay for a futuristic tech sound
    
    // Create delay line
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.12;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(ctx.destination);
    
    // Create multiple quick chirps
    const numChirps = 3;
    for (let i = 0; i < numChirps; i++) {
        const t = i * 0.08; // chirp every 80ms
        if (t >= duration) break;
        
        const osc = ctx.createOscillator();
        osc.type = 'square';
        
        // Pitch sweep
        osc.frequency.setValueAtTime(3000 + i * 1500, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.05);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, 0);
        
        osc.connect(gain);
        gain.connect(filter);
        filter.connect(ctx.destination);
        filter.connect(delay); // send to delay
        
        osc.start(t);
        osc.stop(t + 0.05);
    }
  }

  private renderAmbientBell(ctx: OfflineAudioContext, duration: number) {
    // Synthesis for a bell-like ethereal tone
    const fundamental = 392; // G4
    
    // In a bell, harmonics are often inharmonic
    const ratios = [1, 2, 2.4, 3, 4.5, 5.33, 6];
    
    ratios.forEach((ratio, index) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(fundamental * ratio, 0);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, 0);
        
        // Attack
        gain.gain.linearRampToValueAtTime(1.0 / (index + 1), 0.02);
        
        // Decay exponentially, higher frequencies decay faster
        const decayTime = Math.max(0.2, duration * (1 - index * 0.15));
        gain.gain.exponentialRampToValueAtTime(0.001, decayTime);
        
        // Add a slight detuned twin for chorus effect
        const oscTwin = ctx.createOscillator();
        oscTwin.type = 'sine';
        oscTwin.frequency.setValueAtTime(fundamental * ratio * (1 + 0.004), 0);
        
        const gainTwin = ctx.createGain();
        gainTwin.gain.setValueAtTime(0, 0);
        gainTwin.gain.linearRampToValueAtTime(0.8 / (index + 1), 0.03);
        gainTwin.gain.exponentialRampToValueAtTime(0.001, decayTime * 0.9);
        
        // Master filter for the bell
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(4500, 0);
        
        osc.connect(gain);
        gain.connect(filter);
        oscTwin.connect(gainTwin);
        gainTwin.connect(filter);
        
        filter.connect(ctx.destination);
        
        osc.start(0);
        osc.stop(duration);
        oscTwin.start(0);
        oscTwin.stop(duration);
    });
  }

  private bufferToWaveBlobUrl(abuffer: AudioBuffer, len: number): string {
    const numOfChan = abuffer.numberOfChannels;
    const length = len * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i, sample;
    let offset = 0;
    let pos = 0;

    // write WAVE header
    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"

    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit (hardcoded in this script)

    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length - pos - 4);                   // chunk length

    for(i = 0; i < abuffer.numberOfChannels; i++) {
      channels.push(abuffer.getChannelData(i));
    }

    while(pos < length) {
      for(i = 0; i < numOfChan; i++) {             // interleave channels
        sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
        view.setInt16(pos, sample, true);          // write 16-bit sample
        pos += 2;
      }
      offset++                                     // next source sample
    }

    const audioBlob = new Blob([buffer], {type: "audio/wav"});
    return URL.createObjectURL(audioBlob);

    function setUint16(data: number) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data: number) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  }
}
