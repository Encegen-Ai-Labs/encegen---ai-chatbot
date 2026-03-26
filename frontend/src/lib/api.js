/**
 * lib/api.js — Typed API client for the Encegen backend
 */

const BASE = import.meta.env.VITE_API_URL || "";

async function request(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  chat: (messages, systemOverride = null, model = null) =>
    request("POST", "/api/chat", {
      messages,
      ...(systemOverride && { system: systemOverride }),
      ...(model && { model }),
    }),

  // Booking — POSTs directly to backend which emails both addresses
  createBooking: (data) => request("POST", "/api/booking", data),

  createLead:  (data)     => request("POST",   "/api/leads",           data),
  listLeads:   (params)   => request("GET",    "/api/leads?" + new URLSearchParams(params)),
  recentLeads: (limit=20) => request("GET",    `/api/leads/recent?limit=${limit}`),
  getLead:     (id)       => request("GET",    `/api/leads/${id}`),
  updateLead:  (id, data) => request("PATCH",  `/api/leads/${id}`,     data),
  deleteLead:  (id)       => request("DELETE", `/api/leads/${id}`),
  stats:       ()         => request("GET",    "/api/stats"),
};
