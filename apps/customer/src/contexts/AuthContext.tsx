import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  login as apiLogin,
  refresh as apiRefresh,
  logout as apiLogout,
  type User,
  type TokenResponse,
  type Workspace,
  type InternalAdmin,
} from "../api/client";

export type { Workspace, InternalAdmin };

export interface AuthState {
  authenticated: boolean;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  bootstrapped: boolean;
}

interface AuthContextType {
  auth: AuthState;
  login: (email: string, password: string) => Promise<TokenResponse>;
  refresh: () => Promise<AuthState | undefined>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_SNAPSHOT_KEY = "auth_snapshot_v1";
const AUTH_SNAPSHOT_MAX_AGE_MS = 15 * 60 * 1000;

const computeIsAdmin = (user: User | null) => {
  if (!user) return false;
  const role = (user.role || "").toLowerCase();
  return Boolean(
    user.is_admin ||
      user.isStaff ||
      user.is_staff ||
      user.isSuperuser ||
      user.is_superuser ||
      role === "admin" ||
      role === "superadmin" ||
      user.internalAdmin?.adminPanelAccess ||
      user.internalAdmin?.canAccessInternalAdmin
  );
};

type AuthSnapshot = {
  savedAt: number;
  user: User;
};

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  const storage = window.localStorage as Storage;
  if (typeof storage.getItem !== "function") return null;
  if (typeof storage.setItem !== "function") return null;
  if (typeof storage.removeItem !== "function") return null;
  return storage;
}

function snapshotUser(user: User): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role ?? null,
    is_admin: user.is_admin,
    isStaff: user.isStaff,
    isSuperuser: user.isSuperuser,
    is_staff: user.is_staff,
    is_superuser: user.is_superuser,
    internalAdmin: user.internalAdmin ?? null,
  };
}

function readSnapshot(): User | null {
  const storage = getStorage();
  const raw = storage?.getItem(AUTH_SNAPSHOT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthSnapshot;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.savedAt !== "number" ||
      !parsed.user ||
      typeof parsed.user.email !== "string"
    ) {
      storage?.removeItem(AUTH_SNAPSHOT_KEY);
      return null;
    }

    if (Date.now() - parsed.savedAt > AUTH_SNAPSHOT_MAX_AGE_MS) {
      storage?.removeItem(AUTH_SNAPSHOT_KEY);
      return null;
    }

    return parsed.user;
  } catch {
    storage?.removeItem(AUTH_SNAPSHOT_KEY);
    return null;
  }
}

function writeSnapshot(user: User | null) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (!user) {
    storage.removeItem(AUTH_SNAPSHOT_KEY);
    return;
  }

  storage.setItem(
    AUTH_SNAPSHOT_KEY,
    JSON.stringify({
      savedAt: Date.now(),
      user: snapshotUser(user),
    } satisfies AuthSnapshot),
  );
}

const toAuthState = (user: User | null, options?: { loading?: boolean; bootstrapped?: boolean }): AuthState => ({
  authenticated: Boolean(user),
  user,
  loading: options?.loading ?? false,
  isAdmin: computeIsAdmin(user),
  bootstrapped: options?.bootstrapped ?? true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>(() => {
    const cachedUser = readSnapshot();
    if (cachedUser) {
      return toAuthState(cachedUser, { loading: false, bootstrapped: false });
    }
    return toAuthState(null, { loading: true, bootstrapped: false });
  });

  const refresh = async () => {
    try {
      const data: TokenResponse = await apiRefresh();
      writeSnapshot(data.user);
      const nextAuth = toAuthState(data.user, { loading: false, bootstrapped: true });
      setAuth(nextAuth);
      return nextAuth;
    } catch {
      writeSnapshot(null);
      setAuth(toAuthState(null, { loading: false, bootstrapped: true }));
      return undefined;
    }
  };

  const login = async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    writeSnapshot(data.user);
    setAuth(toAuthState(data.user, { loading: false, bootstrapped: true }));
    return data;
  };

  const logout = async () => {
    try {
      await apiLogout();
    } finally {
      writeSnapshot(null);
      setAuth(toAuthState(null, { loading: false, bootstrapped: true }));
      if (typeof window !== "undefined" && window.location?.assign) {
        window.location.assign("/login");
      }
    }
  };

  const hydrate = useMemo(() => refresh, []);

  useEffect(() => {
    hydrate().catch(() => undefined);
  }, [hydrate]);

  return (
    <AuthContext.Provider value={{ auth, login, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
