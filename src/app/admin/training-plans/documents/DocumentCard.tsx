import { Clock, FileText, Image as ImageIcon, Users } from "lucide-react";
import type { DocumentPreview, DocumentSummary } from "@/lib/exercise/document";

const dateFormat = new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeZone: "Europe/Sofia" });

const MAX_USAGE_TAGS = 2;

const months = ["ЯНУ", "ФЕВ", "МАР", "АПР", "МАЙ", "ЮНИ", "ЮЛИ", "АВГ", "СЕП", "ОКТ", "НОЕ", "ДЕК"];

/** Calendar tile with the training date, or a document icon when there is no valid date. */
function DateTile({ preview }: { preview: DocumentPreview | null }) {
  const match = preview && /^(\d{4})-(\d{2})-(\d{2})$/.exec(preview.date);
  const month = match ? months[Number(match[2]) - 1] : undefined;
  if (!match || !month) return <span className="td-date td-date--empty" aria-hidden="true"><FileText /></span>;
  return <span className="td-date">
    <span className="td-date-month" aria-hidden="true">{month}</span>
    <span className="td-date-day" aria-hidden="true">{Number(match[3])}</span>
    <span className="td-date-time" aria-hidden="true">{preview.time || match[1]}</span>
    <span className="td-sr-only">{`${match[3]}.${match[2]}.${match[1]} г.${preview.time ? `, ${preview.time} ч.` : ""}`}</span>
  </span>;
}

/** The date of the last change, for example "16.11.2026 г.". */
export function formatUpdated(value: string) {
  return dateFormat.format(new Date(value));
}

/** The inside of a plan card: title, tags, details and counts. The caller puts it in a link or a button. */
export function DocumentCardContent({ item }: { item: Pick<DocumentSummary, "title" | "preview" | "usages"> }) {
  const preview = item.preview ?? null;
  const who = [preview?.day, preview?.group, preview?.coach].filter(Boolean).join(" · ");
  // A linked plan shows the trainings that use it. The numbers come from the microcycles.
  const usages = item.usages ?? [];
  const tags = [
    ...(usages.length
      ? [...usages.slice(0, MAX_USAGE_TAGS).map(usage => `Микроцикъл ${usage.microcycle || "—"} · № ${usage.sessionNumber || "—"}`),
        usages.length > MAX_USAGE_TAGS && `+${usages.length - MAX_USAGE_TAGS} тренировки`]
      : [preview?.sessionNumber && `Тренировка № ${preview.sessionNumber}`, preview?.microcycle && `Микроцикъл ${preview.microcycle}`]),
    preview?.period,
  ].filter(Boolean) as string[];
  const stats = [
    preview?.duration && { icon: Clock, label: "Времетраене", value: `${preview.duration} мин.` },
    preview && { icon: ImageIcon, label: "Упражнения", value: `${preview.drawings} от 5` },
    preview?.playerCount && { icon: Users, label: "Състезатели", value: preview.playerCount },
  ].filter(Boolean) as { icon: typeof Clock; label: string; value: string }[];
  return <>
    <span className="td-document-top">
      <DateTile preview={preview} />
      <span className="td-document-name">
        <strong>{item.title}</strong>
        {who && <span className="td-document-who">{who}</span>}
      </span>
    </span>
    {!!tags.length && <span className="td-document-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</span>}
    {preview?.gameMoment && <span className="td-document-detail">
      <span className="td-document-label">Момент от играта</span>
      <span className="td-document-moment">{preview.gameMoment}</span>
    </span>}
    {preview?.objective && <span className="td-document-detail">
      <span className="td-document-label">Цел на тренировката</span>
      <span className="td-document-goal">{preview.objective}</span>
    </span>}
    {!!stats.length && <span className="td-document-stats">
      {stats.map(({ icon: Icon, label, value }) => <span key={label} className="td-stat">
        <Icon size={15} aria-hidden="true" />
        <span><span className="td-stat-label">{label}</span><span className="td-stat-value">{value}</span></span>
      </span>)}
    </span>}
  </>;
}
