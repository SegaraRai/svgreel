/**
 * A composition's audio track in the preview.
 *
 * Served over http (`--watch`), the file is decoded into Web Audio and becomes the master clock:
 * the clock asks it what the listener hears right now (output latency included), so picture and
 * sound never drift. Opened from file://, fetch is blocked, so a plain <audio> element plays the
 * file and the clock keeps it in step instead (looser, but no server needed).
 */
export class AudioTrack {
  /** "buffer": Web Audio, drives the clock. "element": <audio>, follows the clock. */
  mode: "loading" | "buffer" | "element" = "loading";

  #ctx?: AudioContext;
  #buffer?: AudioBuffer;
  #source?: AudioBufferSourceNode;
  #el?: HTMLAudioElement;
  #timer?: ReturnType<typeof setTimeout>;
  /** Context time at which file time 0 is (or would be) heard. */
  #zero = 0;
  #disposed = false;

  readonly #onReady: () => void;

  constructor(
    readonly url: string,
    onReady: () => void,
  ) {
    this.#onReady = onReady;
    void this.#load();
  }

  async #load() {
    try {
      const res = await fetch(this.url);
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      const data = await res.arrayBuffer();
      const ctx = new AudioContext();
      this.#buffer = await ctx.decodeAudioData(data);
      this.#ctx = ctx;
      this.mode = "buffer";
      if (ctx.state !== "running") {
        // Autoplay policy: the context runs only after a user gesture. Until then the clock
        // keeps its own time; on the first click or key press, restart in sync.
        const resume = () => {
          window.removeEventListener("pointerdown", resume);
          window.removeEventListener("keydown", resume);
          void ctx.resume().then(() => !this.#disposed && this.#onReady());
        };
        window.addEventListener("pointerdown", resume);
        window.addEventListener("keydown", resume);
      }
    } catch {
      this.#el = new Audio(this.url);
      this.#el.preload = "auto";
      this.mode = "element";
    }
    if (this.#disposed) {
      this.dispose();
      return;
    }
    this.#onReady();
  }

  get playing(): boolean {
    return this.mode === "buffer" ? !!this.#source : !!this.#el && !this.#el.paused;
  }

  /** Plays from `fileTime` seconds (negative: starts after that many seconds of silence). */
  start(fileTime: number) {
    this.stop();
    if (this.mode === "buffer") {
      const ctx = this.#ctx!;
      void ctx.resume();
      const src = ctx.createBufferSource();
      src.buffer = this.#buffer!;
      src.connect(ctx.destination);
      const when = ctx.currentTime + 0.05;
      this.#zero = when - fileTime;
      if (fileTime >= 0) {
        src.start(when, fileTime);
      } else {
        src.start(when - fileTime, 0);
      }
      this.#source = src;
    } else if (this.#el) {
      const el = this.#el;
      const go = () => {
        el.currentTime = Math.max(0, fileTime);
        void el.play().catch(() => {});
      };
      if (fileTime >= 0) {
        go();
      } else {
        this.#timer = setTimeout(go, -fileTime * 1000);
      }
    }
  }

  stop() {
    clearTimeout(this.#timer);
    if (this.#source) {
      this.#source.stop();
      this.#source.disconnect();
      this.#source = undefined;
    }
    this.#el?.pause();
  }

  /** File time the listener hears now (buffer mode only; null otherwise or when stopped). */
  heardTime(): number | null {
    const ctx = this.#ctx;
    if (this.mode !== "buffer" || !this.#source || !ctx || ctx.state !== "running") {
      return null;
    }
    const ts = ctx.getOutputTimestamp?.();
    const now =
      ts && ts.performanceTime && ts.contextTime !== undefined
        ? ts.contextTime + (performance.now() - ts.performanceTime) / 1000
        : ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
    return now - this.#zero;
  }

  /** Element mode: current file time, or null. */
  elementTime(): number | null {
    return this.#el && !this.#el.paused ? this.#el.currentTime : null;
  }

  dispose() {
    this.#disposed = true;
    this.stop();
    void this.#ctx?.close();
    this.#ctx = undefined;
    this.#el = undefined;
  }
}
