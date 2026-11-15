import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Text } from 'react-native';
import { useTheme } from '../../components/theme';
import { Body, Button, Card, Divider, H1, HeaderButton, Ionicons, Row, Screen, SectionTitle } from '../../components/ui';
import { addIngredientsToGroceries, deleteRecipe, useRecipes } from '../../lib/data';
import { useHome } from '../../lib/session';

export default function RecipeView() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { homeId, uid } = useHome();
  const { data: recipes, loading } = useRecipes(homeId);
  const recipe = recipes.find((r) => r.id === id);
  const [adding, setAdding] = useState(false);

  if (!recipe) {
    return (
      <Screen>
        <Body muted>{loading ? 'Loading…' : 'This recipe was deleted.'}</Body>
      </Screen>
    );
  }

  const addToGroceries = async () => {
    setAdding(true);
    try {
      const n = await addIngredientsToGroceries(homeId, recipe, uid);
      Alert.alert('Added to grocery list', `${n} ingredients added.`);
    } finally {
      setAdding(false);
    }
  };

  const remove = () =>
    Alert.alert(`Delete ${recipe.name}?`, 'Meals already on the menu will keep their name.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRecipe(homeId, recipe.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <HeaderButton icon="create-outline" label="Edit recipe" onPress={() => router.push({ pathname: '/recipe/edit', params: { id: recipe.id } })} />
          ),
        }}
      />
      <H1>{recipe.name}</H1>
      {recipe.servings ? <Body muted>Serves {recipe.servings}</Body> : null}
      {recipe.sourceUrl ? (
        <Text style={{ color: t.primary }} onPress={() => Linking.openURL(recipe.sourceUrl)} numberOfLines={1}>
          {recipe.sourceUrl}
        </Text>
      ) : null}

      <Button title="Add to menu" icon="calendar-outline" onPress={() => router.push({ pathname: '/menu-add', params: { recipeId: recipe.id } })} />
      <Button title="Add ingredients to groceries" icon="cart-outline" variant="secondary" onPress={addToGroceries} loading={adding} />

      <SectionTitle>Ingredients</SectionTitle>
      <Card style={{ gap: 0 }}>
        {recipe.ingredients.length === 0 ? (
          <Body muted>No ingredients listed.</Body>
        ) : (
          recipe.ingredients.map((ing, i) => (
            <Row key={i} style={{ paddingVertical: 8, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.border }}>
              <Ionicons name="ellipse" size={6} color={t.primary} />
              <Body style={{ flex: 1 }}>{ing.name}</Body>
              <Body muted>{ing.quantity}</Body>
            </Row>
          ))
        )}
      </Card>

      {recipe.instructions ? (
        <>
          <SectionTitle>Instructions</SectionTitle>
          <Card>
            <Body style={{ lineHeight: 24 }}>{recipe.instructions}</Body>
          </Card>
        </>
      ) : null}

      <Divider />
      <Button title="Delete recipe" variant="danger" onPress={remove} />
    </Screen>
  );
}
