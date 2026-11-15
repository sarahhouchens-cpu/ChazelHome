import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { radius, space, useTheme } from '../../components/theme';
import { Avatar, Button, Card, Checkbox, Chip, ChipRow, Divider, EmptyState, Ionicons, Row, Screen, SectionTitle } from '../../components/ui';
import { addShoppingItem, clearCheckedItems, deleteShoppingItem, updateShoppingItem, useShopping } from '../../lib/data';
import { useHome } from '../../lib/session';
import { SHOPPING_CATEGORIES, type ShoppingCategory, type ShoppingItem } from '../../lib/types';

export default function ListsScreen() {
  const t = useTheme();
  const { homeId, uid, memberById } = useHome();
  const { data: items, loading } = useShopping(homeId);
  const [category, setCategory] = useState<ShoppingCategory>('groceries');
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');

  const inCat = items.filter((i) => i.category === category);
  const open = inCat.filter((i) => !i.checked);
  const done = inCat.filter((i) => i.checked);

  const add = async () => {
    if (!name.trim()) return;
    const n = name;
    const q = qty;
    setName('');
    setQty('');
    await addShoppingItem(homeId, { name: n, quantity: q, category, addedBy: uid });
  };

  const itemActions = (item: ShoppingItem) =>
    Alert.alert(item.name, item.recipeName ? `Added for ${item.recipeName}` : undefined, [
      ...SHOPPING_CATEGORIES.filter((c) => c.key !== item.category).map((c) => ({
        text: `Move to ${c.label}`,
        onPress: () => updateShoppingItem(homeId, item.id, { category: c.key }),
      })),
      {
        text: 'Edit quantity',
        onPress: () =>
          Alert.prompt?.('Quantity', undefined, (v) => updateShoppingItem(homeId, item.id, { quantity: v.trim() }), 'plain-text', item.quantity),
      },
      { text: 'Delete', style: 'destructive', onPress: () => deleteShoppingItem(homeId, item.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const renderItem = (item: ShoppingItem) => {
    const who = memberById(item.addedBy);
    return (
      <Pressable key={item.id} onLongPress={() => itemActions(item)} onPress={() => itemActions(item)}>
        <Row style={{ paddingVertical: 6 }}>
          <Checkbox checked={item.checked} onPress={() => updateShoppingItem(homeId, item.id, { checked: !item.checked })} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, color: item.checked ? t.textMuted : t.text, textDecorationLine: item.checked ? 'line-through' : 'none' }}>
              {item.name}
              {item.quantity ? <Text style={{ color: t.textMuted }}>  · {item.quantity}</Text> : null}
            </Text>
            {item.recipeName && !item.checked && (
              <Text style={{ fontSize: 12, color: t.textMuted }}>for {item.recipeName}</Text>
            )}
          </View>
          {who && <Avatar name={who.displayName} color={who.color} size={20} />}
        </Row>
      </Pressable>
    );
  };

  return (
    <Screen>
      <ChipRow>
        {SHOPPING_CATEGORIES.map((c) => {
          const count = items.filter((i) => i.category === c.key && !i.checked).length;
          return (
            <Chip key={c.key} icon={c.icon} label={count ? `${c.label} (${count})` : c.label} selected={category === c.key} onPress={() => setCategory(c.key)} />
          );
        })}
      </ChipRow>

      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={`Add to ${SHOPPING_CATEGORIES.find((c) => c.key === category)?.label.toLowerCase()}…`}
          placeholderTextColor={t.textMuted}
          onSubmitEditing={add}
          returnKeyType="done"
          style={{ flex: 1, backgroundColor: t.input, color: t.text, borderColor: t.border, borderWidth: 1, borderRadius: radius.md, padding: 12, fontSize: 16 }}
        />
        <TextInput
          value={qty}
          onChangeText={setQty}
          placeholder="Qty"
          placeholderTextColor={t.textMuted}
          onSubmitEditing={add}
          style={{ width: 70, backgroundColor: t.input, color: t.text, borderColor: t.border, borderWidth: 1, borderRadius: radius.md, padding: 12, fontSize: 16 }}
        />
        <Pressable onPress={add} accessibilityLabel="Add item" hitSlop={8}>
          <Ionicons name="add-circle" size={40} color={t.primary} />
        </Pressable>
      </View>

      {!loading && inCat.length === 0 ? (
        <EmptyState icon="basket-outline" title="List is empty" message={category === 'groceries' ? 'Add items here, or add a recipe to your menu to fill it automatically.' : 'Add the first item above.'} />
      ) : (
        <>
          {open.length > 0 && <Card style={{ gap: 0 }}>{open.map((i, idx) => [idx > 0 && <Divider key={`d${i.id}`} />, renderItem(i)])}</Card>}
          {done.length > 0 && (
            <>
              <SectionTitle
                right={<Button small variant="ghost" title="Clear" icon="trash-outline" onPress={() => clearCheckedItems(homeId, category)} />}
              >
                In the cart ({done.length})
              </SectionTitle>
              <Card style={{ gap: 0 }}>{done.map(renderItem)}</Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
