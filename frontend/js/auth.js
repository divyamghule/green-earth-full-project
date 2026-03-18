(function () {
  const path = window.location.pathname.toLowerCase();
  const isLogin = path.endsWith("/login.html") || path.endsWith("login.html");
  const isRegister = path.endsWith("/register.html") || path.endsWith("register.html");

  if (isLogin || isRegister) {
    window.GreenEarnUtils.redirectIfAuthenticated("./dashboard.html");
  }

  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      try {
        window.GreenEarnUtils.showMessage("message", "Logging in...", "");
        const data = await window.GreenEarnAPI.apiRequest("/auth/login", {
          method: "POST",
          auth: false,
          data: { email, password },
        });

        window.GreenEarnAPI.setToken(data.token);
        window.GreenEarnAPI.setUser(data.user);
        window.GreenEarnUtils.showMessage("message", "Login successful. Redirecting...", "success");

        setTimeout(() => {
          window.location.href = "./dashboard.html";
        }, 500);
      } catch (error) {
        window.GreenEarnUtils.showMessage("message", error.message, "error");
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      try {
        window.GreenEarnUtils.showMessage("message", "Creating account...", "");
        const data = await window.GreenEarnAPI.apiRequest("/auth/register", {
          method: "POST",
          auth: false,
          data: { name, email, password },
        });

        window.GreenEarnAPI.setToken(data.token);
        window.GreenEarnAPI.setUser(data.user);
        window.GreenEarnUtils.showMessage("message", "Account ready. Redirecting...", "success");

        setTimeout(() => {
          window.location.href = "./dashboard.html";
        }, 650);
      } catch (error) {
        window.GreenEarnUtils.showMessage("message", error.message, "error");
      }
    });
  }
})();
