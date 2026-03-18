(function () {
  const API_BASE = window.location.origin.startsWith("http")
    ? `${window.location.origin}/api`
    : "http://localhost:5000/api";

  const TOKEN_KEY = "greenearn_token";
  const USER_KEY = "greenearn_user";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function getUser() {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  }

  async function apiRequest(path, options) {
    const config = options || {};
    const method = config.method || "GET";
    const auth = config.auth !== false;
    const headers = {
      "Content-Type": "application/json",
      ...(config.headers || {}),
    };

    if (auth) {
      const token = getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: config.data ? JSON.stringify(config.data) : undefined,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (_error) {
      payload = null;
    }

    if (!response.ok) {
      const message = payload?.message || `Request failed (${response.status})`;
      throw new Error(message);
    }

    return payload;
  }

  window.GreenEarnAPI = {
    apiRequest,
    getToken,
    setToken,
    clearToken,
    setUser,
    getUser,
  };
})();
