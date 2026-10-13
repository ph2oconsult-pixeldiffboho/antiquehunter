import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import { installApiAuthFetch } from './apiAuth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// @ts-ignore
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth();

// Firebase App Check: only initialised when a site key is configured at build time
// (VITE_APPCHECK_SITE_KEY, plus VITE_APPCHECK_PROVIDER=enterprise for reCAPTCHA Enterprise; default reCAPTCHA v3).
let appCheck: AppCheck | null = null;
const appCheckKey = (import.meta as any).env?.VITE_APPCHECK_SITE_KEY as string | undefined;
if (appCheckKey && typeof window !== 'undefined') {
  try {
    const enterprise = String((import.meta as any).env?.VITE_APPCHECK_PROVIDER || '').toLowerCase() === 'enterprise';
    appCheck = initializeAppCheck(app, {
      provider: enterprise ? new ReCaptchaEnterpriseProvider(appCheckKey) : new ReCaptchaV3Provider(appCheckKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.warn('App Check init failed', e);
  }
}
export const getAppCheckInstance = () => appCheck;

// Attach the sign-in token and App Check token to our own /api/* calls.
installApiAuthFetch(auth, getAppCheckInstance);

// Validate connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client appears to be offline.");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
