/**
 * A short tick for gestures that just took effect (PRD §4.67).
 *
 * Android browsers have the Vibration API. iPhones expose no haptics to the
 * web, but Safari 18 ticks when a switch-style checkbox is toggled, so a
 * hidden one is toggled instead; older iPhones simply stay silent. The tick
 * must come from inside the touch that caused it, which every caller does.
 */

let toggle: HTMLLabelElement | null = null;
let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export function haptic(): void {
  if (!enabled || typeof window === "undefined") return;
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(10);
      return;
    }
    if (!toggle) {
      toggle = document.createElement("label");
      toggle.setAttribute("aria-hidden", "true");
      toggle.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      input.tabIndex = -1;
      toggle.append(input);
      document.body.append(toggle);
    }
    toggle.click();
  } catch {
    // A tick is a nicety; never let it break the gesture.
  }
}
