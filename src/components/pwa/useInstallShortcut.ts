"use client";

import { useEffect } from "react";

type ShortcutConfig = {
  manifestHref: string;
  title?: string;
  appleIconHref?: string;
  shortcutIconHref?: string;
  icon192Href?: string;
  icon512Href?: string;
};

function getOrCreateLink(
  selector: string,
  attrs: Record<string, string>,
): { link: HTMLLinkElement; created: boolean } {
  const existing = document.head.querySelector<HTMLLinkElement>(selector);
  if (existing) {
    return { link: existing, created: false };
  }

  const link = document.createElement("link");
  Object.entries(attrs).forEach(([key, value]) => {
    link.setAttribute(key, value);
  });
  document.head.appendChild(link);
  return { link, created: true };
}

function patchLinkHref(link: HTMLLinkElement, href: string): () => void {
  const previousHref = link.getAttribute("href");
  link.setAttribute("href", href);
  return () => {
    if (previousHref === null) {
      link.removeAttribute("href");
    } else {
      link.setAttribute("href", previousHref);
    }
  };
}

export function useInstallShortcut(config: ShortcutConfig) {
  const {
    manifestHref,
    title,
    appleIconHref,
    shortcutIconHref,
    icon192Href,
    icon512Href,
  } = config;

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const previousTitle = document.title;

    if (title) {
      document.title = title;
      cleanups.push(() => {
        document.title = previousTitle;
      });
    }

    const manifest = getOrCreateLink('link[rel="manifest"]', {
      rel: "manifest",
    });
    cleanups.push(patchLinkHref(manifest.link, manifestHref));
    if (manifest.created) {
      cleanups.push(() => manifest.link.remove());
    }

    if (appleIconHref) {
      const apple = getOrCreateLink('link[rel="apple-touch-icon"]', {
        rel: "apple-touch-icon",
      });
      cleanups.push(patchLinkHref(apple.link, appleIconHref));
      if (apple.created) {
        cleanups.push(() => apple.link.remove());
      }
    }

    if (shortcutIconHref) {
      const shortcut = getOrCreateLink(
        'link[rel="shortcut icon"], link[rel="shortcut"]',
        { rel: "shortcut icon" },
      );
      cleanups.push(patchLinkHref(shortcut.link, shortcutIconHref));
      if (shortcut.created) {
        cleanups.push(() => shortcut.link.remove());
      }
    }

    if (icon192Href) {
      const icon192 = getOrCreateLink('link[rel="icon"][sizes="192x192"]', {
        rel: "icon",
        sizes: "192x192",
        type: "image/png",
      });
      cleanups.push(patchLinkHref(icon192.link, icon192Href));
      if (icon192.created) {
        cleanups.push(() => icon192.link.remove());
      }
    }

    if (icon512Href) {
      const icon512 = getOrCreateLink('link[rel="icon"][sizes="512x512"]', {
        rel: "icon",
        sizes: "512x512",
        type: "image/png",
      });
      cleanups.push(patchLinkHref(icon512.link, icon512Href));
      if (icon512.created) {
        cleanups.push(() => icon512.link.remove());
      }
    }

    return () => {
      for (let i = cleanups.length - 1; i >= 0; i -= 1) {
        cleanups[i]?.();
      }
    };
  }, [
    manifestHref,
    title,
    appleIconHref,
    shortcutIconHref,
    icon192Href,
    icon512Href,
  ]);
}
