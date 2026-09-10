export function notificationLinks(text: string): Array<{ text: string; href?: string }> {
  const parts: Array<{ text: string; href?: string }> = [];
  const pattern = /\b(?:https?:\/\/|www\.)[^\s<>"'“”‘’]+/gi;
  let cursor = 0;

  for (const match of text.matchAll(pattern)) {
    let label = match[0].replace(/[.,!?;:…]+$/, "");
    // Keep balanced parentheses in URLs, but exclude surrounding prose brackets.
    for (;;) {
      const closing = label.at(-1);
      const opening = closing === ")" ? "(" : closing === "]" ? "[" : closing === "}" ? "{" : null;
      if (!opening || label.split(closing!).length <= label.split(opening).length) break;
      label = label.slice(0, -1).replace(/[.,!?;:…]+$/, "");
    }
    const href = /^www\./i.test(label) ? `https://${label}` : label;
    try {
      const url = new URL(href);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname) continue;
    } catch {
      continue;
    }
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index) });
    parts.push({ text: label, href });
    cursor = match.index + label.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
