export function inferDeviceLabel(userAgent: string | null | undefined) {
  const ua = (userAgent ?? "").toLowerCase();

  if (!ua) {
    return "Unknown device";
  }

  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("firefox")
      ? "Firefox"
      : ua.includes("chrome")
        ? "Chrome"
        : ua.includes("safari")
          ? "Safari"
          : "Browser";

  const os = ua.includes("android")
    ? "Android"
    : /iphone|ipad|ipod/.test(ua)
      ? "iOS"
      : ua.includes("windows")
        ? "Windows"
        : ua.includes("mac os")
          ? "macOS"
          : ua.includes("linux")
            ? "Linux"
            : "Unknown OS";

  return `${browser} on ${os}`;
}
