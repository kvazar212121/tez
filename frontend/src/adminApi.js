import { API_BASE_URL } from './config';

const TOKEN_KEY = 'taxi_free_admin_token';

export function getAdminToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function adminApi(path, options = {}) {
  const headers = { ...options.headers };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const t = getAdminToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}
