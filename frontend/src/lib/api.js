const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const getToken = () => localStorage.getItem('ct_token');

const parseResponse = async (res) => {
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return res.json();
  }

  const text = await res.text();
  return text ? { error: text } : null;
};

const req = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await parseResponse(res);

  if (!res.ok) {
    throw payload || { error: 'Errore di rete' };
  }

  return payload;
};

export const api = {
  // auth
  register: (data) => req('POST', '/auth/register', data),
  login:    (data) => req('POST', '/auth/login', data),
  adminUsers: () => req('GET', '/admin/users'),
  createUser: (data) => req('POST', '/admin/users', data),
  updateUser: (id, data) => req('PATCH', `/admin/users/${id}`, data),
  deleteUser: (id) => req('DELETE', `/admin/users/${id}`),
  exportData: () => req('GET', '/admin/export'),

  // decks
  getDecks:    ()     => req('GET',    '/decks'),
  getMyDecks:  ()     => req('GET',    '/decks/mine'),
  getDeck:     (id)   => req('GET',    `/decks/${id}`),
  createDeck:  (data) => req('POST',   '/decks', data),
  updateDeck:  (id, data) => req('PATCH', `/decks/${id}`, data),
  deleteDeck:  (id)   => req('DELETE', `/decks/${id}`),
  importDeck:  (url)  => req('POST',   '/decks/import', { url }),

  // games
  getGames:   ()     => req('GET',    '/games'),
  createGame: (data) => req('POST',   '/games', data),
  updateGame: (id, data) => req('PATCH', `/games/${id}`, data),
  deleteGame: (id)   => req('DELETE', `/games/${id}`),

  // commenti & reazioni
  getComments:    (gameId)            => req('GET',    `/games/${gameId}/comments`),
  addComment:     (gameId, body)      => req('POST',   `/games/${gameId}/comments`, { body }),
  deleteComment:  (gameId, commentId) => req('DELETE', `/games/${gameId}/comments/${commentId}`),
  toggleReaction: (gameId, emoji)     => req('POST',   `/games/${gameId}/reactions`, { emoji }),

  // stats
  statsPlayers:  () => req('GET', '/stats/players'),
  statsDecks:    () => req('GET', '/stats/decks'),
  statsMatchups: () => req('GET', '/stats/matchups'),
};
