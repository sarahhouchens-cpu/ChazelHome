import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch, addDoc } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'chazel-test',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8085 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const u of ['alice', 'bob', 'carol']) await setDoc(doc(ctx.firestore(), 'users', u), { displayName: u, homeId: null });
  });
});
after(() => env.cleanup());

const as = (u) => env.authenticatedContext(u).firestore();

test('alice creates a home in one batch', async () => {
  const db = as('alice');
  const b = writeBatch(db);
  b.set(doc(db, 'homes', 'h1'), { name: 'Chazel', ownerId: 'alice', memberIds: ['alice'], inviteCode: 'ABC234' });
  b.set(doc(db, 'invites', 'ABC234'), { homeId: 'h1' });
  b.update(doc(db, 'users', 'alice'), { homeId: 'h1' });
  await assertSucceeds(b.commit());
  await assertSucceeds(addDoc(collection(db, 'homes/h1/events'), { title: 'Dinner' }));
});

test('cannot create a home owned by someone else', async () => {
  const db = as('carol');
  await assertFails(setDoc(doc(db, 'homes', 'hx'), { name: 'x', ownerId: 'alice', memberIds: ['carol'], inviteCode: 'ZZZ222' }));
});

test('outsiders cannot see the home or its data, or list invites', async () => {
  const db = as('bob');
  await assertFails(getDoc(doc(db, 'homes', 'h1')));
  await assertFails(getDocs(collection(db, 'homes/h1/events')));
  await assertFails(getDoc(doc(db, 'users', 'alice')));
  await assertFails(getDocs(collection(db, 'invites')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'invites', 'ABC234')));
});

test('joining with the wrong code fails', async () => {
  const db = as('bob');
  await assertFails(updateDoc(doc(db, 'homes', 'h1'), { memberIds: arrayUnion('bob'), joinCode: 'WRONG1' }));
});

test('cannot add someone else while joining', async () => {
  const db = as('carol');
  await assertFails(updateDoc(doc(db, 'homes', 'h1'), { memberIds: arrayUnion('carol', 'bob'), joinCode: 'ABC234' }));
});

test('bob joins with the invite code', async () => {
  const db = as('bob');
  const invite = await assertSucceeds(getDoc(doc(db, 'invites', 'ABC234')));
  const homeId = invite.data().homeId;
  const b = writeBatch(db);
  b.update(doc(db, 'homes', homeId), { memberIds: arrayUnion('bob'), joinCode: 'ABC234' });
  b.update(doc(db, 'users', 'bob'), { homeId });
  await assertSucceeds(b.commit());
  await assertSucceeds(getDocs(collection(db, 'homes/h1/events')));
  await assertSucceeds(addDoc(collection(db, 'homes/h1/todos'), { title: 'Trash', assigneeId: 'alice' }));
  await assertSucceeds(getDoc(doc(db, 'users', 'alice')));
  await assertSucceeds(getDoc(doc(as('alice'), 'users', 'bob')));
});

test('members can rename but not take ownership, swap code, or remove others', async () => {
  const db = as('bob');
  await assertSucceeds(updateDoc(doc(db, 'homes', 'h1'), { name: 'Our place' }));
  await assertFails(updateDoc(doc(db, 'homes', 'h1'), { ownerId: 'bob' }));
  await assertFails(updateDoc(doc(db, 'homes', 'h1'), { inviteCode: 'NEW234' }));
  await assertFails(updateDoc(doc(db, 'homes', 'h1'), { memberIds: arrayRemove('alice') }));
  await assertFails(setDoc(doc(db, 'homes/h1/secrets/x'), { a: 1 }));
});

test('bob leaves and loses access', async () => {
  const db = as('bob');
  const b = writeBatch(db);
  b.update(doc(db, 'homes', 'h1'), { memberIds: arrayRemove('bob') });
  b.update(doc(db, 'users', 'bob'), { homeId: null });
  await assertSucceeds(b.commit());
  await assertFails(getDocs(collection(db, 'homes/h1/events')));
});
