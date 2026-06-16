import type { SourceLocation, EditableStyle } from "@cr/protocol";

/**
 * Web-only fiber utilities.
 *
 * On react-native-web every rendered element is a DOM node that carries a hidden
 * React fiber reference (`__reactFiber$...`). We use that fiber only as a stable
 * *carrier* for the `__tapSource` prop our babel plugin injected — we never read
 * `_debugSource` or other React internals, so React version changes can't break
 * source mapping.
 *
 * Native (Phase 2) will swap this module for a DevTools-hook + measure() based
 * implementation; the public shape stays the same.
 */

export interface ResolvedElement {
  source: SourceLocation;
  componentName: string;
  currentText?: string;
  /** When set, the tapped text comes from this prop of a component instance. */
  field?: string;
  currentStyle: EditableStyle;
  rect: { x: number; y: number; width: number; height: number };
}

function getFiberFromDom(dom: Element): any | null {
  const key = Object.keys(dom).find(
    (k) =>
      k.startsWith("__reactFiber$") ||
      k.startsWith("__reactInternalInstance$"),
  );
  return key ? (dom as any)[key] : null;
}

/** Walk up the fiber tree to the nearest fiber whose props carry __tapSource. */
function findTapSourceFiber(fiber: any): any | null {
  let f = fiber;
  while (f) {
    const props = f.memoizedProps || f.pendingProps;
    if (props && props.__tapSource && typeof props.__tapSource === "object") {
      return f;
    }
    f = f.return;
  }
  return null;
}

/**
 * For prop-driven text: walk up to the nearest component instance that both
 * supplied this prop (as a string) AND carries __tapSource — i.e. the
 * <SettingsRow label="…"/> the user authored in their screen.
 */
function findOwnerWithProp(fiber: any, field: string): any | null {
  let f = fiber;
  while (f) {
    const props = f.memoizedProps;
    if (
      props &&
      typeof props[field] === "string" &&
      props.__tapSource &&
      typeof props.__tapSource === "object"
    ) {
      return f;
    }
    f = f.return;
  }
  return null;
}

function componentNameOf(fiber: any): string {
  const type = fiber?.elementType ?? fiber?.type;
  if (!type) return "Element";
  if (typeof type === "string") return type;
  return type.displayName || type.name || "Component";
}

/**
 * Resolve the editable element at a viewport point. Returns null when nothing at
 * that point was tagged (e.g. a raw DOM node outside the app tree).
 */
