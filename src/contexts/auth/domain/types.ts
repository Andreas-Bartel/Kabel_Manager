export interface UserSession {
  userId: string;
  isAnonymous: boolean;
  email?: string;
  createdAt: string;
}

export interface IAuthService {
  getCurrentSession(): Promise<UserSession | null>;
  loginAnonymously(): Promise<UserSession>;
  logout(): Promise<void>;
}
