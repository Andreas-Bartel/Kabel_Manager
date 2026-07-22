import { IAuthService, UserSession } from '../domain/types';

const AUTH_KEY = 'cable_guy_session';

export class LocalStorageAuthService implements IAuthService {
  async getCurrentSession(): Promise<UserSession | null> {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async loginAnonymously(): Promise<UserSession> {
    const existing = await this.getCurrentSession();
    if (existing) return existing;

    const newSession: UserSession = {
      userId: crypto.randomUUID(),
      isAnonymous: true,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(AUTH_KEY, JSON.stringify(newSession));
    return newSession;
  }

  async logout(): Promise<void> {
    localStorage.removeItem(AUTH_KEY);
  }
}