export function resolveElementAtPoint(
  x: number,
  y: number,
): ResolvedElement | null {
  if (typeof document === "undefined") return null;

  const dom = document.elementFromPoint(x, y);
  if (!dom) return null;

  const fiber = getFiberFromDom(dom);
  if (!fiber) return null;

  // Prop-driven text (kit components mark it with data-tap-field).
  const fieldEl = (dom as HTMLElement).closest?.(
    "[data-tap-field]",
  ) as HTMLElement | null;
  if (fieldEl) {
    const field = fieldEl.getAttribute("data-tap-field") || "";
    const fEl = getFiberFromDom(fieldEl) ?? fiber;
    const owner = field ? findOwnerWithProp(fEl, field) : null;
    if (owner) {
      const r = fieldEl.getBoundingClientRect();
      const computed = getComputedStyle(fieldEl);
      return {
        source: owner.memoizedProps.__tapSource as SourceLocation,
        componentName: componentNameOf(owner),
        currentText: String(owner.memoizedProps[field]),
        field,
        currentStyle: {
          color: rgbToHex(computed.color),
          backgroundColor: rgbToHex(computed.backgroundColor),
          fontFamily: fontFamilyOption(computed.fontFamily),
          fontWeight: fontWeightOption(computed.fontWeight),
        },
        rect: { x: r.left, y: r.top, width: r.width, height: r.height },
      };
    }
  }

  const tagged = findTapSourceFiber(fiber);
  if (!tagged) return null;

  const src = tagged.memoizedProps.__tapSource as SourceLocation;

  // Use the DOM node closest to the tagged fiber for geometry + text.
  const hostDom = nearestHostDom(tagged) ?? (dom as HTMLElement);
  const r = hostDom.getBoundingClientRect();
  const computed = getComputedStyle(hostDom);

  // Decide what's editable at this element:
  //  - a kit component instance with a text PROP (e.g. <AppButton title="…"/>)
  //    edits that prop — even when the tap lands on the component body, not the
  //    exact text glyph (otherwise a "text" edit appends ignored children);
  //  - a leaf element with its own text (<Text>literal</Text>) edits the node;
  //  - a container / pure background (a View with child elements and no own
  //    text) has no text to edit — only its color/background.
  const props = tagged.memoizedProps || {};
  // Common text-content prop names — so a body tap on ANY component (kit OR a
  // custom one the app defines) resolves to its text prop. Container-ish props
  // (largeTitle/header/footer) are intentionally excluded here; those are only
  // hit by a precise tap on the text via data-tap-field, so a tap on a section's
  // body resolves to the section box (background), not its header.
  const FIELD_PROPS = [
    "title",
    "label",
    "value",
    "placeholder",
    "text",
    "heading",
    "subtitle",
    "caption",
  ];
  const propField = FIELD_PROPS.find((k) => typeof props[k] === "string");
  let field: string | undefined;
  let currentText: string | undefined;
  if (propField) {
    field = propField;
    currentText = String(props[propField]);
  } else if (hostDom.children.length === 0) {
    currentText = textOf(hostDom);
  }

  return {
    source: src,
    componentName: componentNameOf(tagged),
    currentText,
    field,
    currentStyle: {
      color: rgbToHex(computed.color),
      backgroundColor: rgbToHex(computed.backgroundColor),
      fontFamily: fontFamilyOption(computed.fontFamily),
      fontWeight: fontWeightOption(computed.fontWeight),
    },
    rect: { x: r.left, y: r.top, width: r.width, height: r.height },
  };
}

/** Map a computed CSS font stack onto one of the font-menu options (best effort,
 * so re-tapping an element seeds the dropdown to its current font). */
function fontFamilyOption(family: string): string {
  const f = (family || "").toLowerCase();
  if (/menlo/.test(f)) return "Menlo";
  if (/courier|consolas|mono/.test(f)) return "Courier New";
  if (/georgia/.test(f)) return "Georgia";
  if (/times/.test(f)) return "Times New Roman";
  if (/palatino/.test(f)) return "Palatino";
  if (/baskerville/.test(f)) return "Baskerville";
  if (/avenir/.test(f)) return "Avenir Next";
  if (/trebuchet/.test(f)) return "Trebuchet MS";
  if (/verdana/.test(f)) return "Verdana";
  if (/helvetica/.test(f)) return "Helvetica Neue";
  if (/arial/.test(f)) return "Arial";
  if (/serif/.test(f) && !/sans/.test(f)) return "Georgia";
  return "System";
}

/** Collapse a computed font weight into "bold" / "normal". */
function fontWeightOption(weight: string): string {
  if (weight === "bold" || weight === "bolder") return "bold";
  const n = parseInt(weight, 10);
  return Number.isFinite(n) && n >= 600 ? "bold" : "normal";
}

function nearestHostDom(fiber: any): HTMLElement | null {
  // The tagged fiber may be a composite component; its `stateNode` is the host
  // node when it's a host fiber, otherwise descend to the first host child.
  let f = fiber;
  while (f) {
    if (f.stateNode instanceof HTMLElement) return f.stateNode;
    f = f.child;
  }
  return null;
}

function textOf(dom: HTMLElement): string | undefined {
  const text = dom.textContent?.trim();
  return text && text.length > 0 ? text : undefined;
}

/** Normalize "rgb(r,g,b)" / "rgba(...)" to "#rrggbb" for color pickers. */
function rgbToHex(value: string): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("#")) return value;
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return undefined;
  const parts = m[1].split(",").map((p) => p.trim());
  if (parts.length < 3) return undefined;
  const [r, g, bl] = parts.map((p) => parseInt(p, 10));
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(bl)}`;
}
