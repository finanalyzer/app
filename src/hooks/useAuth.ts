import { useState, useEffect, useCallback } from "react";

export interface UserProfile {
  username: string;
  email: string;
  createdAt: string;
  lastLogin: string;
  isDeviceLockEnabled: boolean;
  vaultFilePath: string;
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  logout: () => void;
}

const USER_KEY = "passxyz-user";
const TOKEN_KEY = "passxyz-token";

function readUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.username === "string" && typeof parsed.email === "string") {
      return parsed as UserProfile;
    }
    return null;
  } catch {
    return null;
  }
}

function readToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<UserProfile | null>(readUser);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === USER_KEY) {
        setUser(readUser());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const isAuthenticated = !!user && !!readToken();

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    window.location.href = `${window.location.origin}/vault/#/login`;
  }, []);

  return { user, isAuthenticated, logout };
}
