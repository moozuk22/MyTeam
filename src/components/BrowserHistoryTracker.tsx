"use client";

import { useLayoutEffect } from "react";
import { trackBrowserHistory } from "@/lib/browserHistoryGuard";

export function BrowserHistoryTracker() {
  // Install the listener before the router registers its popstate listener.
  useLayoutEffect(() => trackBrowserHistory(window), []);
  return null;
}
