import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Switch } from 'react-native';
import { DateField } from '../../components/DateField';
import { useTheme } from '../../components/theme';
import { Avatar, Body, Button, Card, Chip, ChipRow, Divider, Field, Row, Screen, SectionTitle } from '../../components/ui';
import { deleteTodo, saveTodo, useTodos } from '../../lib/data';
import { dayKey, formatDayShort, parseDayKey } from '../../lib/dates';
import { useHome } from '../../lib/session';
import { RECURRENCE_OPTIONS, type Recurrence } from '../../lib/types';

export default function TodoEditor() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { homeId, uid, members, memberById } = useHome();
  const { data: todos, loading } = useTodos(homeId);
  const existing = isNew ? undefined : todos.find((td) => td.id === id);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [hasDue, setHasDue] = useState(false);
  const [due, setDue] = useState(new Date());
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(isNew);

  useEffect(() => {
    if (hydrated || !existing) return;
    setTitle(existing.title);
    setNotes(existing.notes);
    setAssigneeId(existing.assigneeId);
    setHasDue(Boolean(existing.dueDate));
    if (existing.dueDate) setDue(parseDayKey(existing.dueDate));
    setRecurrence(existing.recurrence);
    setHydrated(true);
  }, [existing, hydrated]);

  const pickRecurrence = (r: Recurrence) => {
    setRecurrence(r);
    if (r !== 'none') setHasDue(true); // repeating tasks need a due date to roll forward from
  };

  const save = async () => {
    if (!title.trim()) return Alert.alert('What needs doing?');
    setSaving(true);
    try {
      await saveTodo(
        homeId,
        { title: title.trim(), notes: notes.trim(), assigneeId, dueDate: hasDue ? dayKey(due) : null, recurrence },
        uid,
        isNew ? undefined : id,
      );
      router.back();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', String(e));
    }
  };

  const remove = () =>
    Alert.alert('Delete this to-do?', existing?.recurrence !== 'none' ? 'This stops it from repeating.' : undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTodo(homeId, id);
          router.back();
        },
      },
    ]);

  if (!isNew && !loading && !existing) {
    return (
      <Screen>
        <Body muted>This to-do no longer exists.</Body>
      </Screen>
    );
  }

  const completedBy = memberById(existing?.completedBy);

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'New to-do' : 'Edit to-do' }} />
      <Field label="Task" value={title} onChangeText={setTitle} placeholder="Take out the recycling" autoFocus={isNew} />

      <SectionTitle>Assign to</SectionTitle>
      <ChipRow>
        <Chip label="Anyone" icon="people-outline" selected={assigneeId === null} onPress={() => setAssigneeId(null)} />
        {members.map((m) => (
          <Chip key={m.id} label={m.id === uid ? `${m.displayName.split(' ')[0]} (me)` : m.displayName.split(' ')[0]} color={m.color} selected={assigneeId === m.id} onPress={() => setAssigneeId(m.id)} />
        ))}
      </ChipRow>

      <SectionTitle>Repeat</SectionTitle>
      <ChipRow>
        {RECURRENCE_OPTIONS.map((r) => (
          <Chip key={r.key} label={r.label} icon={r.key === 'none' ? undefined : 'repeat'} selected={recurrence === r.key} onPress={() => pickRecurrence(r.key)} />
        ))}
      </ChipRow>

      <Card>
        <Row style={{ justifyContent: 'space-between', minHeight: 44 }}>
          <Body>Due date</Body>
          <Switch value={hasDue} onValueChange={(v) => {
            if (recurrence === "none" || v) setHasDue(v);
          }} trackColor={{ true: t.primary }} />
        </Row>
        {hasDue && (
          <>
            <Divider />
            <DateField label={recurrence === 'none' ? 'Due' : 'Next due'} value={due} onChange={setDue} />
          </>
        )}
        {recurrence !== 'none' && (
          <Body muted style={{ fontSize: 13 }}>
            When checked off, this task moves to its next due date automatically.
          </Body>
        )}
      </Card>

      <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Details…" />

      {existing?.completedAt && completedBy && (
        <Row>
          <Avatar name={completedBy.displayName} color={completedBy.color} size={22} />
          <Body muted style={{ fontSize: 13 }}>
            Last done by {completedBy.displayName} on {formatDayShort(new Date(existing.completedAt))}
          </Body>
        </Row>
      )}

      <Button title={isNew ? 'Add to-do' : 'Save changes'} onPress={save} loading={saving} />
      {!isNew && <Button title="Delete to-do" variant="danger" onPress={remove} />}
    </Screen>
  );
}
