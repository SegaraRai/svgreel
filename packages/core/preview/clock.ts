import { AudioTrack } from "./audio";

/**
 * One playhead shared by every SVG on the page. Each view registers its CSS animations (paused),
 * and the clock sets their currentTime every animation frame, so all variants stay in sync and
 * can be scrubbed frame by frame.
 *
 * With a composition audio track and sound on, playback at 1× follows the audio: the frame is
 * derived from what the listener hears, so the picture stays locked to the sound.
 */
export class Clock {
  frame = 0;
  playing = true;
  speed = 1;
  loop = true;
  sound = false;
  fps = 30;
  duration = 1;

  #views = new Set<Animation[]>();
  #listeners = new Set<() => void>();
  #last = 0;
  #version = 0;
  #track?: AudioTrack;
  /** Timeline seconds at which the audio file's 0 s plays. */
  #offset = 0;

  constructor() {
    const tick = (now: number) => {
      if (this.playing) {
        const heard = this.#audible() ? this.#track!.heardTime() : null;
        let f: number;
        if (heard !== null) {
          f = (heard + this.#offset) * this.fps;
          // Right after (re)starting, the sound is still in the output buffer: hold the picture
          // instead of stepping back.
          if (f < this.frame && this.frame - f < 0.3 * this.fps) {
            f = this.frame;
          }
        } else {
          const dt = this.#last ? now - this.#last : 0;
          f = this.frame + (dt / 1000) * this.fps * this.speed;
        }
        if (f >= this.duration) {
          if (this.loop) {
            f %= this.duration;
            this.frame = f;
            this.#restartAudio();
          } else {
            f = this.duration - 1;
            this.playing = false;
            this.#restartAudio();
          }
        }
        if (f < 0) {
          f = this.loop ? f + this.duration : 0;
        }
        this.frame = f;
        this.#followAudio();
        this.#apply();
        this.#emit();
      }
      this.#last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  configure(fps: number, duration: number) {
    this.fps = fps;
    this.duration = Math.max(1, duration);
    if (this.frame >= this.duration) {
      this.frame = 0;
    }
    this.#apply();
    this.#restartAudio();
    this.#emit();
  }

  /** Sets (or clears) the audio track. `url` is relative to the page. */
  setAudio(url: string | null, offset = 0) {
    if (this.#track && this.#track.url === url && this.#offset === offset) {
      return;
    }
    this.#track?.dispose();
    this.#track = undefined;
    this.#offset = offset;
    if (url) {
      this.#track = new AudioTrack(url, () => {
        this.#restartAudio();
        this.#emit();
      });
    }
    this.#emit();
  }

  get hasAudio(): boolean {
    return !!this.#track;
  }

  register(anims: Animation[]) {
    for (const a of anims) {
      a.pause();
    }
    this.#views.add(anims);
    this.#apply();
    return () => {
      this.#views.delete(anims);
    };
  }

  seek(frame: number) {
    const d = this.duration;
    this.frame = this.loop ? ((frame % d) + d) % d : Math.min(d - 1, Math.max(0, frame));
    this.#apply();
    this.#restartAudio();
    this.#emit();
  }

  set(patch: Partial<Pick<Clock, "playing" | "speed" | "loop" | "sound">>) {
    Object.assign(this, patch);
    if (patch.playing && !this.loop && this.frame >= this.duration - 1) {
      this.frame = 0;
    }
    if ("playing" in patch || "speed" in patch || "sound" in patch) {
      this.#restartAudio();
    }
    this.#emit();
  }

  /** Sound plays only at 1× (other speeds would change its pitch or drift). */
  #audible(): boolean {
    return !!this.#track && this.sound && this.playing && this.speed === 1 && this.#track.mode !== "loading";
  }

  #restartAudio() {
    if (!this.#track) {
      return;
    }
    if (this.#audible()) {
      this.#track.start(this.frame / this.fps - this.#offset);
    } else {
      this.#track.stop();
    }
  }

  /** <audio> fallback: nudge the element when it drifts from the clock. */
  #followAudio() {
    if (!this.#audible() || this.#track!.mode !== "element") {
      return;
    }
    const want = this.frame / this.fps - this.#offset;
    const at = this.#track!.elementTime();
    if (want >= 0 && (at === null || Math.abs(at - want) > 0.1)) {
      this.#track!.start(want);
    }
  }

  #apply() {
    const ms = (this.frame / this.fps) * 1000;
    for (const anims of this.#views) {
      for (const a of anims) {
        a.currentTime = ms;
      }
    }
  }

  // useSyncExternalStore plumbing
  subscribe = (fn: () => void) => {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  };
  snapshot = () => this.#version;
  #emit() {
    this.#version++;
    for (const fn of this.#listeners) {
      fn();
    }
  }
}

export const clock = new Clock();
