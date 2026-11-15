import { useState } from 'react';
import { Alert } from 'react-native';
import { Body, Button, Field, Screen } from '../../components/ui';
import { friendlyAuthError } from '../../lib/errors';
import { useSession } from '../../lib/session';

export default function SignUp() {
  const { signUp } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return Alert.alert('What should we call you?');
    if (password.length < 6) return Alert.alert('Password too short', 'Use at least 6 characters.');
    setBusy(true);
    try {
      await signUp(name, email, password);
    } catch (e) {
      Alert.alert('Could not create account', friendlyAuthError(e));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Body muted>Each person in your home gets their own account. You can join or create a home next.</Body>
      <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="givenName" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <Button title="Create account" onPress={submit} loading={busy} />
    </Screen>
  );
}
