import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { radius, space, useTheme } from '../../components/theme';
import { Body, Button, Field, Ionicons, Screen, SectionTitle } from '../../components/ui';
import { saveRecipe, useRecipes } from '../../lib/data';
import { parseIngredientLines } from '../../lib/ingredients';
import { useHome } from '../../lib/session';
import type { Ingredient } from '../../lib/types';

export default function RecipeEdit() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { homeId, uid } = useHome();
  const { data: recipes } = useRecipes(homeId);
  const existing = id ? recipes.find((r) => r.id === id) : undefined;

  const [name, setName] = useState('');
  const [servings, setServings] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', quantity: '' }]);
  const [instructions, setInstructions] = useState('');
  const [paste, setPaste] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(!id);

  useEffect(() => {
    if (hydrated || !existing) return;
    setName(existing.name);
    setServings(existing.servings);
    setSourceUrl(existing.sourceUrl);
    setIngredients(existing.ingredients.length ? existing.ingredients : [{ name: '', quantity: '' }]);
    setInstructions(existing.instructions);
    setHydrated(true);
  }, [existing, hydrated]);

  const setIng = (i: number, patch: Partial<Ingredient>) =>
    setIngredients((list) => list.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)));

  const applyPaste = () => {
    const parsed = parseIngredientLines(paste ?? '');
    setIngredients((list) => [...list.filter((i) => i.name.trim()), ...parsed]);
    setPaste(null);
  };

  const save = async () => {
    if (!name.trim()) return Alert.alert('Give the recipe a name.');
    setSaving(true);
    try {
      const savedId = await saveRecipe(
        homeId,
        {
          name: name.trim(),
          servings: servings.trim(),
          sourceUrl: sourceUrl.trim(),
          ingredients: ingredients.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), quantity: i.quantity.trim() })),
          instructions: instructions.trim(),
          createdBy: existing?.createdBy ?? uid,
        },
        id,
      );
      if (id) router.back();
      else router.replace(`/recipe/${savedId}`);
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save recipe', String(e));
    }
  };

  const inputStyle = { backgroundColor: t.input, color: t.text, borderColor: t.border, borderWidth: 1, borderRadius: radius.md, padding: 10, fontSize: 16 } as const;

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Edit recipe' : 'New recipe' }} />
      <Field label="Name" value={name} onChangeText={setName} placeholder="Sheet-pan chicken" autoFocus={!id} />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Field label="Serves" value={servings} onChangeText={setServings} placeholder="4" keyboardType="number-pad" />
        </View>
        <View style={{ flex: 2 }}>
          <Field label="Link (optional)" value={sourceUrl} onChangeText={setSourceUrl} placeholder="https://…" autoCapitalize="none" keyboardType="url" />
        </View>
      </View>

      <SectionTitle right={<Button small variant="ghost" icon="clipboard-outline" title="Paste list" onPress={() => setPaste('')} />}>
        Ingredients
      </SectionTitle>

      {paste !== null && (
        <View style={{ gap: space.sm }}>
          <Field value={paste} onChangeText={setPaste} multiline placeholder={'One per line, e.g.\n2 cups rice\n1 lb chicken thighs\n3 cloves garlic'} autoFocus />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button title="Cancel" variant="ghost" onPress={() => setPaste(null)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Add lines" onPress={applyPaste} />
            </View>
          </View>
        </View>
      )}

      {ingredients.map((ing, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <TextInput value={ing.quantity} onChangeText={(v) => setIng(i, { quantity: v })} placeholder="Qty" placeholderTextColor={t.textMuted} style={[inputStyle, { width: 90 }]} />
          <TextInput
            value={ing.name}
            onChangeText={(v) => setIng(i, { name: v })}
            placeholder="Ingredient"
            placeholderTextColor={t.textMuted}
            style={[inputStyle, { flex: 1 }]}
            returnKeyType="next"
            onSubmitEditing={() => i === ingredients.length - 1 && setIngredients((l) => [...l, { name: '', quantity: '' }])}
          />
          <Pressable onPress={() => setIngredients((l) => l.filter((_, idx) => idx !== i))} hitSlop={8} accessibilityLabel="Remove ingredient">
            <Ionicons name="close-circle" size={24} color={t.textMuted} />
          </Pressable>
        </View>
      ))}
      <Button small variant="secondary" icon="add" title="Add ingredient" onPress={() => setIngredients((l) => [...l, { name: '', quantity: '' }])} />

      <Field label="Instructions" value={instructions} onChangeText={setInstructions} multiline placeholder="Steps, notes, oven temp…" />
      <Body muted style={{ fontSize: 13 }}>Ingredients are added to the Groceries list whenever this recipe goes on the menu.</Body>
      <Button title="Save recipe" onPress={save} loading={saving} />
    </Screen>
  );
}
