"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** Opens the fixed parent page. It does not use the browser history, so the result is the same however the user came to the page. */
export default function BackLink({ href, className, children, beforeBack }: {
  href: string;
  className?: string;
  children: ReactNode;
  beforeBack?: () => boolean | Promise<boolean>;
}) {
  const router = useRouter();
  return <Link href={href} className={className} onNavigate={beforeBack && ((event) => {
    event.preventDefault();
    void (async () => {
      if (await beforeBack()) router.push(href);
    })();
  })}>{children}</Link>;
}
