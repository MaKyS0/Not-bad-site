/**
 * Small animation vocabulary on top of Motion (motion.dev, "mini" WAAPI build,
 * ~6 KB). Everything runs on opacity/transform where possible, so the browser
 * can animate on the compositor without layout work. Everything is skipped
 * when the user asks for reduced motion.
 *
 * Elements are never hidden up front: every animation starts from its first
 * keyframe only while it runs, so if it never runs (background tab, print,
 * reduced motion) the content is simply shown as is.
 */
import { animate } from 'motion/mini';
import { inView, spring, stagger } from 'motion';

type Targets = Element | ArrayLike<Element> | null | undefined;

const list = (t: Targets): Element[] => (!t ? [] : t instanceof Element ? [t] : Array.from(t));

export const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Timing. Long, decelerating ease-outs (no overshoot) read as smooth; springs
 * are nearly critically damped so nothing wobbles.
 */
const easeOut = [0.16, 1, 0.3, 1] as const; // "easeOutExpo"-like: quick start, very soft landing
const easeInOut = [0.65, 0, 0.35, 1] as const;
const soft = { type: spring, visualDuration: 0.5, bounce: 0.06 };

/** Fade + short rise; with several elements they follow each other. */
export function enter(targets: Targets, opts: { y?: number; delay?: number; gap?: number; duration?: number } = {}): void {
  const els = list(targets);
  if (!els.length || reducedMotion()) return;
  animate(
    els,
    { opacity: [0, 1], transform: [`translateY(${opts.y ?? 12}px)`, 'translateY(0)'] },
    { duration: opts.duration ?? 0.6, delay: stagger(opts.gap ?? 0.05, { startDelay: opts.delay ?? 0 }), ease: easeOut },
  );
}

/** Soft spring appearance for things that just showed up because of the user (results, panels). */
export function pop(targets: Targets, opts: { scale?: number; y?: number } = {}): void {
  const els = list(targets);
  if (!els.length || reducedMotion()) return;
  animate(els, { opacity: [0, 1], transform: [`translateY(${opts.y ?? 10}px) scale(${opts.scale ?? 0.98})`, 'translateY(0) scale(1)'] }, soft);
}

/** Fade an element out (and down a little), then resolve. */
export async function leave(target: Element, opts: { y?: number } = {}): Promise<void> {
  if (reducedMotion()) return;
  await animate(target, { opacity: [1, 0], transform: ['translateY(0)', `translateY(${opts.y ?? 8}px)`] }, { duration: 0.4, ease: easeInOut });
}

/** A gentle swell to draw the eye to something that changed (a result, a saving). */
export function nudge(target: Element | null | undefined, opts: { scale?: number } = {}): void {
  if (!target || reducedMotion()) return;
  animate(target, { transform: ['scale(1)', `scale(${opts.scale ?? 1.05})`, 'scale(1)'] }, { duration: 0.7, ease: easeInOut, times: [0, 0.4, 1] });
}

/** Lift an icon (used while files are dragged over a drop zone). */
export function hop(target: Element | null | undefined): void {
  if (!target || reducedMotion()) return;
  animate(target, { transform: ['translateY(0)', 'translateY(-6px)', 'translateY(0)'] }, { duration: 0.7, ease: easeInOut, times: [0, 0.45, 1] });
}

/** Reveal the children of `container` (matching `selector`) as they scroll into view, once. */
export function reveal(container: Element, selector: string): void {
  if (reducedMotion() || typeof IntersectionObserver === 'undefined') return;
  inView(
    container.querySelectorAll(selector),
    (el) => {
      enter(el, { y: 18, duration: 0.8 });
    },
    { amount: 0.1, margin: '0px 0px -40px 0px' },
  );
}

/** Animate a number from 0 to its value ("41" tools …). */
export function countUp(el: HTMLElement, to: number, format: (n: number) => string = (n) => String(Math.round(n))): void {
  if (reducedMotion()) return;
  const start = performance.now();
  const duration = 1200;
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / duration);
    el.textContent = format(to * (1 - Math.pow(1 - p, 4)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** The newest toggle per panel, so a quick open→close→open never ends in the wrong state. */
const toggles = new WeakMap<HTMLElement, { stop(): void }>();

/** Open/close a panel by animating its height; can be reversed mid-way (the element must be display:block when open). */
export async function toggleHeight(el: HTMLElement, open: boolean): Promise<void> {
  toggles.get(el)?.stop();
  if (reducedMotion()) {
    el.hidden = !open;
    return;
  }
  // Start from wherever a running animation left the panel.
  const from = el.hidden ? 0 : el.getBoundingClientRect().height;
  const opacity = el.hidden ? 0 : Number(getComputedStyle(el).opacity);
  el.hidden = false;
  el.style.overflow = 'hidden';
  el.style.removeProperty('height');
  const to = open ? el.scrollHeight : 0;
  const anim = animate(
    el,
    { height: [`${from}px`, `${to}px`], opacity: [opacity, open ? 1 : 0] },
    open ? soft : { duration: 0.35, ease: easeInOut },
  );
  toggles.set(el, anim);
  try {
    await anim;
  } catch {
    return;
  }
  if (toggles.get(el) !== anim) return; // superseded by a newer toggle
  toggles.delete(el);
  if (!open) el.hidden = true;
  el.style.removeProperty('height');
  el.style.removeProperty('overflow');
  el.style.removeProperty('opacity');
}

/** Smoothly expand <details> content instead of the instant jump. */
export function smoothDetails(root: ParentNode): void {
  if (reducedMotion()) return;
  root.querySelectorAll<HTMLDetailsElement>('details').forEach((d) => {
    d.addEventListener('toggle', () => {
      if (!d.open) return;
      const body = Array.from(d.children).filter((c) => c.tagName !== 'SUMMARY');
      animate(body, { opacity: [0, 1], transform: ['translateY(-6px)', 'translateY(0)'] }, { duration: 0.45, ease: easeOut });
    });
  });
}
