import { formatBirthDateForExport } from "./members-page-utils";
import { type Member } from "../_types/members-page-types";

export async function downloadMemberLinks({
  isAdmin,
  members,
  clubName,
}: {
  isAdmin: boolean;
  members: Member[];
  clubName: string;
}) {
  if (!isAdmin || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const rows = members
    .filter((member) => member.isActive)
    .map((member) => {
      const cardCode =
        member.cards.find((card) => card.isActive)?.cardCode || member.cards[0]?.cardCode || "";

      if (!cardCode) {
        return null;
      }

      return {
        fullName: member.fullName,
        birthDate: formatBirthDateForExport(member.birthDate),
        url: `${window.location.origin}/member/${encodeURIComponent(cardCode)}`,
      };
    })
    .filter((item): item is { fullName: string; birthDate: string; url: string } => item !== null)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }));

  if (rows.length === 0) {
    window.alert("Няма активни състезатели с карта за export.");
    return;
  }

  const header = [`Отбор: ${clubName || "-"}`, `Общо активни състезатели: ${rows.length}`, ""].join("\n");
  const entries = rows
    .map(
      (row, index) =>
        `${index + 1}. ${row.fullName}\n` + `   Birthdate: ${row.birthDate}\n` + `   ${row.url}`,
    )
    .join("\n\n");
  const content = `${header}${entries}\n`.replace(/\n/g, "\r\n");
  const safeClub = (clubName || "club")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");
  const defaultBaseName = `${safeClub || "club"}-member-links`;
  const requestedName = window.prompt("Име на файла:", defaultBaseName) ?? "";
  const cleanBaseName = (requestedName.trim() || defaultBaseName).replace(/[\\/:*?"<>|]/g, "-");
  const filename = `${cleanBaseName}.txt`;
  const blob = new Blob(["\uFEFF", content], { type: "text/plain;charset=utf-8" });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function downloadPlayersExcel({
  isAdmin,
  members,
  clubSport,
  clubName,
}: {
  isAdmin: boolean;
  members: Member[];
  clubSport: string;
  clubName: string;
}) {
  if (!isAdmin || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const rows = members
    .filter((member) => member.isActive)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "bg"))
    .map((member) => {
      const cells = [
        member.fullName,
        clubSport,
        formatBirthDateForExport(member.birthDate).replace(/-/g, ""),
        member.jerseyNumber?.trim() ?? "",
      ];
      return `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr><th>Име, фамилия</th><th>спорт</th><th>роден</th><th>номер</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const safeClub = (clubName || "club").trim().replace(/[\\/:*?"<>|]+/g, "-") || "club";
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `players-${safeClub}-${new Date().toISOString().slice(0, 10)}.xls`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
