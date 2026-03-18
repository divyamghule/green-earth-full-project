(function () {
  function showMessage(targetOrId, text, type) {
    const element = typeof targetOrId === "string" ? document.getElementById(targetOrId) : targetOrId;
    if (!element) return;
    element.textContent = text || "";
    element.className = "message";
    if (type) {
      element.classList.add(type);
    }
  }

  function requireAuth(redirectTo) {
    const token = window.GreenEarnAPI.getToken();
    if (!token) {
      window.location.href = redirectTo || "./login.html";
      return false;
    }
    return true;
  }

  function redirectIfAuthenticated(path) {
    const token = window.GreenEarnAPI.getToken();
    if (token) {
      window.location.href = path || "./dashboard.html";
    }
  }

  function logout() {
    window.GreenEarnAPI.clearToken();
    window.location.href = "./login.html";
  }

  function formatDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString();
  }

  function titleCase(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  window.GreenEarnUtils = {
    showMessage,
    requireAuth,
    redirectIfAuthenticated,
    logout,
    formatDate,
    titleCase,
  };
})();
