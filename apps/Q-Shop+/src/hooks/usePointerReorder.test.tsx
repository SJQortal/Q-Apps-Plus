import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { usePointerReorder } from "./usePointerReorder";

function List({ onMove }: { onMove: (from: number, to: number) => void }) {
  const { itemProps, dragging } = usePointerReorder(onMove);
  return (
    <ul>
      {["a", "b", "c"].map((x, i) => (
        <li key={x} {...itemProps(i)} data-testid={x} data-dragging={dragging === i ? "yes" : undefined}>
          {x}
          <button type="button">star {x}</button>
        </li>
      ))}
    </ul>
  );
}

const pointer = (type: string, init: Record<string, unknown>) => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: init.clientX as number, clientY: init.clientY as number });
  Object.assign(e, { pointerId: 1, pointerType: init.pointerType ?? "mouse" });
  return e;
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("drag to reorder", () => {
  it("moves an item a mouse drags over another", () => {
    const onMove = vi.fn();
    const { getByTestId } = render(<List onMove={onMove} />);
    const under = vi.fn(() => getByTestId("c"));
    document.elementFromPoint = under as never;
    fireEvent(getByTestId("a"), pointer("pointerdown", { clientX: 0, clientY: 0 }));
    fireEvent(window, pointer("pointermove", { clientX: 2, clientY: 0 }));
    expect(onMove).not.toHaveBeenCalled();
    fireEvent(window, pointer("pointermove", { clientX: 200, clientY: 0 }));
    expect(onMove).toHaveBeenCalledWith(0, 2);
    expect(getByTestId("c").dataset.dragging).toBe("yes");
    fireEvent(window, pointer("pointerup", { clientX: 200, clientY: 0 }));
    expect(getByTestId("c").dataset.dragging).toBeUndefined();
  });

  it("doesn't drag from an item's buttons", () => {
    const onMove = vi.fn();
    const { getByTestId, getByText } = render(<List onMove={onMove} />);
    document.elementFromPoint = (() => getByTestId("c")) as never;
    fireEvent(getByText("star a"), pointer("pointerdown", { clientX: 0, clientY: 0 }));
    fireEvent(window, pointer("pointermove", { clientX: 200, clientY: 0 }));
    expect(onMove).not.toHaveBeenCalled();
  });

  it("drags with a finger after a press and hold; a quick swipe scrolls instead", () => {
    vi.useFakeTimers();
    const onMove = vi.fn();
    const { getByTestId } = render(<List onMove={onMove} />);
    document.elementFromPoint = (() => getByTestId("b")) as never;
    // A swipe: moves before the hold, no drag.
    fireEvent(getByTestId("a"), pointer("pointerdown", { clientX: 0, clientY: 0, pointerType: "touch" }));
    fireEvent(window, pointer("pointermove", { clientX: 0, clientY: 40, pointerType: "touch" }));
    act(() => vi.advanceTimersByTime(400));
    fireEvent(window, pointer("pointermove", { clientX: 0, clientY: 80, pointerType: "touch" }));
    expect(onMove).not.toHaveBeenCalled();
    fireEvent(window, pointer("pointerup", { clientX: 0, clientY: 80, pointerType: "touch" }));
    // Held: a drag.
    fireEvent(getByTestId("a"), pointer("pointerdown", { clientX: 0, clientY: 0, pointerType: "touch" }));
    act(() => vi.advanceTimersByTime(350));
    expect(getByTestId("a").dataset.dragging).toBe("yes");
    fireEvent(window, pointer("pointermove", { clientX: 0, clientY: 60, pointerType: "touch" }));
    expect(onMove).toHaveBeenCalledWith(0, 1);
  });
});
