import { useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';
import { space, useTheme } from '../components/theme';
import { Avatar, Body, Button, Card, Divider, Field, Row, Screen, SectionTitle } from '../components/ui';
import { registerForPushNotifications } from '../lib/notifications';
import { useHome } from '../lib/session';

const COLORS = ['#4F7A6B', '#C26B4F', '#5B6BB5', '#B5895B', '#8E5BB5', '#4F94A8', '#B55B7A'];

export default function Settings() {
  const t = useTheme();
  const { home, members, profile, uid, user, renameHome, updateMyProfile, leaveHome, signOut } = useHome();
  const [homeName, setHomeName] = useState(home.name);
  const [myName, setMyName] = useState(profile?.displayName ?? '');

  const invite = () =>
    Share.share({
      message: `Join our home "${home.name}" on Chazel Home! Sign up in the app, choose "Join an existing home", and enter code: ${home.inviteCode}`,
    });

  const confirmLeave = () =>
    Alert.alert('Leave this home?', 'You will lose access to its calendar, lists and to-dos until someone invites you back.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => leaveHome() },
    ]);

  return (
    <Screen>
      <SectionTitle>Invite someone</SectionTitle>
      <Card style={{ alignItems: 'center', gap: space.md }}>
        <Body muted>Share this code. They create their own account, then tap “Join an existing home”.</Body>
        <Text selectable style={{ fontSize: 36, fontWeight: '800', letterSpacing: 8, color: t.primary }}>
          {home.inviteCode}
        </Text>
        <Button title="Send invite" icon="share-outline" onPress={invite} />
      </Card>

      <SectionTitle>People in {home.name}</SectionTitle>
      <Card style={{ gap: 0 }}>
        {members.map((m, i) => (
          <View key={m.id}>
            {i > 0 && <Divider />}
            <Row style={{ paddingVertical: 10 }}>
              <Avatar name={m.displayName} color={m.color} size={34} />
              <View style={{ flex: 1 }}>
                <Body>
                  {m.displayName}
                  {m.id === uid ? ' (you)' : ''}
                </Body>
                <Body muted style={{ fontSize: 13 }}>
                  {m.email}
                  {m.id === home.ownerId ? ' · created this home' : ''}
                </Body>
              </View>
            </Row>
          </View>
        ))}
      </Card>

      <SectionTitle>Home</SectionTitle>
      <Card>
        <Field label="Home name" value={homeName} onChangeText={setHomeName} onEndEditing={() => homeName.trim() && homeName !== home.name && renameHome(homeName)} />
      </Card>

      <SectionTitle>You</SectionTitle>
      <Card>
        <Field label="Display name" value={myName} onChangeText={setMyName} onEndEditing={() => myName.trim() && myName !== profile?.displayName && updateMyProfile({ displayName: myName.trim() })} />
        <Text style={{ color: t.textMuted, fontSize: 13, fontWeight: '600' }}>Your color</Text>
        <Row style={{ flexWrap: 'wrap', gap: space.sm }}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => updateMyProfile({ color: c })}
              accessibilityLabel={`Color ${c}`}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: profile?.color === c ? 3 : 0, borderColor: t.text }}
            />
          ))}
        </Row>
        <Body muted style={{ fontSize: 13 }}>Signed in as {user.email}</Body>
      </Card>

      <Button title="Re-enable notifications" icon="notifications-outline" variant="secondary" onPress={() => registerForPushNotifications(uid)} />
      <Button title="Sign out" variant="secondary" onPress={signOut} />
      <Button title="Leave home" variant="danger" onPress={confirmLeave} />
    </Screen>
  );
}
