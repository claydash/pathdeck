// Firebase Auth (Google + email/password) and Firestore sync of the local-first state.
import { S, onChange, takeDirty, replaceState, mergeMeta, mergeSubject, blankSubject, defaultState } from './store.js';
import { firebaseConfig, authProviders } from './firebase-config.js';
export const authEnabled = authProviders.length > 0;
export const hasProvider = p => authProviders.includes(p);

const V = '11.6.0';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;
let fb = null, auth = null, db = null, A = null, F = null;
let user = null, ready = false, pushTimer = null, lastPull = 0, syncing = false;
export const status = { state: 'local', at: 0, error: null };   // local | syncing | synced | offline | error
const subs = new Set();
const emit = () => subs.forEach(fn => fn(user, status));
export const onAuth = fn => { subs.add(fn); return () => subs.delete(fn); };
export const currentUser = () => user;
export const isReady = () => ready;

export async function initCloud() {
  if (!firebaseConfig || !firebaseConfig.apiKey) { ready = true; emit(); return; }
  try {
    const [app, authMod, fsMod] = await Promise.all([import(`${CDN}/firebase-app.js`), import(`${CDN}/firebase-auth.js`), import(`${CDN}/firebase-firestore.js`)]);
    A = authMod; F = fsMod;
    fb = app.initializeApp(firebaseConfig);
    auth = A.getAuth(fb); auth.useDeviceLanguage();
    db = F.getFirestore(fb);
    await A.setPersistence(auth, A.browserLocalPersistence).catch(() => {});
    A.getRedirectResult(auth).catch(e => { status.error = friendly(e); emit(); });
    A.onAuthStateChanged(auth, async u => {
      user = u ? { uid: u.uid, name: u.displayName || (u.email || '').split('@')[0], email: u.email, photo: u.photoURL, provider: (u.providerData[0] || {}).providerId } : null;
      ready = true;
      if (user) { await pull(true); } else { status.state = 'local'; }
      emit();
    });
  } catch (e) {
    console.warn('Cloud unavailable', e); ready = true; status.state = 'offline'; status.error = 'Could not reach the sync service. Your progress is still saved on this device.'; emit();
  }
}

onChange(() => { if (user) schedulePush(); });
document.addEventListener('visibilitychange', () => {
  if (!user) return;
  if (document.visibilityState === 'hidden') flush();
  else if (Date.now() - lastPull > 60e3) pull(false);
});
window.addEventListener('online', () => { if (user) { pull(false); } });

function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(flush, 1500); }
export async function flush() {
  clearTimeout(pushTimer); if (!user || !db) return;
  const scopes = takeDirty(); if (!scopes.length) return;
  status.state = 'syncing'; emit();
  try {
    const writes = [];
    const meta = { xp: S.xp, cleared: S.cleared, log: S.log, badges: S.badges, settings: S.settings, settingsAt: S.settingsAt, subject: S.subject, created: S.created, onboarded: S.onboarded, updatedAt: Date.now(),
      profile: { name: user.name || '', email: user.email || '' } };
    if (scopes.includes('meta') || scopes.includes('all')) writes.push(F.setDoc(F.doc(db, 'users', user.uid), meta));
    const subjIds = scopes.includes('all') ? Object.keys(S.subjects) : scopes.filter(s => s !== 'meta' && S.subjects[s]);
    for (const sid of subjIds) writes.push(F.setDoc(F.doc(db, 'users', user.uid, 'subjects', sid), { ...S.subjects[sid], updatedAt: Date.now() }));
    await Promise.all(writes);
    status.state = 'synced'; status.at = Date.now(); status.error = null;
  } catch (e) {
    scopes.forEach(s => takeDirtyRestore(s));
    status.state = navigator.onLine ? 'error' : 'offline'; status.error = friendly(e);
  }
  emit();
}
const pendingRestore = new Set();
function takeDirtyRestore(s) { pendingRestore.add(s); setTimeout(() => { if (pendingRestore.size) { import('./store.js').then(m => { pendingRestore.forEach(x => m.save(x === 'meta' ? undefined : x)); pendingRestore.clear(); }); } }, 15000); }

