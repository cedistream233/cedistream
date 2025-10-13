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
      if (e.key === 'demo_user' || e.key === 'user') {
        try {
          const v = localStorage.getItem('user') || localStorage.getItem('demo_user');
          setUser(v ? JSON.parse(v) : null);
        } catch { }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = (userData, authToken) => {
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
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // convenience helper used by demo flows to update demo_user cart/state
  const updateMyUserData = async (patch) => {
    try {
      const u = JSON.parse(localStorage.getItem('demo_user') || 'null') || {};
      const updated = { ...u, ...patch };
      localStorage.setItem('demo_user', JSON.stringify(updated));
      // also mirror to 'user' so AuthProvider and UI react
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
      return updated;
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