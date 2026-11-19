import type { Exercise } from "@/lib/exercise/model";

type PreviewTarget = { id: string; key: string; started: boolean };
const BATCH_SIZE = 12;

/** Keep drawing data only while its card is near the viewport. */
export function observePreviews(
  host: HTMLElement,
  clubId: string,
  publish: (previews: Record<string, Exercise | null>) => void,
) {
  const visible = new Map<Element, PreviewTarget>();
  let previews: Record<string, Exercise | null> = {};
  let stopped = false;
  let active: { controller: AbortController; targets: [Element, PreviewTarget][] } | undefined;
  publish({});

  function isCurrent([element, target]: [Element, PreviewTarget]) {
    return visible.get(element) === target;
  }

  async function loadNext() {
    if (stopped || active) return;
    const targets = [...visible].filter(([, target]) => !target.started).slice(0, BATCH_SIZE);
    if (!targets.length) return;
    targets.forEach(([, target]) => { target.started = true; });
    const request = { controller: new AbortController(), targets };
    active = request;
    const params = new URLSearchParams({ ids: targets.map(([, target]) => target.id).join(",") });
    try {
      const response = await fetch(`/api/admin/clubs/${clubId}/training-plans/previews?${params}`, {
        signal: request.controller.signal,
      });
      const data: { previews: { id: string; layout: Exercise }[] } = response.ok
        ? await response.json() : { previews: [] };
      if (!stopped && !request.controller.signal.aborted) {
        const layouts = new Map(data.previews.map(({ id, layout }) => [id, layout]));
        for (const entry of targets.filter(isCurrent)) {
          previews[entry[1].key] = layouts.get(entry[1].id) ?? null;
        }
        publish({ ...previews });
      }
    } catch {
      if (!stopped && !request.controller.signal.aborted) {
        for (const [, target] of targets.filter(isCurrent)) previews[target.key] = null;
        publish({ ...previews });
      }
    } finally {
      active = undefined;
      void loadNext();
    }
  }

  const observer = new IntersectionObserver((entries) => {
    if (stopped) return;
    let removed = false;
    for (const { target: element, isIntersecting } of entries) {
      if (isIntersecting) {
        if (!visible.has(element)) {
          const { previewId, previewKey } = (element as HTMLElement).dataset;
          if (previewId && previewKey) visible.set(element, { id: previewId, key: previewKey, started: false });
        }
      } else {
        const target = visible.get(element);
        if (target) {
          delete previews[target.key];
          visible.delete(element);
          removed = true;
        }
      }
    }
    if (removed) publish({ ...previews });
    if (active && !active.targets.some(isCurrent)) active.controller.abort();
    void loadNext();
  }, { rootMargin: "160px" });
  host.querySelectorAll<HTMLElement>("[data-preview-id]").forEach((element) => observer.observe(element));
  return () => {
    stopped = true;
    observer.disconnect();
    active?.controller.abort();
    visible.clear();
    previews = {};
    publish({});
  };
}
