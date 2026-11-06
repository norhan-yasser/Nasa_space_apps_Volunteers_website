/**
 * Firebase web-app config for the TechOps portal.
 *
 * 1. Firebase console -> Project settings -> "Your apps" -> Web app -> copy the config object below.
 * 2. Authentication -> Sign-in method -> enable "Anonymous" (volunteers sign in with their Volunteer Code;
 *    the code is verified against the `volunteers` collection, see firebase/firestore.rules).
 * 3. Firestore Database -> create database, then publish firebase/firestore.rules.
 * 4. Upload the data once:  python tools/seed_firebase.py --key path/to/serviceAccount.json
 *
 * These web keys are NOT secrets (security is enforced by the Firestore rules), so it is fine to commit them.
 * While `apiKey` / `projectId` are empty the portal runs in LOCAL PREVIEW mode with bundled dummy data
 * (js/seed-data.js) so the UI can still be tried without a Firebase project.
 */
window.TECHOPS_FIREBASE = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
