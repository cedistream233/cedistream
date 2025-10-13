import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth data on app load
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
    // also mirror demo_user changes (used by demo flows)
    const onStorage = (e) => {
      try {
        // If authenticated, ignore demo_user mutations to prevent stale overwrites
        const hasToken = !!(localStorage.getItem('token'));
        if (e.key === 'user') {
          const v = localStorage.getItem('user');
          setUser(v ? JSON.parse(v) : null);
        } else if (e.key === 'demo_user' && !hasToken) {
          // Only mirror demo_user when not authenticated
          const dv = localStorage.getItem('demo_user');
          setUser(dv ? JSON.parse(dv) : null);
        }
      } catch { }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = (userData, authToken) => {
    // On real login/signup, clear any demo_user to avoid stale state bleeding back in
    try { localStorage.removeItem('demo_user'); } catch {}
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Also clear demo_user so anonymous cart/state doesn't resurrect old identity
    try { localStorage.removeItem('demo_user'); } catch {}
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // convenience helper used by demo flows to update demo_user cart/state
  const updateMyUserData = async (patch) => {
    try {
      const hasToken = !!(token || localStorage.getItem('token'));
      if (hasToken) {
        // Authenticated: update the real 'user' object only
        const base = JSON.parse(localStorage.getItem('user') || 'null') || {};
        const updated = { ...base, ...patch };
        localStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
        return updated;
      } else {
        // Anonymous/demo flow: update demo_user and mirror to user for UI
        const u = JSON.parse(localStorage.getItem('demo_user') || 'null') || {};
        const updated = { ...u, ...patch };
        localStorage.setItem('demo_user', JSON.stringify(updated));
        localStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
        return updated;
      }
    } catch (e) { console.error(e); return null; }
  };

  const isAuthenticated = !!token && !!user;
  const isCreator = user?.role === 'creator';
  const isSupporter = user?.role === 'supporter';
  const isAdmin = user?.role === 'admin';

  const value = {
    user,
    token,
    login,
    logout,
    updateUser,
    updateMyUserData,
    isAuthenticated,
    isCreator,
    isAdmin,
    isSupporter,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};