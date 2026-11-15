import { router, useNavigation } from 'expo-router';
import { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MonthGrid } from '../../components/MonthGrid';
import { space, useTheme } from '../../components/theme';
import { Avatar, Body, Card, EmptyState, HeaderButton, Ionicons, Screen, SectionTitle } from '../../components/ui';
import { useEvents } from '../../lib/data';
import { addDays, addMonths, dayKey, formatDayLong, formatTime, startOfDay } from '../../lib/dates';
import { reminderLabel } from '../../lib/notifications';
import { useHome } from '../../lib/session';
import type { CalendarEvent } from '../../lib/types';

/** Every local day an event touches (multi-day events mark each day). */
function daysOf(e: CalendarEvent): string[] {
  const out: string[] = [];
  let d = startOfDay(new Date(e.start));
  const last = startOfDay(new Date(Math.max(e.end, e.start)));
  while (d <= last && out.length < 60) {
    out.push(dayKey(d));
    d = addDays(d, 1);
  }
  return out;
}

export default function CalendarScreen() {
  const t = useTheme();
  const navigation = useNavigation();
  const { homeId, memberById } = useHome();
  const { data: events } = useEvents(homeId);
  const [selected, setSelected] = useState(startOfDay(new Date()));
  const [month, setMonth] = useState(new Date());

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon="add-circle"
          label="New event"
          onPress={() => router.push({ pathname: '/event/[id]', params: { id: 'new', date: dayKey(selected) } })}
        />
      ),
    });
  }, [navigation, selected]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) for (const k of daysOf(e)) map.set(k, [...(map.get(k) ?? []), e]);
    return map;
  }, [events]);

  const dayEvents = (byDay.get(dayKey(selected)) ?? []).sort(
    (a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start,
  );

  return (
    <Screen>
      <Card>
        <MonthGrid
          month={month}
          selected={selected}
          markedDays={new Set(byDay.keys())}
          onSelect={(d) => {
            setSelected(d);
            if (d.getMonth() !== month.getMonth()) setMonth(d);
          }}
          onChangeMonth={(delta) => setMonth((m) => addMonths(new Date(m.getFullYear(), m.getMonth(), 1), delta))}
        />
      </Card>

      <SectionTitle>{formatDayLong(selected)}</SectionTitle>
      {dayEvents.length === 0 ? (
        <EmptyState icon="calendar-clear-outline" title="Nothing planned" message="Tap + to add an event for this day." />
      ) : (
        dayEvents.map((e) => {
          const who = memberById(e.createdBy);
          return (
            <Pressable key={e.id} onPress={() => router.push(`/event/${e.id}`)}>
              <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: who?.color ?? t.primary }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: t.text }}>{e.title}</Text>
                  <Body muted style={{ fontSize: 14 }}>
                    {e.allDay ? 'All day' : `${formatTime(e.start)} – ${formatTime(e.end)}`}
                  </Body>
                  {e.reminderMinutes !== null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="notifications-outline" size={13} color={t.textMuted} />
                      <Text style={{ color: t.textMuted, fontSize: 13 }}>{reminderLabel(e.reminderMinutes)}</Text>
                    </View>
                  )}
                </View>
                {who && <Avatar name={who.displayName} color={who.color} size={26} />}
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}
