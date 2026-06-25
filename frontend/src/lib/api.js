let API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
if (API_BASE && !API_BASE.endsWith('/api')) {
  API_BASE += '/api';
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Attach JWT token if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP error ${res.status}`);
  }

  return res.json();
}

export const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  // localhost環境など古い /uploads の画像をサポートするため
  const base = API_BASE.replace('/api', '');
  return `${base}${path}`;
};

// Auth
export const login = (email, password) =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const registerPlayer = (name, email, password) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });

export const getMe = () => request('/auth/me');

// Users / Players
export const getPlayers = (position) => {
  const params = position ? `?position=${position}` : '';
  return request(`/users${params}`);
};

export const getPlayer = (id) => request(`/users/${id}`);

export const createPlayer = (data) =>
  request('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updatePlayer = (id, data) =>
  request(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deletePlayer = (id) =>
  request(`/users/${id}`, { method: 'DELETE' });

// Matches
export const getMatches = () => request('/matches');

export const getMatch = (id) => request(`/matches/${id}`);

export const createMatch = (data) =>
  request('/matches', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateMatch = (id, data) =>
  request(`/matches/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteMatch = (id) =>
  request(`/matches/${id}`, { method: 'DELETE' });

// Rankings
export const getGoalRanking = () => request('/rankings/goals');
export const getAssistRanking = () => request('/rankings/assists');
export const getAttendanceRanking = () => request('/rankings/attendance');
export const getStaminaRanking = () => request('/rankings/stamina');

// Events
export const getEvents = () => request('/events');
export const getEvent = (id) => request(`/events/${id}`);

export const createEvent = (data) =>
  request('/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateEvent = (id, data) =>
  request(`/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteEvent = (id) =>
  request(`/events/${id}`, { method: 'DELETE' });

// Attendances
export const getEventAttendances = (eventId) =>
  request(`/attendances/event/${eventId}`);

export const updateAttendance = (data) =>
  request('/attendances', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const getPendingAttendances = () => request('/attendances/pending');

// News
export const getNewsList = (params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set('category', params.category);
  if (params.limit) searchParams.set('limit', params.limit);
  const qs = searchParams.toString();
  return request(`/news${qs ? `?${qs}` : ''}`);
};

export const getNewsItem = (id) => request(`/news/${id}`);

export const createNews = (data) =>
  request('/news', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateNews = (id, data) =>
  request(`/news/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteNews = (id) =>
  request(`/news/${id}`, { method: 'DELETE' });

// Fumindor (Annual MVP)
export const getFumindor = () => request('/fumindor');

export const createFumindor = (data) =>
  request('/fumindor', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteFumindor = (id) =>
  request(`/fumindor/${id}`, { method: 'DELETE' });

// Site Settings
export const getSettings = () => request('/settings');

export const updateSetting = (key, value) =>
  request('/settings', {
    method: 'PUT',
    body: JSON.stringify({ key, value }),
  });

// Upload
export const uploadFile = async (file) => {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('photo', file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'アップロードに失敗しました');
  }
  return res.json();
};
