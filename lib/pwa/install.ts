"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";

/**
 * Installing Ursa as an app (PRD §4.27).
 *
 * Chromium browsers (Android, desktop Chrome/Edge/Brave) fire
 * `beforeinstallprompt` once the app is installable; holding on to it lets
 * an "Install" button open the real prompt. Safari has no such API, so on an
 * iPhone the button explains Share → Add to Home Screen instead.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallMode = "installed" | "prompt" | "ios" | "manual";

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep the browser's own mini-infobar out of the way; the app offers it.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });
}

function standalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch gives it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function snapshot(): InstallMode {
  if (installed || standalone()) return "installed";
  if (deferred) return "prompt";
  return isIOS() ? "ios" : "manual";
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot,
    () => "manual",
  );
}

/** Opens the browser's install prompt. Returns false when there is none to open. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") installed = true;
  notify();
  return true;
}

export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  // A failure only means no offline page and, on old Chromium, no install —
  // never a reason to disturb the app.
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
}

/** What the Install button does, whatever the browser. */
export async function installApp(): Promise<void> {
  if (await promptInstall()) return;
  if (snapshot() === "installed") {
    toast("Ursa is already installed on this device.");
    return;
  }
  if (isIOS()) {
    toast("Install Ursa on your iPhone", {
      description: "In Safari, tap Share (the square with an arrow), then “Add to Home Screen”.",
      duration: 15_000,
    });
    return;
  }
  toast("Install Ursa", {
    description: "Open your browser’s menu and choose “Install app” or “Add to Home screen”.",
    duration: 12_000,
  });
}
