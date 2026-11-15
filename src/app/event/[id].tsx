import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Switch } from 'react-native';
import { DateField } from '../../components/DateField';
import { useTheme } from '../../components/theme';
import { Button, Card, Chip, ChipRow, Divider, Field, Row, Screen, SectionTitle, Body } from '../../components/ui';
import { deleteEvent, saveEvent, useEvents } from '../../lib/data';
import { parseDayKey } from '../../lib/dates';
import { ensurePermission, reminderLabel, REMINDER_OPTIONS } from '../../lib/notifications';
import { useHome } from '../../lib/session';

function withTime(day: Date, time: Date): Date {
  const d = new Date(day);
  d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return d;
}

function defaultStart(dateKey?: string): Date {
  const now = new Date();
  const d = dateKey ? parseDayKey(dateKey) : new Date(now);
  d.setHours(now.getHours() + 1, 0, 0, 0);
  return d;
}

export default function EventEditor() {
  const t = useTheme();
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const isNew = id === 'new';
  const { homeId, uid } = useHome();
  const { data: events, loading } = useEvents(homeId);
  const existing = isNew ? undefined : events.find((e) => e.id === id);

  const [title, setTitle] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState(() => defaultStart(date));
  const [end, setEnd] = useState(() => new Date(defaultStart(date).getTime() + 3_600_000));
  const [notes, setNotes] = useState('');
  const [reminder, setReminder] = useState<number | null>(30);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(isNew);

  useEffect(() => {
    if (hydrated || !existing) return;
    setTitle(existing.title);
    setAllDay(existing.allDay);
    setStart(new Date(existing.start));
    setEnd(new Date(existing.end));
    setNotes(existing.notes);
    setReminder(existing.reminderMinutes);
    setHydrated(true);
  }, [existing, hydrated]);

  const changeStart = (d: Date) => {
    const duration = end.getTime() - start.getTime();
    setStart(d);
    setEnd(new Date(d.getTime() + Math.max(duration, 0)));
  };

  const save = async () => {
    if (!title.trim()) return Alert.alert('Give the event a title.');
    let s = start;
    let e = end;
    if (allDay) {
      s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      e = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59);
    }
    if (e < s) return Alert.alert('The event ends before it starts.');
    setSaving(true);
    try {
      if (reminder !== null) await ensurePermission();
      await saveEvent(
        homeId,
        {
          title: title.trim(),
          start: s.getTime(),
          end: e.getTime(),
          allDay,
          notes: notes.trim(),
          reminderMinutes: reminder,
          createdBy: existing?.createdBy ?? uid,
        },
        isNew ? undefined : id,
      );
      router.back();
    } catch (err) {
      setSaving(false);
      Alert.alert('Could not save event', String(err));
    }
  };

  const remove = () =>
    Alert.alert('Delete this event?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEvent(homeId, id);
          router.back();
        },
      },
    ]);

  if (!isNew && !loading && !existing) {
    return (
      <Screen>
        <Body muted>This event no longer exists.</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'New event' : 'Edit event' }} />
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="Dinner with friends" autoFocus={isNew} />

      <Card>
        <Row style={{ justifyContent: 'space-between', minHeight: 44 }}>
          <Body>All day</Body>
          <Switch value={allDay} onValueChange={setAllDay} trackColor={{ true: t.primary }} />
        </Row>
        <Divider />
        <DateField label="Starts" value={start} onChange={(d) => changeStart(withTime(d, start))} />
        {!allDay && <DateField label="" mode="time" value={start} onChange={(d) => changeStart(withTime(start, d))} />}
        <Divider />
        <DateField label="Ends" value={end} onChange={(d) => setEnd(withTime(d, end))} />
        {!allDay && <DateField label="" mode="time" value={end} onChange={(d) => setEnd(withTime(end, d))} />}
      </Card>

      <SectionTitle>Reminder</SectionTitle>
      <ChipRow>
        {REMINDER_OPTIONS.map((m) => (
          <Chip key={String(m)} label={reminderLabel(m)} selected={reminder === m} onPress={() => setReminder(m)} icon={m === null ? 'notifications-off-outline' : undefined} />
        ))}
      </ChipRow>
      <Body muted style={{ fontSize: 13 }}>Everyone in your home gets this reminder on their phone.</Body>

      <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Address, what to bring…" />

      <Button title={isNew ? 'Add event' : 'Save changes'} onPress={save} loading={saving} />
      {!isNew && <Button title="Delete event" variant="danger" onPress={remove} />}
    </Screen>
  );
}
