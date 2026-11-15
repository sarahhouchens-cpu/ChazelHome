import { Stack } from 'expo-router';
import { useTheme } from '../../components/theme';

export default function AuthLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: t.primary,
        headerStyle: { backgroundColor: t.bg },
        headerTitleStyle: { color: t.text },
        contentStyle: { backgroundColor: t.bg },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
    </Stack>
  );
}
