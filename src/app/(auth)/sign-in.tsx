import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { space, useTheme } from '../../components/theme';
import { Body, Button, Field, Ionicons, Screen } from '../../components/ui';
import { friendlyAuthError } from '../../lib/errors';
import { useSession } from '../../lib/session';

export default function SignIn() {
  const t = useTheme();
  const { signIn, resetPassword } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password) return Alert.alert('Enter your email and password.');
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e) {
      Alert.alert('Could not sign in', friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email) return Alert.alert('Enter your email first', 'We will send a reset link to it.');
    try {
      await resetPassword(email);
      Alert.alert('Check your email', 'A password reset link is on its way.');
    } catch (e) {
      Alert.alert('Could not send reset email', friendlyAuthError(e));
    }
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.sm, marginTop: 80, marginBottom: space.xl }}>
        <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="home" size={36} color={t.primaryText} />
        </View>
        <Text style={{ fontSize: 32, fontWeight: '800', color: t.text }}>Chazel Home</Text>
        <Body muted>Your household, together.</Body>
      </View>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
      <Button title="Sign in" onPress={submit} loading={busy} />
      <Button title="Forgot password?" variant="ghost" onPress={forgot} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.lg }}>
        <Body muted>New here?</Body>
        <Link href="/sign-up" style={{ color: t.primary, fontWeight: '600', fontSize: 16 }}>
          Create an account
        </Link>
      </View>
    </Screen>
  );
}
