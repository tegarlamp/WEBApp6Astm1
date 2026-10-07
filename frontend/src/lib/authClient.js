import { api, API } from "@/lib/api";

// Session is tracked server-side via an HttpOnly cookie set on /auth/login.
// We never read or write the token in JS (hardens against XSS token theft).

function handleUnauthorized() {
  window.dispatchEvent(new Event("auth:unauthorized"));
}

let installed = false;

// Attach credentials to every backend request (axios + global fetch) and react
// to 401s by notifying the AuthProvider so the UI can bounce back to login.
export function installAuthInterceptors() {
  if (installed) return;
  installed = true;

  // axios: credentials already enabled via api.defaults.withCredentials.
  api.interceptors.response.use(
    (r) => r,
    (error) => {
      const url = error?.config?.url || "";
      if (error?.response?.status === 401 && !url.includes("/auth/")) handleUnauthorized();
      return Promise.reject(error);
    }
  );

  // Global fetch (used by kht/dka/copper api helpers, react-query, uploads, image fetches)
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const isApi = typeof url === "string" && url.startsWith(API);
    const isAuthEndpoint = isApi && url.startsWith(`${API}/auth/`);
    let nextInit = init;
    if (isApi && init.credentials !== "include") {
      nextInit = { ...init, credentials: "include" };
    }
    const res = await origFetch(input, nextInit);
    if (isApi && !isAuthEndpoint && res.status === 401) handleUnauthorized();
    return res;
  };
}
