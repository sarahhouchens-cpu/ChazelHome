import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { radius, useTheme } from './theme';

/** Date or time input. Uses the native compact picker on iOS and a dialog on Android. */
export function DateField({
  label,
  value,
  onChange,
  mode = 'date',
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  mode?: 'date' | 'time';
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const text =
    mode === 'date'
      ? value.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      : value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
      <Text style={{ color: t.text, fontSize: 16 }}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display="compact"
          minuteInterval={5}
          accentColor={t.primary}
          onValueChange={(_, d) => onChange(d)}
        />
      ) : (
        <>
          <Pressable
            onPress={() => setOpen(true)}
            style={{ backgroundColor: t.primarySoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm }}
          >
            <Text style={{ color: t.primary, fontWeight: '600' }}>{text}</Text>
          </Pressable>
          {open && (
            <DateTimePicker
              value={value}
              mode={mode}
              onValueChange={(_, d) => {
                setOpen(false);
                onChange(d);
              }}
              onDismiss={() => setOpen(false)}
            />
          )}
        </>
      )}
    </View>
  );
}
