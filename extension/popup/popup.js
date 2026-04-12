const API_BASE = "https://hiretrail.manavkaneria.me/api";

const loginView = document.getElementById("login-view");
const loggedInView = document.getElementById("logged-in-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");
const userEmail = document.getElementById("user-email");
const openAppLink = document.getElementById("open-app");
const logoutBtn = document.getElementById("logout-btn");

function initials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

async function checkAuth() {
  const { token, user } = await chrome.storage.local.get(["token", "user"]);
  if (token && user) {
    showLoggedIn(user);
  } else {
    showLogin();
  }
}

function showLogin() {
  loginView.style.display = "block";
  loggedInView.style.display = "none";
}

function showLoggedIn(user) {
  loginView.style.display = "none";
  loggedInView.style.display = "block";
  userAvatar.textContent = initials(user.name);
  userName.textContent = user.name;
  userEmail.textContent = user.email;
  openAppLink.href = API_BASE.replace("/api", "");
}

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

logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(["token", "user"]);
  showLogin();
});

checkAuth();
