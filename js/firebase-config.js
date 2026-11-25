// Firebase web config (public by design — access is controlled by Firestore security rules).
export const firebaseConfig = {
  apiKey: 'AIzaSyCnLHLPLJ465tqaFNYbJm-gidyfiMuMxN4',
  authDomain: 'pathdeck-mbbs.firebaseapp.com',
  projectId: 'pathdeck-mbbs',
  storageBucket: 'pathdeck-mbbs.firebasestorage.app',
  messagingSenderId: '675826787299',
  appId: '1:675826787299:web:d93fe4ce916ccd6698f6d6'
};

// Sign-in methods switched on in Firebase Console → Authentication → Sign-in method.
// The app only shows buttons for methods listed here. Add 'google' and 'password' once enabled.
export const authProviders = [];
