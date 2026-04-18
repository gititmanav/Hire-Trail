const API_BASE = "/api";

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const config = {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  };

  const res = await fetch(url, config);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
}

async function multipart(endpoint, formData, method = "POST") {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}

// Auth
export const authAPI = {
  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (name, email, password) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  logout: () => request("/auth/logout", { method: "POST" }),

  getMe: () => request("/auth/me"),
};

// Applications
export const applicationsAPI = {
  getAll: () => request("/applications"),
  getOne: (id) => request(`/applications/${id}`),
  create: (data) =>
    request("/applications", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    request(`/applications/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id) => request(`/applications/${id}`, { method: "DELETE" }),
};

// Resumes
function buildResumeForm({ name, targetRole, tags, file }) {
  const fd = new FormData();
  if (name !== undefined) fd.append("name", name);
  if (targetRole !== undefined) fd.append("targetRole", targetRole);
  if (tags !== undefined) fd.append("tags", JSON.stringify(tags || []));
  if (file) fd.append("file", file);
  return fd;
}

export const resumesAPI = {
  getAll: () => request("/resumes"),
  getOne: (id) => request(`/resumes/${id}`),
  getTags: () => request("/resumes/tags"),
  create: (data) => multipart("/resumes", buildResumeForm(data), "POST"),
  update: (id, data) =>
    multipart(`/resumes/${id}`, buildResumeForm(data), "PUT"),
  delete: (id) => request(`/resumes/${id}`, { method: "DELETE" }),
};

// Contacts
export const contactsAPI = {
  getAll: () => request("/contacts"),
  getOne: (id) => request(`/contacts/${id}`),
  create: (data) =>
    request("/contacts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    request(`/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id) => request(`/contacts/${id}`, { method: "DELETE" }),
};

// Deadlines
export const deadlinesAPI = {
  getAll: () => request("/deadlines"),
  getOne: (id) => request(`/deadlines/${id}`),
  create: (data) =>
    request("/deadlines", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    request(`/deadlines/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id) => request(`/deadlines/${id}`, { method: "DELETE" }),
};

// Analytics
export const analyticsAPI = {
  get: () => request("/analytics"),
};
