import { CUSTOM_TRAINING_GROUP_COLOR_PALETTE } from './customTrainingGroupColors';

/** Stable pseudo-random fallback: charts keep their colors across reloads and sorting. */
export function financeCategoryChartColor(category: {id:string;color?:string | null}) {
 if (category.color) return category.color;
 let hash = 2166136261;
 for (const char of category.id) hash = Math.imul(hash ^ char.charCodeAt(0),16777619) >>> 0;
 return CUSTOM_TRAINING_GROUP_COLOR_PALETTE[hash % CUSTOM_TRAINING_GROUP_COLOR_PALETTE.length];
}
