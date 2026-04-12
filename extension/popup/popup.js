const API_BASE = "https://hiretrail.manavkaneria.me/api";
const HIRETRAIL_DOMAIN = "hiretrail.manavkaneria.me";

const loadingView = document.getElementById("loading-view");
const loginView = document.getElementById("login-view");
const loggedInView = document.getElementById("logged-in-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const googleBtn = document.getElementById("google-btn");
const googleError = document.getElementById("google-error");
const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");
const userEmail = document.getElementById("user-email");
const openAppLink = document.getElementById("open-app");
const logoutBtn = document.getElementById("logout-btn");

function initials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function showLoading() {
  loadingView.style.display = "block";
  loginView.style.display = "none";
  loggedInView.style.display = "none";
}

function showLogin() {
  loadingView.style.display = "none";
  loginView.style.display = "block";
  loggedInView.style.display = "none";
}

function showLoggedIn(user) {
  loadingView.style.display = "none";
  loginView.style.display = "none";
  loggedInView.style.display = "block";
  userAvatar.textContent = initials(user.name);
  userName.textContent = user.name;
  userEmail.textContent = user.email;
  openAppLink.href = API_BASE.replace("/api", "");
}

/**
 * Auth check order:
 * 1. Existing JWT in chrome.storage (already logged into extension)
 * 2. Web app session cookie (auto-login if user is signed into hiretrail.manavkaneria.me)
 * 3. Show login form
 */
async function checkAuth() {
  showLoading();

  // 1. Check existing extension token
  const { token, user } = await chrome.storage.local.get(["token", "user"]);
  if (token && user) {
    showLoggedIn(user);
    return;
  }

  // 2. Try to auto-login from web app session cookie
  try {
    const cookie = await chrome.cookies.get({
      url: `https://${HIRETRAIL_DOMAIN}`,
      name: "connect.sid",
    });

    if (cookie) {
      const res = await fetch(`${API_BASE}/auth/extension-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send the session cookie along with the request
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        await chrome.storage.local.set({ token: data.token, user: data.user });
        showLoggedIn(data.user);
        return;
      }
    }
  } catch {
    // Cookie read or session exchange failed — fall through to login form
  }

  // 3. No valid session found
  showLogin();
}

// Email/password login
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const btn = document.getElementById("login-btn");
  btn.disabled = true;
  btn.textContent = "Logging in...";

  try {
    const res = await fetch(`${API_BASE}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    await chrome.storage.local.set({ token: data.token, user: data.user });
    showLoggedIn(data.user);
  } catch (err) {
    loginError.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Log in";
  }
});

// Google sign-in via background script (launchWebAuthFlow runs in service worker)
googleBtn.addEventListener("click", async () => {
  googleError.textContent = "";
  googleBtn.disabled = true;
  googleBtn.textContent = "Signing in...";

  try {
    const response = await chrome.runtime.sendMessage({ type: "GOOGLE_LOGIN" });
    if (response.error) throw new Error(response.error);

    await chrome.storage.local.set({ token: response.token, user: response.user });
    showLoggedIn(response.user);
  } catch (err) {
    googleError.textContent = err.message || "Google sign-in failed";
  } finally {
    googleBtn.disabled = false;
    googleBtn.innerHTML = `
      <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Sign in with Google`;
  }
});

logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(["token", "user"]);
  showLogin();
});

checkAuth();
