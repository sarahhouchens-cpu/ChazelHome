import { router, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { space, useTheme } from '../../components/theme';
import { Body, Button, Card, Chip, ChipRow, EmptyState, HeaderButton, Ionicons, Row, Screen } from '../../components/ui';
import { addIngredientsToGroceries, deleteMenuEntry, useMenu, useRecipes } from '../../lib/data';
import { addDays, dayKey, isSameDay, startOfWeek } from '../../lib/dates';
import { useHome } from '../../lib/session';
import { MEALS, type MenuEntry } from '../../lib/types';

export default function MenuScreen() {
  const t = useTheme();
  const navigation = useNavigation();
  const { homeId, uid } = useHome();
  const [tab, setTab] = useState<'plan' | 'recipes'>('plan');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const weekEnd = addDays(weekStart, 6);
  const { data: menu } = useMenu(homeId, dayKey(weekStart), dayKey(weekEnd));
  const { data: recipes, loading: recipesLoading } = useRecipes(homeId);
  const [shopping, setShopping] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        tab === 'recipes' ? (
          <HeaderButton icon="add-circle" label="New recipe" onPress={() => router.push('/recipe/edit')} />
        ) : (
          <HeaderButton icon="add-circle" label="Add meal" onPress={() => router.push('/menu-add')} />
        ),
    });
  }, [navigation, tab]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const shopForWeek = async () => {
    const planned = menu.filter((m) => m.recipeId);
    if (planned.length === 0) return Alert.alert('No recipes planned this week', 'Add recipes to the menu first.');
    setShopping(true);
    try {
      let count = 0;
      for (const entry of planned) {
        const recipe = recipes.find((r) => r.id === entry.recipeId);
        if (recipe) count += await addIngredientsToGroceries(homeId, recipe, uid);
      }
      Alert.alert('Grocery list updated', `${count} ingredients added from ${planned.length} planned meals.`);
    } finally {
      setShopping(false);
    }
  };

  const entryActions = (m: MenuEntry) =>
    Alert.alert(m.title, undefined, [
      ...(m.recipeId ? [{ text: 'View recipe', onPress: () => router.push(`/recipe/${m.recipeId}`) }] : []),
      { text: 'Remove from menu', style: 'destructive' as const, onPress: () => deleteMenuEntry(homeId, m.id) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  return (
    <Screen>
      <ChipRow>
        <Chip label="Weekly plan" icon="calendar-outline" selected={tab === 'plan'} onPress={() => setTab('plan')} />
        <Chip label={`Recipes (${recipes.length})`} icon="book-outline" selected={tab === 'recipes'} onPress={() => setTab('recipes')} />
      </ChipRow>

      {tab === 'plan' ? (
        <>
          <Row style={{ justifyContent: 'space-between' }}>
            <Pressable onPress={() => setWeekStart(addDays(weekStart, -7))} hitSlop={12} accessibilityLabel="Previous week">
              <Ionicons name="chevron-back" size={22} color={t.primary} />
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: '600', color: t.text }}>
              {weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })} – {weekEnd.toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </Text>
            <Pressable onPress={() => setWeekStart(addDays(weekStart, 7))} hitSlop={12} accessibilityLabel="Next week">
              <Ionicons name="chevron-forward" size={22} color={t.primary} />
            </Pressable>
          </Row>

          {days.map((d) => {
            const key = dayKey(d);
            const entries = menu
              .filter((m) => m.date === key)
              .sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
            const today = isSameDay(d, new Date());
            return (
              <Card key={key} style={today ? { borderColor: t.primary, borderWidth: 1.5 } : undefined}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '700', color: today ? t.primary : t.text, fontSize: 15 }}>
                    {d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                  </Text>
                  <Pressable onPress={() => router.push({ pathname: '/menu-add', params: { date: key } })} hitSlop={10} accessibilityLabel={`Add meal on ${key}`}>
                    <Ionicons name="add" size={22} color={t.primary} />
                  </Pressable>
                </Row>
                {entries.length === 0 ? (
                  <Body muted style={{ fontSize: 14 }}>Nothing planned</Body>
                ) : (
                  entries.map((m) => (
                    <Pressable key={m.id} onPress={() => entryActions(m)}>
                      <Row>
                        <Text style={{ width: 76, color: t.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>{m.meal}</Text>
                        <Body style={{ flex: 1 }}>{m.title}</Body>
                        {m.recipeId && <Ionicons name="book-outline" size={15} color={t.textMuted} />}
                      </Row>
                    </Pressable>
                  ))
                )}
              </Card>
            );
          })}

          <Button title="Add this week's ingredients to groceries" icon="cart-outline" variant="secondary" onPress={shopForWeek} loading={shopping} />
        </>
      ) : recipesLoading ? null : recipes.length === 0 ? (
        <EmptyState icon="book-outline" title="No recipes yet" message="Save your go-to meals here. Adding one to the menu puts its ingredients on the grocery list." />
      ) : (
        recipes.map((r) => (
          <Pressable key={r.id} onPress={() => router.push(`/recipe/${r.id}`)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Ionicons name="restaurant-outline" size={22} color={t.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: t.text }}>{r.name}</Text>
                <Body muted style={{ fontSize: 13 }}>
                  {r.ingredients.length} ingredients{r.servings ? ` · serves ${r.servings}` : ''}
                </Body>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
