export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  homeId: string | null;
  color: string;
  pushTokens?: string[];
};

export type Home = {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  inviteCode: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: number; // epoch ms
  end: number; // epoch ms
  allDay: boolean;
  notes: string;
  /** Minutes before start to send a reminder notification; null = no reminder. */
  reminderMinutes: number | null;
  createdBy: string;
};

export const SHOPPING_CATEGORIES = [
  { key: 'groceries', label: 'Groceries', icon: 'cart-outline' },
  { key: 'household', label: 'Household', icon: 'home-outline' },
  { key: 'fun', label: 'Fun', icon: 'gift-outline' },
] as const;
export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number]['key'];

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string;
  category: ShoppingCategory;
  checked: boolean;
  addedBy: string;
  /** Recipe that put this item on the list, if any. */
  recipeId: string | null;
  recipeName: string | null;
  createdAt: number;
};

export type Ingredient = { name: string; quantity: string };

export type Recipe = {
  id: string;
  name: string;
  servings: string;
  ingredients: Ingredient[];
  instructions: string;
  sourceUrl: string;
  createdBy: string;
};

export const MEALS = ['breakfast', 'lunch', 'dinner'] as const;
export type Meal = (typeof MEALS)[number];

export type MenuEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  meal: Meal;
  recipeId: string | null;
  title: string;
};

export type Recurrence = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
export const RECURRENCE_OPTIONS: { key: Recurrence; label: string }[] = [
  { key: 'none', label: 'Once' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'biweekly', label: 'Every 2 weeks' },
  { key: 'monthly', label: 'Monthly' },
];

export type Todo = {
  id: string;
  title: string;
  notes: string;
  assigneeId: string | null;
  dueDate: string | null; // YYYY-MM-DD
  recurrence: Recurrence;
  done: boolean;
  completedAt: number | null;
  completedBy: string | null;
  createdBy: string;
  createdAt: number;
};