/** Pull cloud copy and merge with local item-by-item (newest wins). */
export async function pull(first) {
  if (!user || !db || syncing) return; syncing = true; lastPull = Date.now();
  status.state = 'syncing'; emit();
  try {
    const metaSnap = await F.getDoc(F.doc(db, 'users', user.uid));
    const subSnap = await F.getDocs(F.collection(db, 'users', user.uid, 'subjects'));
    const remote = metaSnap.exists() ? metaSnap.data() : null;
    // Local data that belongs to a different account never gets merged into this one.
    const local = S.owner && S.owner !== user.uid ? { ...defaultState(), onboarded: true } : S;
    const isFreshGuest = !local.updatedAt;
    const merged = { ...local, ...(remote ? mergeMeta(local, remote) : {}) };
    merged.subjects = { ...local.subjects };
    subSnap.forEach(d => { merged.subjects[d.id] = mergeSubject(local.subjects[d.id] || blankSubject(), d.data()); });
    if (remote && isFreshGuest) merged.onboarded = true;
    merged.owner = user.uid;
    replaceState(merged, false);
    status.state = 'synced'; status.at = Date.now(); status.error = null;
    // push merged result back so both sides match
    import('./store.js').then(m => { m.save(); Object.keys(merged.subjects).forEach(sid => m.save(sid)); });
  } catch (e) { status.state = navigator.onLine ? 'error' : 'offline'; status.error = friendly(e); }
  syncing = false; emit();
}

// ---------------------------------------------------------------- auth actions
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
export async function signInGoogle() {
  const p = new A.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
  try { await A.signInWithPopup(auth, p); }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code) || isMobile()) {
      if (e.code === 'auth/popup-closed-by-user') throw new Error(friendly(e));
      await A.signInWithRedirect(auth, p); return;
    }
    throw new Error(friendly(e));
  }
}
export async function signInEmail(email, password) { try { await A.signInWithEmailAndPassword(auth, email.trim(), password); } catch (e) { throw new Error(friendly(e)); } }
export async function signUpEmail(name, email, password) {
  try { const cred = await A.createUserWithEmailAndPassword(auth, email.trim(), password); if (name) await A.updateProfile(cred.user, { displayName: name.trim() }); user = { ...user, name: name || user?.name }; emit(); }
  catch (e) { throw new Error(friendly(e)); }
}
export async function resetPassword(email) { try { await A.sendPasswordResetEmail(auth, email.trim()); } catch (e) { throw new Error(friendly(e)); } }
export async function signOutUser() {
  await flush().catch(() => {});
  await A.signOut(auth);
  // Progress is safe in the cloud; clear this device so the next person starts fresh.
  replaceState({ ...defaultState(), onboarded: true });
}

function friendly(e) {
  const c = (e && e.code) || '';
  const m = {
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/missing-password': 'Enter your password.',
    'auth/weak-password': 'Use at least 6 characters for your password.',
    'auth/email-already-in-use': 'An account with this email already exists — sign in instead.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'No account with that email — create one instead.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
    'auth/popup-closed-by-user': 'The Google window was closed before signing in.',
    'auth/network-request-failed': 'No internet connection. Your progress is saved on this device.',
    'auth/unauthorized-domain': 'This website isn’t allowed to sign in yet (domain not authorised in Firebase).',
    'auth/operation-not-allowed': 'This sign-in method isn’t switched on yet.',
    'permission-denied': 'Sync was refused by the server.',
    'unavailable': 'Sync service is offline. Your progress is saved on this device.'
  };
  return m[c] || (e && e.message ? e.message.replace(/^Firebase: /, '').replace(/ \(.*\)\.?$/, '') : 'Something went wrong.');
}
