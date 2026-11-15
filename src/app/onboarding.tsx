import { useState } from 'react';
import { Alert } from 'react-native';
import { Body, Button, Card, Field, Screen, SectionTitle } from '../components/ui';
import { friendlyAuthError } from '../lib/errors';
import { useSession } from '../lib/session';

export default function Onboarding() {
  const { profile, createHome, joinHome, signOut } = useSession();
  const [homeName, setHomeName] = useState('Chazel Home');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  const run = async (kind: 'create' | 'join', fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      Alert.alert(kind === 'create' ? 'Could not create home' : 'Could not join home', friendlyAuthError(e));
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Body>Hi {profile?.displayName ?? 'there'}! Start a new home, or join the one your partner already made.</Body>

      <SectionTitle>Start a new home</SectionTitle>
      <Card>
        <Field label="Home name" value={homeName} onChangeText={setHomeName} />
        <Button title="Create home" icon="add-circle-outline" loading={busy === 'create'} onPress={() => run('create', () => createHome(homeName))} />
      </Card>

      <SectionTitle>Join an existing home</SectionTitle>
      <Card>
        <Body muted>Ask your partner for the 6-character invite code from Settings in their app.</Body>
        <Field
          label="Invite code"
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          placeholder="ABC123"
          style={{ letterSpacing: 4, fontSize: 20, fontWeight: '600' }}
        />
        <Button
          title="Join home"
          icon="people-outline"
          variant="secondary"
          disabled={code.trim().length !== 6}
          loading={busy === 'join'}
          onPress={() => run('join', () => joinHome(code))}
        />
      </Card>

      <Button title="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
