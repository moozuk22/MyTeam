import { readTrainingImageSource } from "@/lib/exercise/imageSource";
import type { PlanContent } from "@/lib/exercise/document";

export class DocumentRequestError extends Error {
  constructor(message: string, readonly status: number, readonly recovery?: "private" | "saved", readonly documentId?: string) { super(message); }
}

export async function documentRequest<T>(url: string, fallback: string, options?: RequestInit, coachGroupId?: string | null): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options, headers: { ...options?.headers, ...(coachGroupId && { "x-coach-group": coachGroupId }) } });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new DocumentRequestError(body?.error ?? fallback, response.status, body?.recovery, body?.documentId);
  return body as T;
}

/** Adds the coach group to stored image URLs so that a coach can load the drawing backgrounds. */
export function withCoachImages(content: PlanContent, coach: string | null): PlanContent {
  if (!coach) return content;
  return { ...content, sections: content.sections.map(section => {
    const drawing = section.drawing;
    const background = drawing?.layout.background;
    if (!drawing || !background || !readTrainingImageSource(background.src)) return section;
    return { ...section, drawing: { ...drawing, layout: { ...drawing.layout, background: {
      ...background, src: `${background.src}?coachGroupId=${encodeURIComponent(coach)}`,
    } } } };
  }) };
}
