import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalEmbed } from "@/features/contact/CalEmbed";
import { calLinkFromEnv } from "@/features/contact/cal-link";

const theme = vi.hoisted(() => ({ resolvedTheme: "light" as string | undefined }));
const calApi = vi.hoisted(() => ({ cal: vi.fn(), getCalApi: vi.fn() }));

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: theme.resolvedTheme }) }));

vi.mock("@calcom/embed-react", () => ({
  default: ({ calLink, namespace, config }: { calLink: string; namespace?: string; config?: { theme?: string } }) => (
    <div data-testid="cal" data-cal-link={calLink} data-namespace={namespace} data-theme={config?.theme} />
  ),
  getCalApi: calApi.getCalApi,
}));

// Records each observer so a test can fire the intersection by hand.
class FakeObserver {
  static instances: FakeObserver[] = [];
  callback: IntersectionObserverCallback;
  observed: Element[] = [];
  disconnected = false;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    FakeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
  fire(isIntersecting: boolean) {
    const entries = this.observed.map((target) => ({ isIntersecting, target })) as IntersectionObserverEntry[];
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

beforeEach(() => {
  FakeObserver.instances = [];
  theme.resolvedTheme = "light";
  calApi.cal.mockReset();
  calApi.getCalApi.mockReset().mockResolvedValue(calApi.cal);
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CalEmbed", () => {
  it("renders no embed until the card intersects the viewport", async () => {
    render(<CalEmbed calLink="zaid/30min" />);
    expect(screen.queryByTestId("cal")).not.toBeInTheDocument();
    expect(FakeObserver.instances).toHaveLength(1);

    act(() => FakeObserver.instances[0].fire(false));
    expect(screen.queryByTestId("cal")).not.toBeInTheDocument();

    act(() => FakeObserver.instances[0].fire(true));
    const cal = await screen.findByTestId("cal");
    expect(cal).toHaveAttribute("data-cal-link", "zaid/30min");
    expect(FakeObserver.instances[0].disconnected).toBe(true);
  });

  it("passes the resolved theme and re-applies it when the theme changes", async () => {
    theme.resolvedTheme = "dark";
    const { rerender } = render(<CalEmbed calLink="zaid/30min" />);
    act(() => FakeObserver.instances[0].fire(true));
    expect(await screen.findByTestId("cal")).toHaveAttribute("data-theme", "dark");
    await vi.waitFor(() => expect(calApi.cal).toHaveBeenCalledWith("ui", { theme: "dark" }));
    const namespace = screen.getByTestId("cal").getAttribute("data-namespace");
    expect(calApi.getCalApi).toHaveBeenCalledWith({ namespace });

    theme.resolvedTheme = "light";
    rerender(<CalEmbed calLink="zaid/30min" />);
    await vi.waitFor(() => expect(calApi.cal).toHaveBeenLastCalledWith("ui", { theme: "light" }));
  });

  it("mounts with the theme known at intersection time, not the pre-hydration one", async () => {
    theme.resolvedTheme = undefined;
    const { rerender } = render(<CalEmbed calLink="zaid/30min" />);
    theme.resolvedTheme = "dark";
    rerender(<CalEmbed calLink="zaid/30min" />);
    act(() => FakeObserver.instances.at(-1)!.fire(true));
    expect(await screen.findByTestId("cal")).toHaveAttribute("data-theme", "dark");
  });

  it("does not touch the Cal API before it is visible", () => {
    render(<CalEmbed calLink="zaid/30min" />);
    expect(calApi.getCalApi).not.toHaveBeenCalled();
  });
});

describe("calLinkFromEnv", () => {
  it("treats unset and blank values as no link", () => {
    expect(calLinkFromEnv(undefined)).toBeNull();
    expect(calLinkFromEnv("")).toBeNull();
    expect(calLinkFromEnv("   ")).toBeNull();
  });

  it("accepts a bare cal link or a full cal.com URL", () => {
    expect(calLinkFromEnv("zaid/30min")).toBe("zaid/30min");
    expect(calLinkFromEnv(" /zaid/30min/ ")).toBe("zaid/30min");
    expect(calLinkFromEnv("https://cal.com/zaid/30min")).toBe("zaid/30min");
    expect(calLinkFromEnv("https://app.cal.com/zaid/30min?x=1")).toBe("zaid/30min");
  });
});
