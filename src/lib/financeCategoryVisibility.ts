type CategoryVisibility = { isActive: boolean; hiddenForExpense?: boolean; hiddenForRevenue?: boolean };
export function financeCategoryAvailable(category: CategoryVisibility, kind: 'expense' | 'revenue') {
  return category.isActive && !(kind === 'expense' ? category.hiddenForExpense : category.hiddenForRevenue);
}
export function financeCategoryVisibilityLabel(category: CategoryVisibility) {
  const expense = !financeCategoryAvailable(category,'expense');
  const revenue = !financeCategoryAvailable(category,'revenue');
  return expense && revenue ? 'Неактивна' : expense ? 'Скрита за разходи' : revenue ? 'Скрита за приходи' : '';
}
