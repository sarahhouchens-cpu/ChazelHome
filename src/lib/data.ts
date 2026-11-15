import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { nextDueDate } from './dates';
import { db } from './firebase';
import type {
  CalendarEvent,
  Ingredient,
  Meal,
  MenuEntry,
  Recipe,
  ShoppingCategory,
  ShoppingItem,
  Todo,
} from './types';

type CollectionName = 'events' | 'shopping' | 'recipes' | 'menu' | 'todos';

const col = (homeId: string, name: CollectionName) => collection(db, 'homes', homeId, name);
const ref = (homeId: string, name: CollectionName, id: string) => doc(db, 'homes', homeId, name, id);

/** Live-subscribe to a collection in the current home. */
export function useHomeCollection<T extends { id: string }>(
  homeId: string,
  name: CollectionName,
  ...constraints: QueryConstraint[]
): { data: T[]; loading: boolean } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  // Constraints are rebuilt every render; key the effect on a stable description of them.
  const key = constraints.map((c) => JSON.stringify(c)).join('|');
  useEffect(() => {
    setLoading(true);
    return onSnapshot(
      query(col(homeId, name), ...constraints),
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
        setLoading(false);
      },
      (err) => {
        console.warn(`Failed to load ${name}`, err);
        setLoading(false);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId, name, key]);
  return { data, loading };
}

// ---------- Calendar ----------

export const useEvents = (homeId: string) => useHomeCollection<CalendarEvent>(homeId, 'events', orderBy('start'));

export async function saveEvent(homeId: string, event: Omit<CalendarEvent, 'id'>, id?: string) {
  if (id) await updateDoc(ref(homeId, 'events', id), event);
  else await addDoc(col(homeId, 'events'), event);
}

export const deleteEvent = (homeId: string, id: string) => deleteDoc(ref(homeId, 'events', id));

// ---------- Shopping lists ----------

export const useShopping = (homeId: string) =>
  useHomeCollection<ShoppingItem>(homeId, 'shopping', orderBy('createdAt'));

export async function addShoppingItem(
  homeId: string,
  item: Pick<ShoppingItem, 'name' | 'quantity' | 'category' | 'addedBy'> &
    Partial<Pick<ShoppingItem, 'recipeId' | 'recipeName'>>,
) {
  await addDoc(col(homeId, 'shopping'), {
    recipeId: null,
    recipeName: null,
    ...item,
    name: item.name.trim(),
    quantity: item.quantity.trim(),
    checked: false,
    createdAt: Date.now(),
  });
}

export const updateShoppingItem = (homeId: string, id: string, patch: Partial<ShoppingItem>) =>
  updateDoc(ref(homeId, 'shopping', id), patch);

export const deleteShoppingItem = (homeId: string, id: string) => deleteDoc(ref(homeId, 'shopping', id));

export async function clearCheckedItems(homeId: string, category: ShoppingCategory) {
  const snap = await getDocs(
    query(col(homeId, 'shopping'), where('category', '==', category), where('checked', '==', true)),
  );
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/s$/, '');

/**
 * Put a recipe's ingredients on the grocery list. If an unchecked item with the same name is
 * already there, its quantity is combined instead of adding a duplicate line.
 * Returns how many ingredients were added or merged.
 */
