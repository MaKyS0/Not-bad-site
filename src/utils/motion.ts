/**
 * Small animation vocabulary on top of Motion (motion.dev, "mini" WAAPI build,
 * ~6 KB). Everything is skipped when the user asks for reduced motion.
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

const snappy = { type: spring, visualDuration: 0.28, bounce: 0.18 };
const bouncy = { type: spring, visualDuration: 0.32, bounce: 0.35 };

/** Fade + short rise; with several elements they follow each other. */
export function enter(targets: Targets, opts: { y?: number; delay?: number; gap?: number; duration?: number } = {}): void {
  const els = list(targets);
  if (!els.length || reducedMotion()) return;
  animate(
    els,
    { opacity: [0, 1], transform: [`translateY(${opts.y ?? 8}px)`, 'translateY(0)'] },
    { duration: opts.duration ?? 0.26, delay: stagger(opts.gap ?? 0.035, { startDelay: opts.delay ?? 0 }), ease: [0.2, 0.7, 0.2, 1] },
  );
}

/** Springy appearance for things that just showed up because of the user (results, panels). */
export function pop(targets: Targets, opts: { scale?: number; y?: number } = {}): void {
  const els = list(targets);
  if (!els.length || reducedMotion()) return;
  animate(els, { opacity: [0, 1], transform: [`translateY(${opts.y ?? 6}px) scale(${opts.scale ?? 0.97})`, 'translateY(0) scale(1)'] }, snappy);
}

/** A short nudge to draw the eye to something that changed (a result, a saving). */
export function nudge(target: Element | null | undefined, opts: { scale?: number } = {}): void {
  if (!target || reducedMotion()) return;
  animate(target, { transform: ['scale(1)', `scale(${opts.scale ?? 1.06})`, 'scale(1)'] }, { duration: 0.32, ease: 'easeOut' });
}

/** Bounce an icon (used while files are dragged over a drop zone). */
export function hop(target: Element | null | undefined): void {
  if (!target || reducedMotion()) return;
  animate(target, { transform: ['translateY(0)', 'translateY(-5px)', 'translateY(0)'] }, bouncy);
}

/** Reveal the children of `container` (matching `selector`) as they scroll into view, once. */
export function reveal(container: Element, selector: string): void {
  if (reducedMotion() || typeof IntersectionObserver === 'undefined') return;
  inView(
    container.querySelectorAll(selector),
    (el) => {
      enter(el, { y: 12, duration: 0.32 });
    },
    { amount: 0.15 },
  );
}

/** Animate a number from 0 to its value ("41" tools …). */
export function countUp(el: HTMLElement, to: number, format: (n: number) => string = (n) => String(Math.round(n))): void {
  if (reducedMotion()) return;
  const start = performance.now();
  const duration = 700;
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / duration);
    el.textContent = format(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Open/close a panel by animating its height (the element must be display:block when open). */
export async function toggleHeight(el: HTMLElement, open: boolean): Promise<void> {
  if (reducedMotion()) {
    el.hidden = !open;
    return;
  }
  if (open) {
    el.hidden = false;
    const h = el.scrollHeight;
    el.style.overflow = 'hidden';
    await animate(el, { height: ['0px', `${h}px`], opacity: [0, 1] }, snappy);
  } else {
    el.style.overflow = 'hidden';
    await animate(el, { height: [`${el.offsetHeight}px`, '0px'], opacity: [1, 0] }, { duration: 0.18, ease: 'easeIn' });
    el.hidden = true;
  }
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
      animate(body, { opacity: [0, 1], transform: ['translateY(-4px)', 'translateY(0)'] }, { duration: 0.2, ease: 'easeOut' });
    });
  });
}
