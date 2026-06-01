import { ENDPOINTS } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const login = async (email, password) => {
  const formData = new URLSearchParams();
  formData.append('username', email.trim());
  formData.append('password', password);

  const response = await fetch(`${API_URL}/api/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Error al iniciar sesión');
  }

  return data;
};

export const loginWithGoogle = () => {
  window.location.href = `${API_URL}/api/login/google/login`;
};

export const loginWithGoogleCalendar = async () => {
  const res = await fetch(`${API_URL}/api/emails/google/calendar/login`, {
    credentials: 'include',
  });
  const data = await res.json();
  window.location.href = data.url;
};

export const logout = async () => {
  try {
    await fetch(ENDPOINTS.auth.logout, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // El backend puede no estar disponible; limpiamos estado local de todas formas
  }
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
  window.location.href = '/login';
};

export const decodeToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

export const isTokenValidFromToken = (token) => {
  if (!token) return false;
  try {
    const decoded = decodeToken(token);
    if (!decoded) return false;
    if (!decoded.exp) return true;
    return decoded.exp > Math.floor(Date.now() / 1000) - 60;
  } catch {
    return false;
  }
};

export const getCurrentUserFromToken = (token) => {
  if (!token) return null;
  const decoded = decodeToken(token);
  if (!decoded) return null;
  return { email: decoded.sub, role: decoded.role, id: decoded.id };
};
