declare module 'gifenc' {
  export interface GIFEncoder {
    writeFrame: (index: Uint8Array, width: number, height: number, options?: {
      palette: number[][];
      delay?: number;
    }) => void;
    finish: () => void;
    bytes: () => Uint8Array;
  }
  export function GIFEncoder(options?: { auto?: boolean; format?: string }): GIFEncoder;
  export function quantize(rgba: Uint8ClampedArray | Uint8Array, maxColors: number, options?: { format?: string }): number[][];
  export function applyPalette(rgba: Uint8ClampedArray | Uint8Array, palette: number[][], format?: string): Uint8Array;
}
