import { Pressable, Text, View } from 'react-native';
import { addDays, dayKey, isSameDay, startOfWeek } from '../lib/dates';
import { Ionicons } from './ui';
import { space, useTheme } from './theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** A compact month calendar. Days with events get a dot. */
export function MonthGrid({
  month,
  selected,
  onSelect,
  onChangeMonth,
  markedDays,
}: {
  month: Date; // any date in the month to show
  selected: Date;
  onSelect: (d: Date) => void;
  onChangeMonth: (delta: number) => void;
  markedDays: Set<string>;
}) {
  const t = useTheme();
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const weeks = Math.ceil((lastOfMonth.getDate() + first.getDay()) / 7);
  const today = new Date();

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => onChangeMonth(-1)} hitSlop={12} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={22} color={t.primary} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '700', color: t.text }}>
          {month.toLocaleDateString([], { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable onPress={() => onChangeMonth(1)} hitSlop={12} accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={22} color={t.primary} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', color: t.textMuted, fontSize: 12, fontWeight: '600' }}>
            {w}
          </Text>
        ))}
      </View>
      {Array.from({ length: weeks }, (_, w) => (
        <View key={w} style={{ flexDirection: 'row' }}>
          {Array.from({ length: 7 }, (_, d) => {
            const day = addDays(gridStart, w * 7 + d);
            const inMonth = day.getMonth() === month.getMonth();
            const isSel = isSameDay(day, selected);
            const isToday = isSameDay(day, today);
            return (
              <Pressable
                key={d}
                onPress={() => onSelect(day)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}
                accessibilityLabel={day.toDateString()}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSel ? t.primary : 'transparent',
                    borderWidth: isToday && !isSel ? 1.5 : 0,
                    borderColor: t.primary,
                  }}
                >
                  <Text style={{ color: isSel ? t.primaryText : inMonth ? t.text : t.textMuted, fontWeight: isToday ? '700' : '400', opacity: inMonth ? 1 : 0.5 }}>
                    {day.getDate()}
                  </Text>
                </View>
                <View style={{ height: 5, width: 5, borderRadius: 3, marginTop: 2, backgroundColor: markedDays.has(dayKey(day)) ? t.primary : 'transparent' }} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
