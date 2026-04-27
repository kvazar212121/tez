import devPort from '../../dev-port.json';

/**
 * Loyiha standart backend porti — `dev-port.json` (yagona manba).
 * `VITE_API_URL` faqat sahifa localhost/127.0.0.1 da ochilganda qo‘llanadi.
 * Telefondan http://192.168…:5173 ochilsa, `VITE_API_URL=http://localhost:5001` e’tiborsiz qoldiriladi —
 * aks holda telefon o‘ziga `localhost` deb ulanadi va backend topilmaydi.
 */
export const DEFAULT_API_PORT = devPort.DEFAULT_PORT;

function apiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  const port = DEFAULT_API_PORT;

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location;
    const isLocalPage = hostname === 'localhost' || hostname === '127.0.0.1';
    if (!isLocalPage) {
      // Production: Nginx /api va /socket.io yo'llarini proxy qiladi
      // Port kerak emas — HTTPS (443) orqali o'tadi
      return `${protocol}//${hostname}`;
    }
  }

  if (envUrl && String(envUrl).trim()) {
    return String(envUrl).trim();
  }

  if (typeof window === 'undefined' || !window.location?.hostname) {
    return `http://localhost:${port}`;
  }
  return `http://localhost:${port}`;
}

/** REST + Socket.io */
export const API_BASE_URL = apiBaseUrl();
