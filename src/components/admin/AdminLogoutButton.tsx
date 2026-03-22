"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.replace("/admin/login");
      router.refresh();
      setIsLoggingOut(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={isLoggingOut}
      aria-label="Изход"
      style={{
        border: "1px solid rgba(255, 77, 77, 0.55)",
        background: "rgba(180, 25, 25, 0.85)",
        color: "#fff",
        borderRadius: "10px",
        padding: "8px 12px",
        fontSize: "13px",
        fontWeight: 700,
        cursor: isLoggingOut ? "not-allowed" : "pointer",
        opacity: isLoggingOut ? 0.7 : 1,
        backdropFilter: "blur(6px)",
      }}
    >
      {isLoggingOut ? "Излизане..." : "Изход"}
    </button>
  );
}
