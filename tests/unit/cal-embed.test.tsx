import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalEmbed } from "@/features/contact/CalEmbed";
import { calEventsFromEnv, type CalEvent } from "@/features/contact/cal-link";

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

const ONE: CalEvent[] = [{ link: "zaid/30min", label: "30 min" }];
const TWO: CalEvent[] = [
  { link: "zaid/15min", label: "15 min" },
  { link: "zaid/30min", label: "30 min" },
];

describe("CalEmbed", () => {
  it("renders no embed until the card intersects the viewport", async () => {
    render(<CalEmbed events={ONE} />);
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
    const { rerender } = render(<CalEmbed events={ONE} />);
    act(() => FakeObserver.instances[0].fire(true));
    expect(await screen.findByTestId("cal")).toHaveAttribute("data-theme", "dark");
    await vi.waitFor(() => expect(calApi.cal).toHaveBeenCalledWith("ui", { theme: "dark" }));
    const namespace = screen.getByTestId("cal").getAttribute("data-namespace");
    expect(calApi.getCalApi).toHaveBeenCalledWith({ namespace });

    theme.resolvedTheme = "light";
    rerender(<CalEmbed events={ONE} />);
    await vi.waitFor(() => expect(calApi.cal).toHaveBeenLastCalledWith("ui", { theme: "light" }));
  });

  it("mounts with the theme known at intersection time, not the pre-hydration one", async () => {
    theme.resolvedTheme = undefined;
    const { rerender } = render(<CalEmbed events={ONE} />);
    theme.resolvedTheme = "dark";
    rerender(<CalEmbed events={ONE} />);
    act(() => FakeObserver.instances.at(-1)!.fire(true));
    expect(await screen.findByTestId("cal")).toHaveAttribute("data-theme", "dark");
  });

  it("does not touch the Cal API before it is visible", () => {
    render(<CalEmbed events={ONE} />);
    expect(calApi.getCalApi).not.toHaveBeenCalled();
  });
});

describe("CalEmbed with several meeting lengths", () => {
  it("shows a length switch with the first length chosen", () => {
    render(<CalEmbed events={TWO} />);
    const group = screen.getByRole("group", { name: "Meeting length" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "15 min" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "30 min" })).toHaveAttribute("aria-pressed", "false");
  });

  it("swaps the calendar when another length is picked", async () => {
    theme.resolvedTheme = "dark";
    render(<CalEmbed events={TWO} />);
    act(() => FakeObserver.instances[0].fire(true));
    expect(await screen.findByTestId("cal")).toHaveAttribute("data-cal-link", "zaid/15min");

    fireEvent.click(screen.getByRole("button", { name: "30 min" }));
    expect(screen.getByRole("button", { name: "30 min" })).toHaveAttribute("aria-pressed", "true");
    const cal = await screen.findByTestId("cal");
    expect(cal).toHaveAttribute("data-cal-link", "zaid/30min");
    expect(cal).toHaveAttribute("data-theme", "dark");
    const namespace = cal.getAttribute("data-namespace");
    await vi.waitFor(() => expect(calApi.getCalApi).toHaveBeenCalledWith({ namespace }));
  });

  it("has no switch for a single length", () => {
    render(<CalEmbed events={ONE} />);
    expect(screen.queryByRole("group", { name: "Meeting length" })).not.toBeInTheDocument();
  });
});

describe("calEventsFromEnv", () => {
  it("treats unset and blank values as no events", () => {
    expect(calEventsFromEnv(undefined)).toEqual([]);
    expect(calEventsFromEnv("")).toEqual([]);
    expect(calEventsFromEnv(" , ")).toEqual([]);
  });

  it("accepts a bare cal link or a full cal.com URL", () => {
    expect(calEventsFromEnv("zaid/30min")).toEqual([{ link: "zaid/30min", label: "30 min" }]);
    expect(calEventsFromEnv(" /zaid/30min/ ")).toEqual([{ link: "zaid/30min", label: "30 min" }]);
    expect(calEventsFromEnv("https://cal.com/zaid/30min")).toEqual([{ link: "zaid/30min", label: "30 min" }]);
    expect(calEventsFromEnv("https://app.cal.com/zaid/30min?x=1")).toEqual([{ link: "zaid/30min", label: "30 min" }]);
  });

  it("splits a comma-separated list in order and drops repeats", () => {
    expect(calEventsFromEnv("zaid/15min, https://cal.com/zaid/30min,zaid/15min")).toEqual([
      { link: "zaid/15min", label: "15 min" },
      { link: "zaid/30min", label: "30 min" },
    ]);
  });

  it("labels other event slugs readably", () => {
    expect(calEventsFromEnv("zaid/coffee-chat")).toEqual([{ link: "zaid/coffee-chat", label: "coffee chat" }]);
    expect(calEventsFromEnv("zaid/60-minutes")).toEqual([{ link: "zaid/60-minutes", label: "60 min" }]);
  });
});
