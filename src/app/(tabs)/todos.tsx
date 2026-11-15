import { router, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../components/theme';
import { Avatar, Card, Checkbox, Chip, ChipRow, Divider, EmptyState, HeaderButton, Ionicons, Row, Screen, SectionTitle } from '../../components/ui';
import { toggleTodo, useTodos } from '../../lib/data';
import { dayKey, relativeDueLabel } from '../../lib/dates';
import { useHome } from '../../lib/session';
import { RECURRENCE_OPTIONS, type Todo } from '../../lib/types';

type Filter = 'mine' | 'all' | 'anyone' | string; // or a member id

export default function TodosScreen() {
  const t = useTheme();
  const navigation = useNavigation();
  const { homeId, uid, members, memberById } = useHome();
  const { data: todos, loading } = useTodos(homeId);
  const [filter, setFilter] = useState<Filter>('all');
  const [showDone, setShowDone] = useState(false);
  const todayKey = dayKey(new Date());

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <HeaderButton icon="add-circle" label="New to-do" onPress={() => router.push('/todo/new')} />,
    });
  }, [navigation]);

  const matches = (td: Todo) => {
    if (filter === 'all') return true;
    if (filter === 'mine') return td.assigneeId === uid;
    if (filter === 'anyone') return td.assigneeId === null;
    return td.assigneeId === filter;
  };

  const visible = todos.filter(matches);
  const open = visible.filter((td) => !td.done).sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const groups: { title: string; items: Todo[] }[] = [
    { title: 'Overdue', items: open.filter((td) => td.dueDate && td.dueDate < todayKey) },
    { title: 'Today', items: open.filter((td) => td.dueDate === todayKey) },
    { title: 'Upcoming', items: open.filter((td) => td.dueDate && td.dueDate > todayKey) },
    { title: 'Anytime', items: open.filter((td) => !td.dueDate) },
  ].filter((g) => g.items.length);
  const done = visible.filter((td) => td.done).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  const renderTodo = (td: Todo, idx: number) => {
    const assignee = memberById(td.assigneeId);
    const rec = RECURRENCE_OPTIONS.find((r) => r.key === td.recurrence);
    return (
      <View key={td.id}>
        {idx > 0 && <Divider />}
        <Row style={{ paddingVertical: 10 }}>
          <Checkbox checked={td.done} onPress={() => toggleTodo(homeId, td, uid)} color={assignee?.color} />
          <Pressable style={{ flex: 1, gap: 2 }} onPress={() => router.push(`/todo/${td.id}`)}>
            <Text style={{ fontSize: 16, color: td.done ? t.textMuted : t.text, textDecorationLine: td.done ? 'line-through' : 'none' }}>{td.title}</Text>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              {td.dueDate && !td.done && (
                <Text style={{ fontSize: 13, color: td.dueDate < todayKey ? t.danger : t.textMuted }}>{relativeDueLabel(td.dueDate)}</Text>
              )}
              {td.recurrence !== 'none' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="repeat" size={13} color={t.textMuted} />
                  <Text style={{ fontSize: 13, color: t.textMuted }}>{rec?.label}</Text>
                </View>
              )}
            </View>
          </Pressable>
          {assignee ? <Avatar name={assignee.displayName} color={assignee.color} size={26} /> : <Text style={{ fontSize: 12, color: t.textMuted }}>Anyone</Text>}
        </Row>
      </View>
    );
  };

  return (
    <Screen>
      <ChipRow>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Mine" selected={filter === 'mine'} onPress={() => setFilter('mine')} />
        {members
          .filter((m) => m.id !== uid)
          .map((m) => (
            <Chip key={m.id} label={m.displayName.split(' ')[0]} color={m.color} selected={filter === m.id} onPress={() => setFilter(m.id)} />
          ))}
        <Chip label="Unassigned" selected={filter === 'anyone'} onPress={() => setFilter('anyone')} />
      </ChipRow>

      {!loading && open.length === 0 && (
        <EmptyState icon="checkmark-done-outline" title="Nothing to do" message="Tap + to add a task. Set it to repeat for chores like trash day or watering plants." />
      )}

      {groups.map((g) => (
        <View key={g.title} style={{ gap: 8 }}>
          <SectionTitle>{g.title}</SectionTitle>
          <Card style={{ gap: 0, paddingVertical: 4 }}>{g.items.map(renderTodo)}</Card>
        </View>
      ))}

      {done.length > 0 && (
        <>
          <Pressable onPress={() => setShowDone((s) => !s)}>
            <SectionTitle right={<Ionicons name={showDone ? 'chevron-up' : 'chevron-down'} size={16} color={t.textMuted} />}>
              Completed ({done.length})
            </SectionTitle>
          </Pressable>
          {showDone && <Card style={{ gap: 0, paddingVertical: 4 }}>{done.slice(0, 30).map(renderTodo)}</Card>}
        </>
      )}
    </Screen>
  );
}
