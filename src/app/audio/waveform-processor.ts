import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WaveformProcessor {
  async extractWaveform(file: File, numSamples = 120): Promise<number[]> {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('AudioContext not supported');
    }

    return new Promise((resolve, reject) => {
      const audioCtx = new AudioContextClass();
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          if (!arrayBuffer) {
            audioCtx.close();
            reject(new Error('ArrayBuffer is empty'));
            return;
          }

          audioCtx.decodeAudioData(
            arrayBuffer,
            (audioBuffer) => {
              try {
                if (audioBuffer.numberOfChannels === 0) {
                  audioCtx.close();
                  reject(new Error('No audio channels found'));
                  return;
                }
                const channelData = audioBuffer.getChannelData(0);
                const blockSize = Math.floor(channelData.length / numSamples) || 1;
                const amps: number[] = [];
                let maxAmp = 0;

                for (let i = 0; i < numSamples; i++) {
                  const start = i * blockSize;
                  let sum = 0;
                  let count = 0;
                  for (let j = 0; j < blockSize && (start + j) < channelData.length; j++) {
                    const val = channelData[start + j];
                    sum += val * val;
                    count++;
                  }
                  const rms = count > 0 ? Math.sqrt(sum / count) : 0;
                  amps.push(rms);
                  if (rms > maxAmp) {
                    maxAmp = rms;
                  }
                }

                const normalized = amps.map(v => maxAmp > 0 ? Math.min(0.95, Math.max(0.12, (v / maxAmp) * 0.95)) : 0.15);
                audioCtx.close();
                resolve(normalized);
              } catch (err) {
                audioCtx.close();
                reject(err);
              }
            },
            (err) => {
              audioCtx.close();
              reject(err);
            }
          );
        } catch (err) {
          audioCtx.close();
          reject(err);
        }
      };

      reader.onerror = (err) => {
        audioCtx.close();
        reject(err);
      };

      reader.readAsArrayBuffer(file);
    });
  }
}
