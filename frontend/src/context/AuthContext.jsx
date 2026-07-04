import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as authService from "../api/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      if (!authService.hasStoredSession()) {
        setIsBootstrapping(false);
        return;
      }

      try {
        const currentUser = await authService.getCurrentUser();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch {
        authService.logout();
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function login(username, password, rememberMe) {
    const loggedInUser = await authService.login(username, password, rememberMe);
    setUser(loggedInUser);
    return loggedInUser;
  }

  function logout() {
    authService.logout();
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      login,
      logout,
    }),
    [user, isBootstrapping]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}