declare module 'gifenc' {
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: Record<string, unknown>): number[][];
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: number[][], format?: string): Uint8Array;
  export function GIFEncoder(opts?: { auto?: boolean }): {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: { palette?: number[][]; delay?: number; repeat?: number; transparent?: boolean; transparentIndex?: number }): void;
    finish(): void;
    bytes(): Uint8Array;
  };
}
