import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { auth } from './firebase';

/** Lightweight local replacement for react-firebase-hooks/auth. */
export function useAuthUser(): User | null {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  useEffect(() => auth.onAuthStateChanged(setUser), []);
  return user;
}