export async function addIngredientsToGroceries(
  homeId: string,
  recipe: Pick<Recipe, 'id' | 'name'> & { ingredients: Ingredient[] },
  uid: string,
): Promise<number> {
  const ingredients = recipe.ingredients.filter((i) => i.name.trim());
  if (ingredients.length === 0) return 0;
  const existing = await getDocs(
    query(col(homeId, 'shopping'), where('category', '==', 'groceries'), where('checked', '==', false)),
  );
  const combine = (a: string, b: string) => (a && b ? `${a} + ${b}` : a || b);
  // Merge by name: first into items already on the list, then within this recipe.
  const updates = new Map(
    existing.docs.map((d) => [normalize(d.data().name as string), { ref: d.ref, quantity: (d.data().quantity as string) || '', changed: false }]),
  );
  const additions = new Map<string, Ingredient>();
  for (const ing of ingredients) {
    const key = normalize(ing.name);
    const qty = ing.quantity.trim();
    const upd = updates.get(key);
    if (upd) {
      upd.quantity = combine(upd.quantity, qty);
      upd.changed = true;
    } else {
      const add = additions.get(key);
      if (add) add.quantity = combine(add.quantity, qty);
      else additions.set(key, { name: ing.name.trim(), quantity: qty });
    }
  }
  const batch = writeBatch(db);
  updates.forEach((u) => u.changed && batch.update(u.ref, { quantity: u.quantity }));
  const now = Date.now();
  [...additions.values()].forEach((ing, i) =>
    batch.set(doc(col(homeId, 'shopping')), {
      name: ing.name,
      quantity: ing.quantity,
      category: 'groceries',
      checked: false,
      addedBy: uid,
      recipeId: recipe.id,
      recipeName: recipe.name,
      createdAt: now + i,
    }),
  );
  await batch.commit();
  return ingredients.length;
}

// ---------- Recipes ----------

export const useRecipes = (homeId: string) => useHomeCollection<Recipe>(homeId, 'recipes', orderBy('name'));

export async function saveRecipe(homeId: string, recipe: Omit<Recipe, 'id'>, id?: string): Promise<string> {
  if (id) {
    await updateDoc(ref(homeId, 'recipes', id), recipe);
    return id;
  }
  const created = await addDoc(col(homeId, 'recipes'), recipe);
  return created.id;
}

export const deleteRecipe = (homeId: string, id: string) => deleteDoc(ref(homeId, 'recipes', id));

// ---------- Menu ----------

export const useMenu = (homeId: string, fromKey: string, toKey: string) =>
  useHomeCollection<MenuEntry>(
    homeId,
    'menu',
    where('date', '>=', fromKey),
    where('date', '<=', toKey),
    orderBy('date'),
  );

export async function addMenuEntry(
  homeId: string,
  entry: { date: string; meal: Meal; title: string; recipe: Recipe | null },
  uid: string,
  addToGroceries: boolean,
) {
  await addDoc(col(homeId, 'menu'), {
    date: entry.date,
    meal: entry.meal,
    title: entry.recipe?.name ?? entry.title.trim(),
    recipeId: entry.recipe?.id ?? null,
  });
  if (addToGroceries && entry.recipe) return addIngredientsToGroceries(homeId, entry.recipe, uid);
  return 0;
}

export const deleteMenuEntry = (homeId: string, id: string) => deleteDoc(ref(homeId, 'menu', id));

// ---------- To-dos ----------

export const useTodos = (homeId: string) => useHomeCollection<Todo>(homeId, 'todos', orderBy('createdAt'));

export async function saveTodo(
  homeId: string,
  todo: Pick<Todo, 'title' | 'notes' | 'assigneeId' | 'dueDate' | 'recurrence'>,
  uid: string,
  id?: string,
) {
  // updatedBy lets the push-notification function skip notifying you about your own changes.
  if (id) await updateDoc(ref(homeId, 'todos', id), { ...todo, updatedBy: uid });
  else
    await addDoc(col(homeId, 'todos'), {
      ...todo,
      updatedBy: uid,
      title: todo.title.trim(),
      done: false,
      completedAt: null,
      completedBy: null,
      createdBy: uid,
      createdAt: Date.now(),
    });
}

/**
 * Completing a recurring task rolls it forward to its next due date instead of closing it,
 * so it shows up again automatically.
 */
export async function toggleTodo(homeId: string, todo: Todo, uid: string) {
  if (!todo.done && todo.recurrence !== 'none') {
    await updateDoc(ref(homeId, 'todos', todo.id), {
      dueDate: nextDueDate(todo.dueDate, todo.recurrence),
      completedAt: Date.now(),
      completedBy: uid,
    });
    return;
  }
  await updateDoc(ref(homeId, 'todos', todo.id), {
    done: !todo.done,
    completedAt: todo.done ? null : Date.now(),
    completedBy: todo.done ? null : uid,
  });
}

export const deleteTodo = (homeId: string, id: string) => deleteDoc(ref(homeId, 'todos', id));
