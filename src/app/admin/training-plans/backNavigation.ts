type BackRouter = { back: () => void; push: (href: string) => void };

export function navigateBack(router: BackRouter, fallbackHref: string, historyLength: number) {
  if (historyLength > 1) router.back();
  else router.push(fallbackHref);
}
