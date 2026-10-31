/** Calculator scope follows the browser's last visited club, not a user assignment. */
export function canReadClubCalculator(roles: readonly string[], rememberedClubId: string | undefined, clubId: string) {
  if (roles.includes('admin')) return true;
  if (!roles.includes('coach') || !rememberedClubId) return false;
  const remembered = rememberedClubId.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(remembered)
    && remembered.toLowerCase() === clubId.toLowerCase();
}
