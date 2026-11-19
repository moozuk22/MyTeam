"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { navigateBack } from "./backNavigation";

export default function BackLink({ href, className, children, beforeBack }: {
  href: string;
  className?: string;
  children: ReactNode;
  beforeBack?: () => boolean | Promise<boolean>;
}) {
  const router = useRouter();
  return <Link href={href} className={className} onNavigate={(event) => {
    event.preventDefault();
    void (async () => {
      if (beforeBack && !await beforeBack()) return;
      navigateBack(router, href, window.history.length);
    })();
  }}>{children}</Link>;
}
