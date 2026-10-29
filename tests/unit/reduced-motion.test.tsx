import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

type Listener = () => void;

function stubMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mq = {
    matches: initial,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  const matchMedia = vi.fn((query: string) => {
    expect(query).toBe("(prefers-reduced-motion: reduce)");
    return mq;
  });
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    set(value: boolean) {
      mq.matches = value;
      listeners.forEach((l) => l());
    },
    listeners,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("usePrefersReducedMotion", () => {
  it("reads the media query and follows changes", () => {
    const media = stubMatchMedia(true);
    const { result, unmount } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
    act(() => media.set(false));
    expect(result.current).toBe(false);
    unmount();
    expect(media.listeners.size).toBe(0);
  });

  it("is false when the visitor has no preference", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });
});
