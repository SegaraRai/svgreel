/**
 * One playhead shared by every SVG on the page. Each view registers its CSS animations (paused),
 * and the clock sets their currentTime every animation frame, so all variants stay in sync and
 * can be scrubbed frame by frame.
 */
export class Clock {
  frame = 0;
  playing = true;
  speed = 1;
  loop = true;
  fps = 30;
  duration = 1;

  private views = new Set<Animation[]>();
  private listeners = new Set<() => void>();
  private last = 0;
  private version = 0;

  constructor() {
    const tick = (now: number) => {
      if (this.playing) {
        const dt = this.last ? now - this.last : 0;
        let f = this.frame + (dt / 1000) * this.fps * this.speed;
        if (f >= this.duration) {
          if (this.loop) {
            f %= this.duration;
          } else {
            f = this.duration - 1;
            this.playing = false;
          }
        }
        if (f < 0) {
          f = this.loop ? f + this.duration : 0;
        }
        this.frame = f;
        this.apply();
        this.emit();
      }
      this.last = now;
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
    this.apply();
    this.emit();
  }

  register(anims: Animation[]) {
    for (const a of anims) {
      a.pause();
    }
    this.views.add(anims);
    this.apply();
    return () => {
      this.views.delete(anims);
    };
  }

  seek(frame: number) {
    const d = this.duration;
    this.frame = this.loop ? ((frame % d) + d) % d : Math.min(d - 1, Math.max(0, frame));
    this.apply();
    this.emit();
  }

  set(patch: Partial<Pick<Clock, "playing" | "speed" | "loop">>) {
    Object.assign(this, patch);
    if (patch.playing && !this.loop && this.frame >= this.duration - 1) {
      this.frame = 0;
    }
    this.emit();
  }

  private apply() {
    const ms = (this.frame / this.fps) * 1000;
    for (const anims of this.views) {
      for (const a of anims) {
        a.currentTime = ms;
      }
    }
  }

  // useSyncExternalStore plumbing
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  snapshot = () => this.version;
  private emit() {
    this.version++;
    for (const fn of this.listeners) {
      fn();
    }
  }
}

export const clock = new Clock();
