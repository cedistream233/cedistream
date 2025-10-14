// Environment configuration
const getBackendUrl = () => {
  // In production (built app), use the VITE_BACKEND_URL or fallback
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_BACKEND_URL || 'https://cedistream.onrender.com';
  }
  
  // In development, use local backend
  return import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
};

export const config = {
  backendUrl: getBackendUrl(),
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

// API helper function
export const apiRequest = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${config.backendUrl}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};