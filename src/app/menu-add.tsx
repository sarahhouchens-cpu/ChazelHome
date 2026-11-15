import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch } from 'react-native';
import { DateField } from '../components/DateField';
import { useTheme } from '../components/theme';
import { Body, Button, Card, Chip, ChipRow, Field, Row, Screen, SectionTitle } from '../components/ui';
import { addMenuEntry, useRecipes } from '../lib/data';
import { dayKey, parseDayKey } from '../lib/dates';
import { useHome } from '../lib/session';
import { MEALS, type Meal } from '../lib/types';

export default function MenuAdd() {
  const t = useTheme();
  const params = useLocalSearchParams<{ date?: string; recipeId?: string }>();
  const { homeId, uid } = useHome();
  const { data: recipes } = useRecipes(homeId);
  const [date, setDate] = useState(() => (params.date ? parseDayKey(params.date) : new Date()));
  const [meal, setMeal] = useState<Meal>('dinner');
  const [recipeId, setRecipeId] = useState<string | null>(params.recipeId ?? null);
  const [title, setTitle] = useState('');
  const [addToGroceries, setAddToGroceries] = useState(true);
  const [saving, setSaving] = useState(false);

  const recipe = recipes.find((r) => r.id === recipeId) ?? null;

  const save = async () => {
    if (!recipe && !title.trim()) return Alert.alert('Pick a recipe or type what you’re having.');
    setSaving(true);
    try {
      const added = await addMenuEntry(homeId, { date: dayKey(date), meal, title, recipe }, uid, addToGroceries);
      router.back();
      if (added > 0) setTimeout(() => Alert.alert('Added to grocery list', `${added} ingredients from ${recipe?.name}.`), 400);
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not add meal', String(e));
    }
  };

  return (
    <Screen>
      <Card>
        <DateField label="Day" value={date} onChange={setDate} />
      </Card>
      <ChipRow>
        {MEALS.map((m) => (
          <Chip key={m} label={m[0].toUpperCase() + m.slice(1)} selected={meal === m} onPress={() => setMeal(m)} />
        ))}
      </ChipRow>

      <SectionTitle>From your recipes</SectionTitle>
      {recipes.length === 0 ? (
        <Body muted>No saved recipes yet. Type a meal below, or save a recipe from the Menu tab.</Body>
      ) : (
        <ChipRow>
          {recipes.map((r) => (
            <Chip key={r.id} label={r.name} icon="book-outline" selected={recipeId === r.id} onPress={() => setRecipeId(recipeId === r.id ? null : r.id)} />
          ))}
        </ChipRow>
      )}

      {!recipe && (
        <>
          <SectionTitle>Or something quick</SectionTitle>
          <Field value={title} onChangeText={setTitle} placeholder="Leftovers, takeout, tacos…" />
        </>
      )}

      {recipe && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body style={{ flex: 1 }}>Add {recipe.ingredients.length} ingredients to the grocery list</Body>
            <Switch value={addToGroceries} onValueChange={setAddToGroceries} trackColor={{ true: t.primary }} />
          </Row>
        </Card>
      )}

      <Button title="Add to menu" icon="checkmark" onPress={save} loading={saving} />
    </Screen>
  );
}
