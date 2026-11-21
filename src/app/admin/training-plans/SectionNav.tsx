"use client";

import Link from "next/link";
import { CalendarRange, FileText, Images } from "lucide-react";

export type TrainingSection = "microcycles" | "drawings" | "documents";

const SECTIONS: { key: TrainingSection; path: string; label: string; Icon: typeof Images }[] = [
  { key: "microcycles", path: "/admin/training-plans/microcycles", label: "Микроцикъл", Icon: CalendarRange },
  { key: "drawings", path: "/admin/training-plans", label: "Рисунки", Icon: Images },
  { key: "documents", path: "/admin/training-plans/documents", label: "План-конспекти", Icon: FileText },
];

export function trainingSectionHref(section: TrainingSection, location: string) {
  return `${SECTIONS.find((item) => item.key === section)!.path}?${location}`;
}

/** Links the three main pages of the training plans. `onNavigate` can stop the navigation, for example when there are unsaved changes. */
export default function SectionNav({ location, current, onNavigate }: {
  location: string;
  current: TrainingSection;
  onNavigate?: (event: { preventDefault: () => void }, href: string) => void;
}) {
  return <nav className="tp-section-nav" aria-label="Тренировъчен план">
    {SECTIONS.map(({ key, label, Icon }) => {
      const href = trainingSectionHref(key, location);
      return <Link key={key} href={href} aria-current={key === current ? "page" : undefined}
        onNavigate={onNavigate && key !== current ? (event) => onNavigate(event, href) : undefined}>
        <Icon size={18} aria-hidden="true" /><span>{label}</span>
      </Link>;
    })}
  </nav>;
}
