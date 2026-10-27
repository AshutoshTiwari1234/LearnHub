const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://learnhub-backend-ufkr.onrender.com').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError('Could not reach LearnHub. Check that the backend is running.', 0);
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const message = payload?.errors?.join('. ') || payload?.message || 'Something went wrong. Please try again.';
    throw new ApiError(message, response.status, payload);
  }
  return payload;
}

export function apiGet(path, token) {
  return apiRequest(path, { token });
}

export function apiPost(path, body, token) {
  return apiRequest(path, { method: 'POST', body: JSON.stringify(body), token });
}

export function apiPut(path, body, token) {
  return apiRequest(path, { method: 'PUT', body: JSON.stringify(body), token });
}

export function apiPatch(path, body, token) {
  return apiRequest(path, { method: 'PATCH', body: JSON.stringify(body), token });
}

export function apiDelete(path, token) {
  return apiRequest(path, { method: 'DELETE', token });
}
