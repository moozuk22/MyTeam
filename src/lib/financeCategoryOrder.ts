type OrderedCategory = { id: string; name: string; sortOrder: number; expenseSortOrder?: number; revenueSortOrder?: number };
export function financeCategoriesForKind<T extends OrderedCategory>(categories: readonly T[], kind: 'expense' | 'revenue'): T[] {
  const field = kind === 'expense' ? 'expenseSortOrder' : 'revenueSortOrder';
  return [...categories].sort((a,b) => (a[field] ?? a.sortOrder) - (b[field] ?? b.sortOrder) || a.name.localeCompare(b.name,'bg') || a.id.localeCompare(b.id));
}
