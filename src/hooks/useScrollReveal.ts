import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_DELAY_INDEX = 10;

function checkReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useScrollRevealGroup(groupKey: string) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(
    checkReducedMotion
  );
  const [revealed, setRevealed] = useState<Record<string, number>>({});

  const revealedRef = useRef<Record<string, number>>({});
  const elementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const nodeToIdRef = useRef<WeakMap<Element, string>>(new WeakMap());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setPrefersReducedMotion(mql.matches);
    setPrefersReducedMotion(mql.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    revealedRef.current = {};
    setRevealed({});

    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const newlyVisible: Array<{
          id: string;
          target: Element;
          top: number;
          left: number;
        }> = [];

        for (const entry of entries) {
          if (!entry.isIntersecting && entry.boundingClientRect.top >= 0) {
            continue;
          }
          const id = nodeToIdRef.current.get(entry.target);
          if (!id || revealedRef.current[id] !== undefined) continue;
          newlyVisible.push({
            id,
            target: entry.target,
            top: entry.boundingClientRect.top,
            left: entry.boundingClientRect.left,
          });
        }

        if (newlyVisible.length === 0) return;

        newlyVisible.sort((a, b) => a.top - b.top || a.left - b.left);

        const nextMap = { ...revealedRef.current };
        newlyVisible.forEach((item, index) => {
          nextMap[item.id] = Math.min(index, MAX_DELAY_INDEX);
          observer.unobserve(item.target);
        });
        revealedRef.current = nextMap;

        if (rafIdRef.current !== null) {
          window.cancelAnimationFrame(rafIdRef.current);
        }
        rafIdRef.current = window.requestAnimationFrame(() => {
          setRevealed({ ...revealedRef.current });
          rafIdRef.current = null;
        });
      },
      {
        threshold: 0.06,
        rootMargin: '0px 0px -20px 0px',
      }
    );

    observerRef.current = observer;

    elementsRef.current.forEach((el, id) => {
      if (revealedRef.current[id] === undefined) {
        observer.observe(el);
      }
    });

    return () => {
      observer.disconnect();
      observerRef.current = null;
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [groupKey, prefersReducedMotion]);

  const registerElement = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      const prevEl = elementsRef.current.get(id);
      if (prevEl && prevEl !== el) {
        observerRef.current?.unobserve(prevEl);
        nodeToIdRef.current.delete(prevEl);
        elementsRef.current.delete(id);
      }

      if (el) {
        elementsRef.current.set(id, el);
        nodeToIdRef.current.set(el, id);
        if (
          observerRef.current &&
          !prefersReducedMotion &&
          revealedRef.current[id] === undefined
        ) {
          observerRef.current.observe(el);
        }
      }
    },
    [prefersReducedMotion]
  );

  const getRevealProps = useCallback(
    (id: string) => {
      if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
        return {
          ref: registerElement(id),
          className: 'scroll-reveal is-visible',
        };
      }

      const delayIndex = revealed[id];
      const isVisible = delayIndex !== undefined;
      return {
        ref: registerElement(id),
        className: isVisible
          ? `scroll-reveal is-visible scroll-reveal-delay-${delayIndex}`
          : 'scroll-reveal',
      };
    },
    [prefersReducedMotion, registerElement, revealed]
  );

  return { getRevealProps };
}
