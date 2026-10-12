import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as authService from "../api/authService";
import { SESSION_ENDED_EVENT } from "../api/axiosClient";
import { SESSION_SYNC_KEY } from "../api/tokenStorage";
import { startBrowserSessionLifecycle } from "../api/browserSessionLifecycle";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => startBrowserSessionLifecycle(), []);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      try {
        const deviceSession = await authService.getDeviceSession();

        if (!deviceSession.active) {
          authService.discardLocalSession();
          return;
        }

        if (!authService.hasStoredSession()) {
          await authService.logout();
          return;
        }

        await authService.resumeDeviceSession();

        const currentUser = await authService.getCurrentUser();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch {
        authService.discardLocalSession();
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

  useEffect(() => {
    function handleSessionEnded() {
      setUser(null);
    }

    window.addEventListener(SESSION_ENDED_EVENT, handleSessionEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, handleSessionEnded);
  }, []);

  useEffect(() => {
    async function handleStorage(event) {
      if (event.key !== SESSION_SYNC_KEY || !event.newValue) return;

      try {
        const { active } = JSON.parse(event.newValue);
        if (!active) {
          setUser(null);
          return;
        }

        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch {
        setUser(null);
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  async function login(email, password) {
    const loggedInUser = await authService.login(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  }

  function logout() {
    setUser(null);
    void authService.logout();
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
