import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { space, useTheme } from '../../components/theme';
import { Avatar, Body, Card, Checkbox, H1, Ionicons, Row, Screen, SectionTitle } from '../../components/ui';
import { useEvents, useMenu, useShopping, useTodos, toggleTodo } from '../../lib/data';
import { dayKey, formatDayLong, formatTime, isSameDay, relativeDueLabel } from '../../lib/dates';
import { useHome } from '../../lib/session';
import { MEALS } from '../../lib/types';

export default function Dashboard() {
  const t = useTheme();
  const { homeId, home, uid, profile, members, memberById } = useHome();
  const today = new Date();
  const todayKey = dayKey(today);

  const { data: events } = useEvents(homeId);
  const { data: menu } = useMenu(homeId, todayKey, todayKey);
  const { data: todos } = useTodos(homeId);
  const { data: shopping } = useShopping(homeId);

  const todaysEvents = events.filter((e) => isSameDay(new Date(e.start), today));
  const myTodos = todos
    .filter((td) => !td.done && (td.assigneeId === uid || td.assigneeId === null))
    .filter((td) => !td.dueDate || td.dueDate <= todayKey)
    .sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'));
  const groceriesLeft = shopping.filter((s) => !s.checked && s.category === 'groceries').length;
  const otherLeft = shopping.filter((s) => !s.checked && s.category !== 'groceries').length;

  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Body muted>{formatDayLong(today)}</Body>
        <H1>
          {greeting}, {profile?.displayName?.split(' ')[0]}
        </H1>
        <Row style={{ marginTop: 4 }}>
          <View style={{ flexDirection: 'row' }}>
            {members.map((m, i) => (
              <View key={m.id} style={{ marginLeft: i ? -8 : 0, borderWidth: 2, borderColor: t.bg, borderRadius: 16 }}>
                <Avatar name={m.displayName} color={m.color} />
              </View>
            ))}
          </View>
          <Body muted>{home.name}</Body>
        </Row>
      </View>

      <SectionTitle>Today</SectionTitle>
      <Card>
        {todaysEvents.length === 0 ? (
          <Body muted>Nothing on the calendar today.</Body>
        ) : (
          todaysEvents.map((e) => (
            <Pressable key={e.id} onPress={() => router.push(`/event/${e.id}`)}>
              <Row>
                <Text style={{ width: 72, color: t.textMuted, fontWeight: '600' }}>{e.allDay ? 'All day' : formatTime(e.start)}</Text>
                <Body style={{ flex: 1 }}>{e.title}</Body>
              </Row>
            </Pressable>
          ))
        )}
      </Card>

      <SectionTitle>On the menu</SectionTitle>
      <Card>
        {menu.length === 0 ? (
          <Pressable onPress={() => router.push({ pathname: '/menu-add', params: { date: todayKey } })}>
            <Body muted>No meals planned. Tap to add one.</Body>
          </Pressable>
        ) : (
          MEALS.flatMap((meal) =>
            menu
              .filter((m) => m.meal === meal)
              .map((m) => (
                <Pressable key={m.id} disabled={!m.recipeId} onPress={() => router.push(`/recipe/${m.recipeId}`)}>
                  <Row>
                    <Text style={{ width: 80, color: t.textMuted, fontWeight: '600', textTransform: 'capitalize' }}>{meal}</Text>
                    <Body style={{ flex: 1 }}>{m.title}</Body>
                  </Row>
                </Pressable>
              )),
          )
        )}
      </Card>

      <SectionTitle>Your to-dos</SectionTitle>
      <Card>
        {myTodos.length === 0 ? (
          <Body muted>All caught up 🎉</Body>
        ) : (
          myTodos.slice(0, 6).map((td) => {
            const assignee = memberById(td.assigneeId);
            return (
              <Row key={td.id}>
                <Checkbox checked={td.done} onPress={() => toggleTodo(homeId, td, uid)} />
                <Pressable style={{ flex: 1 }} onPress={() => router.push(`/todo/${td.id}`)}>
                  <Body>{td.title}</Body>
                  {td.dueDate && (
                    <Text style={{ color: td.dueDate < todayKey ? t.danger : t.textMuted, fontSize: 13 }}>
                      {relativeDueLabel(td.dueDate)}
                    </Text>
                  )}
                </Pressable>
                {assignee ? <Avatar name={assignee.displayName} color={assignee.color} size={24} /> : <Text style={{ color: t.textMuted, fontSize: 12 }}>Anyone</Text>}
              </Row>
            );
          })
        )}
      </Card>

      <Pressable onPress={() => router.push('/lists')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Ionicons name="cart-outline" size={24} color={t.primary} />
          <View style={{ flex: 1 }}>
            <Body>
              {groceriesLeft} grocery {groceriesLeft === 1 ? 'item' : 'items'} to buy
            </Body>
            {otherLeft > 0 && <Body muted>+ {otherLeft} on other lists</Body>}
          </View>
          <Ionicons name="chevron-forward" size={20} color={t.textMuted} />
        </Card>
      </Pressable>
    </Screen>
  );
}
