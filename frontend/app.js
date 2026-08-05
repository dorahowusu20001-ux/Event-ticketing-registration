const storedUrl = localStorage.getItem("eventApiUrl") || "";
const apiUrlInput = document.querySelector("#api-url");
const eventsList = document.querySelector("#events-list");
const eventsState = document.querySelector("#events-state");
const eventCount = document.querySelector("#event-count");
const eventSelect = document.querySelector("#event-id");
const registrationsState = document.querySelector("#registrations-state");
const toast = document.querySelector("#toast");
let events = [];
let toastTimer;

apiUrlInput.value = storedUrl;

function baseUrl() { return apiUrlInput.value.trim().replace(/\/+$/, ""); }
function endpoint(path) { return `${baseUrl()}${path}`; }
function showToast(message, isError = false) {
  toast.textContent = message; toast.classList.toggle("error", isError); toast.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 4500);
}
function apiError(payload, fallback) { return payload && payload.error ? payload.error : fallback; }
async function request(path, options = {}) {
  if (!baseUrl()) throw new Error("Enter your API Gateway URL first.");
  const response = await fetch(endpoint(path), options);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiError(payload, `Request failed (${response.status})`));
  return payload;
}
function formatDate(value) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`)) : "Date to be confirmed"; }
function eventLabel(event) { return `${event.eventName || event.eventId} — ${formatDate(event.date)}`; }
function renderEvents() {
  eventsList.replaceChildren(); eventSelect.replaceChildren();
  eventSelect.append(new Option(events.length ? "Choose an event" : "No events available", ""));
  events.forEach((event) => {
    const card = document.createElement("article"); card.className = "event-card";
    const top = document.createElement("div"); top.className = "event-card-top";
    const title = document.createElement("h3"); title.textContent = event.eventName || event.eventId;
    const status = document.createElement("span"); status.className = "status"; status.textContent = event.status || "Open";
    const meta = document.createElement("p"); meta.className = "event-meta"; meta.textContent = `${formatDate(event.date)}${event.capacity ? ` · ${event.capacity} places` : ""}`;
    top.append(title, status); card.append(top, meta); eventsList.append(card);
    eventSelect.append(new Option(eventLabel(event), event.eventId));
  });
  eventSelect.disabled = !events.length; eventCount.textContent = `${events.length} event${events.length === 1 ? "" : "s"}`;
}
async function loadEvents() {
  eventsState.hidden = false; eventsList.hidden = true; eventsState.textContent = "Loading events…";
  try { const data = await request("/events"); events = data.events || []; renderEvents(); eventsState.hidden = Boolean(events.length); eventsList.hidden = !events.length; if (!events.length) eventsState.textContent = "No events are available yet."; }
  catch (error) { events = []; renderEvents(); eventsState.textContent = error.message; showToast(error.message, true); }
}
async function lookupRegistrations(email) {
  registrationsState.textContent = "Looking up registrations…";
  try {
    const data = await request(`/registrations/${encodeURIComponent(email)}`); const items = data.registrations || [];
    registrationsState.replaceChildren();
    if (!items.length) { registrationsState.textContent = "No registrations found for this email."; return; }
    items.forEach((item) => {
      const row = document.createElement("div"); row.className = "registration-item";
      const name = document.createElement("strong"); name.textContent = item.eventName || item.eventId;
      const detail = document.createElement("p"); detail.textContent = `Status: ${item.status || "confirmed"}`;
      const cancel = document.createElement("button"); cancel.className = "cancel-button"; cancel.type = "button"; cancel.textContent = "Cancel registration";
      cancel.addEventListener("click", async () => {
        if (!confirm(`Cancel your registration for ${item.eventName || item.eventId}?`)) return;
        try { await request(`/registration/${encodeURIComponent(item.registrationId)}`, { method: "DELETE" }); showToast("Registration cancelled."); lookupRegistrations(email); }
        catch (error) { showToast(error.message, true); }
      });
      row.append(name, detail, cancel); registrationsState.append(row);
    });
  } catch (error) { registrationsState.textContent = error.message; showToast(error.message, true); }
}
document.querySelector("#api-form").addEventListener("submit", (event) => { event.preventDefault(); localStorage.setItem("eventApiUrl", baseUrl()); loadEvents(); });
document.querySelector("#refresh-events").addEventListener("click", loadEvents);
document.querySelector("#registration-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const form = new FormData(event.currentTarget); const button = event.currentTarget.querySelector("button"); button.disabled = true;
  try { const data = await request("/register", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(Object.fromEntries(form)) }); showToast(`You're registered! ID: ${data.registration.registrationId}`); event.currentTarget.reset(); }
  catch (error) { showToast(error.message, true); } finally { button.disabled = false; }
});
document.querySelector("#lookup-form").addEventListener("submit", (event) => { event.preventDefault(); lookupRegistrations(document.querySelector("#lookup-email").value.trim()); });
if (storedUrl) loadEvents();
