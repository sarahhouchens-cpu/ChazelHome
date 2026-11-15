import type { Ingredient } from './types';

const UNITS = [
  'cups?', 'c', 'tbsps?', 'tablespoons?', 'tsps?', 'teaspoons?', 'oz', 'ounces?', 'lbs?', 'pounds?', 'g', 'grams?', 'kg',
  'ml', 'l', 'liters?', 'cloves?', 'cans?', 'pinch(?:es)?', 'dash(?:es)?', 'slices?', 'packages?', 'pkgs?', 'bunch(?:es)?',
  'sticks?', 'heads?', 'large', 'medium', 'small',
].join('|');

// "2 1/2 cups flour", "1½ tbsp olive oil", "3 eggs", "salt"
const LINE = new RegExp(`^\\s*((?:[\\d½¼¾⅓⅔⅛.,/\\- ]+)(?:\\s*(?:${UNITS})\\.?\\b)?)?\\s*(?:of\\s+)?(.+?)\\s*$`, 'i');

/** Turn a pasted ingredient list (one per line) into name/quantity pairs. */
export function parseIngredientLines(text: string): Ingredient[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^[\s\-•*·▢☐]+/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const m = LINE.exec(line);
      if (!m) return { name: line, quantity: '' };
      return { quantity: (m[1] ?? '').trim(), name: m[2].trim() };
    });
}
