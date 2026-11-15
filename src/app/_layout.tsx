import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { useTheme } from '../components/theme';
import { Loading } from '../components/ui';
import { isFirebaseConfigured } from '../lib/firebase';
import { SessionProvider, useSession } from '../lib/session';

function RootNavigator() {
  const { initializing, user, home } = useSession();
  const t = useTheme();
  if (initializing) return <Loading />;

  const signedIn = Boolean(user);
  const hasHome = Boolean(home);

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
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !hasHome}>
        <Stack.Screen name="onboarding" options={{ title: 'Set up your home', headerBackVisible: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && hasHome}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ presentation: 'modal', title: 'Event' }} />
        <Stack.Screen name="todo/[id]" options={{ presentation: 'modal', title: 'To-do' }} />
        <Stack.Screen name="recipe/[id]" options={{ title: 'Recipe' }} />
        <Stack.Screen name="recipe/edit" options={{ presentation: 'modal', title: 'Recipe' }} />
        <Stack.Screen name="menu-add" options={{ presentation: 'modal', title: 'Add to menu' }} />
        <Stack.Screen name="settings" options={{ title: 'Home & settings' }} />
      </Stack.Protected>
    </Stack>
  );
}

function MissingConfig() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, padding: 32, justifyContent: 'center', gap: 12, backgroundColor: t.bg }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: t.text }}>Firebase isn't configured</Text>
      <Text style={{ fontSize: 16, color: t.textMuted }}>
        Copy .env.example to .env.local, fill in your Firebase web app keys, and restart the dev server. See
        README.md for the full setup.
      </Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      {isFirebaseConfigured ? (
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      ) : (
        <MissingConfig />
      )}
    </>
  );
}
