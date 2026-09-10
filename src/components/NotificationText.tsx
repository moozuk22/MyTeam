"use client";

import { notificationLinks } from "@/lib/notificationLinks";

export function NotificationText({ text }: { text: string }) {
  return (
    <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
      {notificationLinks(text).map((part, index) => part.href ? (
        <a
          key={index}
          href={part.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          style={{ color: "#32cd32", textDecoration: "underline" }}
        >
          {part.text}
        </a>
      ) : part.text)}
    </span>
  );
}
