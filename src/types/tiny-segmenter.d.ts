declare module 'tiny-segmenter' {
  export default class TinySegmenter {
    constructor();
    segment(text: string): string[];
  }
}
