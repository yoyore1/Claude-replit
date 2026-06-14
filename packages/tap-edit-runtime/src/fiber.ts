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

  return {
    source: src,
    componentName: componentNameOf(tagged),
    currentText: textOf(hostDom),
    currentStyle: {
      color: rgbToHex(computed.color),
      backgroundColor: rgbToHex(computed.backgroundColor),
    },
    rect: { x: r.left, y: r.top, width: r.width, height: r.height },
  };
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
