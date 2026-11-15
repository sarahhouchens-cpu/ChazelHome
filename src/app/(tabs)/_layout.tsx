import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { useEffect } from 'react';
import { useTheme } from '../../components/theme';
import { HeaderButton, Ionicons, type IconName } from '../../components/ui';
import { useEvents } from '../../lib/data';
import { registerForPushNotifications, syncEventReminders } from '../../lib/notifications';
import { useHome } from '../../lib/session';

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'calendar', title: 'Calendar', icon: 'calendar-outline', iconActive: 'calendar' },
  { name: 'lists', title: 'Lists', icon: 'cart-outline', iconActive: 'cart' },
  { name: 'menu', title: 'Menu', icon: 'restaurant-outline', iconActive: 'restaurant' },
  { name: 'todos', title: 'To-Do', icon: 'checkbox-outline', iconActive: 'checkbox' },
];

/** Keeps this device's calendar reminders in sync with the shared calendar. */
function useCalendarNotifications(homeId: string, uid: string) {
  const { data: events, loading } = useEvents(homeId);
  useEffect(() => {
    registerForPushNotifications(uid);
  }, [uid]);
  useEffect(() => {
    if (!loading) syncEventReminders(events);
  }, [events, loading]);
  // Tapping a notification opens the related event or to-do.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { eventId?: string; todoId?: string } | undefined;
      if (data?.eventId) router.push(`/event/${data.eventId}`);
      else if (data?.todoId) router.push(`/todo/${data.todoId}`);
    });
    return () => sub.remove();
  }, []);
}

export default function TabsLayout() {
  const t = useTheme();
  const { homeId, uid } = useHome();
  useCalendarNotifications(homeId, uid);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        headerStyle: { backgroundColor: t.bg },
        headerTitleStyle: { color: t.text, fontWeight: '700' },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? tab.iconActive : tab.icon} size={size} color={color as string} />
            ),
            headerRight:
              tab.name === 'index'
                ? () => <HeaderButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
                : undefined,
          }}
        />
      ))}
    </Tabs>
  );
}
