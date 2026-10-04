/**
 * Names for Quill's toolbar pickers (size, heading, colours, font, alignment).
 *
 * In the snow theme Quill hides each <select> and builds a picker: the
 * select's aria-label lands on a plain container span, while the control
 * that takes focus (`.ql-picker-label`, role=button) holds only an SVG, and
 * the options are role=button spans with no text. Screen readers then hear
 * "button" with no name. This gives the label and every option a name, marks
 * the chosen option, and lets Space open and pick as Enter does.
 */

const HUES = ["red", "orange", "yellow", "green", "blue", "purple"];
const TONES = ["", "Pale ", "Light ", "Dark ", "Deep "];
const GREYS = ["Black", "White", "Light grey", "Grey", "Dark grey"];

/** Quill's 35-colour palette, by position (7 per row: a grey, then six hues). */
export function paletteColorName(index: number): string | null {
  const row = Math.floor(index / 7);
  const column = index % 7;
  if (index < 0 || row >= TONES.length) return null;
  if (column === 0) return GREYS[row];
  const hue = HUES[column - 1];
  return row === 0 ? hue.charAt(0).toUpperCase() + hue.slice(1) : `${TONES[row]}${hue}`;
}

const NAMED_VALUES: Record<string, Record<string, string>> = {
  "ql-align": { "": "Align left", center: "Align centre", right: "Align right", justify: "Justify" },
  "ql-size": { small: "Small", "": "Normal", large: "Large", huge: "Huge" },
  "ql-font": { "": "Sans serif", serif: "Serif", monospace: "Monospace" },
};

/** The spoken name of one picker option. */
export function pickerItemName(pickerClass: string, value: string, index: number): string {
  if (pickerClass === "ql-color" || pickerClass === "ql-background") {
    return paletteColorName(index) || value || "Default";
  }
  if (pickerClass === "ql-header") return value ? `Heading ${value}` : "Normal text";
  const named = NAMED_VALUES[pickerClass]?.[value];
  return named || value || "Default";
}

const PICKER_CLASSES = ["ql-size", "ql-header", "ql-color", "ql-background", "ql-font", "ql-align"];

function setAttr(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

/** Names every picker inside `root`; safe to call again (it only changes what differs). */
export function labelQuillPickers(root: ParentNode): void {
  root.querySelectorAll(".ql-picker").forEach(picker => {
    const pickerClass = PICKER_CLASSES.find(cls => picker.classList.contains(cls)) || "";
    const name = picker.getAttribute("aria-label") || picker.getAttribute("title") || "Formatting";
    let chosen = "";
    picker.querySelectorAll(".ql-picker-item").forEach((item, index) => {
      const itemName = pickerItemName(pickerClass, item.getAttribute("data-value") || "", index);
      const selected = item.classList.contains("ql-selected");
      if (selected) chosen = itemName;
      setAttr(item, "aria-label", itemName);
      setAttr(item, "aria-pressed", selected ? "true" : "false");
    });
    const label = picker.querySelector(".ql-picker-label");
    if (label) setAttr(label, "aria-label", chosen ? `${name}: ${chosen}` : name);
  });
}

/**
 * Keeps the names in step with Quill (which rebuilds pickers and moves
 * `ql-selected` as the cursor moves) and maps Space to Enter on picker
 * controls. Returns a cleanup function.
 */
export function watchQuillPickers(root: HTMLElement): () => void {
  labelQuillPickers(root);
  let observer: MutationObserver | null = null;
  if (typeof MutationObserver !== "undefined") {
    observer = new MutationObserver(() => labelQuillPickers(root));
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== " ") return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches(".ql-picker-label, .ql-picker-item")) return;
    event.preventDefault();
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  };
  root.addEventListener("keydown", onKeyDown);
  return () => {
    observer?.disconnect();
    root.removeEventListener("keydown", onKeyDown);
  };
}
