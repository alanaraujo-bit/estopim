import { signal } from '@preact/signals';
import { PROTOCOL_VERSION, applyOp, type ClientMsg, type Op, type OpResult, type Profile, type RoomInfo, type ServerMsg } from '@estopim/shared';
import { mutateProfile, online, profile, saveProfile, toast } from '../state/store';

export const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ||
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname.startsWith('192.168.') ? `${location.protocol}//${location.hostname}:8787` : 'https://estopim-server-production.up.railway.app');

const TKEY = 'estopim.token';
const QKEY = 'estopim.ops';

export const account = signal<{ username?: string; linked: boolean }>({ linked: false });
export const onlineCount = signal(0);
export const latency = signal(0);
export const currentRoom = signal<RoomInfo | null>(null);
export const queueStatus = signal<{ searching: boolean; elapsed: number; inQueue: number; kind: 'casual' | 'ranked' } | null>(null);
export const presence = signal<Record<string, 'online' | 'offline' | 'playing'>>({});
export const invites = signal<{ from: { id: string; name: string }; code: string; at: number }[]>([]);

function token(): string | null {
  try {
    return localStorage.getItem(TKEY);
  } catch {
    return null;
  }
}
function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TKEY, t);
    else localStorage.removeItem(TKEY);
  } catch {
    /* ignora */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    msg: string,
  ) {
    super(msg);
  }
}

export async function api<T = any>(path: string, body?: any, method?: string): Promise<T> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(SERVER_URL + path, {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', ...(token() ? { authorization: 'Bearer ' + token() } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error ?? 'Erro de comunicação com o servidor.');
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'Sem conexão com o servidor.');
  } finally {
    clearTimeout(to);
  }
}

// ───────────── Operações de perfil com fila offline ─────────────
function loadQueue(): Op[] {
  try {
    return JSON.parse(localStorage.getItem(QKEY) ?? '[]');
  } catch {
    return [];
  }
}
function saveQueue(q: Op[]) {
  try {
    localStorage.setItem(QKEY, JSON.stringify(q));
  } catch {
    /* ignora */
  }
}

/** Aplica localmente (resposta imediata) e sincroniza com o servidor quando possível. */
export function doOp(op: Op): OpResult {
  let res: OpResult = { ok: false, events: [] };
  mutateProfile((p) => {
    res = applyOp(p, op, { trusted: false });
  });
  if (!res.ok) return res;
  const q = loadQueue();
  q.push(op);
  saveQueue(q);
  void flushOps();
  return res;
}

let flushing = false;
export async function flushOps() {
  if (flushing || !token()) return;
  const q = loadQueue();
  if (!q.length) return;
  flushing = true;
  try {
    const r = await api<{ profile: Profile; rejected: number }>('/api/ops', { ops: q });
    // remove as operações enviadas (novas podem ter chegado nesse meio tempo)
    const now = loadQueue();
    saveQueue(now.slice(q.length));
    if (r.profile) adoptServerProfile(r.profile);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      setToken(null);
      void authGuest();
    }
  } finally {
    flushing = false;
  }
}

function adoptServerProfile(p: Profile) {
  // reaplica operações ainda pendentes por cima do perfil do servidor
  const pending = loadQueue();
  const copy = structuredClone(p);
  for (const op of pending) applyOp(copy, op, { trusted: false });
  profile.value = copy;
  saveProfile(copy);
}

async function authGuest() {
  const p = profile.value;
  const r = await api<{ token: string; profile: Profile; username?: string }>('/api/auth/guest', { localId: p.id, name: p.name, local: p });
  setToken(r.token);
  account.value = { username: r.username, linked: !!r.username };
  adoptServerProfile(r.profile);
}

export async function register(username: string, password: string) {
  const r = await api<{ ok: boolean; username: string }>('/api/auth/register', { username, password });
  account.value = { username: r.username, linked: true };
  return r;
}

export async function login(username: string, password: string) {
  const r = await api<{ token: string; profile: Profile; username: string }>('/api/auth/login', { username, password });
  setToken(r.token);
  saveQueue([]);
  account.value = { username: r.username, linked: true };
  profile.value = r.profile;
  saveProfile(r.profile);
  ws?.close();
  connectWs();
  return r;
}

export async function logout() {
  setToken(null);
  saveQueue([]);
  try {
    localStorage.removeItem('estopim.profile');
  } catch {
    /* ignora */
  }
  location.reload();
}

// ───────────── WebSocket ─────────────
type Listener = (m: ServerMsg) => void;
const listeners = new Set<Listener>();
let ws: WebSocket | null = null;
let backoff = 800;
let pingTimer = 0;
let reconnectTimer = 0;
let wanted = true;

export function onMsg(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function send(msg: ClientMsg): boolean {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
    return true;
  }
  return false;
}

export function wsReady() {
  return !!ws && ws.readyState === WebSocket.OPEN;
}

function connectWs() {
  const t = token();
  if (!t || !wanted) return;
  clearTimeout(reconnectTimer);
  online.value = 'connecting';
  const url = SERVER_URL.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(t);
  let sock: WebSocket;
  try {
    sock = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }
  ws = sock;
  sock.onopen = () => {
    backoff = 800;
    online.value = 'online';
    sock.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION } satisfies ClientMsg));
    clearInterval(pingTimer);
    pingTimer = window.setInterval(() => send({ t: 'ping', ts: performance.now() }), 4000);
    void flushOps();
  };
  sock.onmessage = (ev) => {
    let m: ServerMsg;
    try {
      m = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (m.t === 'pong') latency.value = Math.round(performance.now() - m.ts);
    if (m.t === 'welcome') onlineCount.value = m.online;
    if (m.t === 'invite') toast(`${m.from.name} te convidou para uma sala`, 'info', `Código ${m.code} — veja em Amigos`, '✉', 6000);
    if (m.t === 'notice') toast(m.msg, 'info');
    if (m.t === 'room') currentRoom.value = m.room;
    if (m.t === 'queue.status') queueStatus.value = m.searching ? { searching: m.searching, elapsed: m.elapsed, inQueue: m.inQueue, kind: m.kind } : null;
    if (m.t === 'presence') presence.value = { ...presence.value, ...Object.fromEntries(m.friends.map((f) => [f.id, f.status])) };
    if (m.t === 'invite') invites.value = [...invites.value.filter((i) => i.code !== m.code), { from: m.from, code: m.code, at: Date.now() }].slice(-5);
    for (const l of listeners) l(m);
  };
  sock.onclose = () => {
    if (ws === sock) ws = null;
    clearInterval(pingTimer);
    online.value = 'offline';
    queueStatus.value = null;
    scheduleReconnect();
  };
  sock.onerror = () => sock.close();
}

function scheduleReconnect() {
  if (!wanted) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = window.setTimeout(connectWs, backoff);
  backoff = Math.min(15000, backoff * 1.7);
}

let started = false;
export async function initNet() {
  if (started) return;
  started = true;
  const tryAuth = async () => {
    try {
      if (!token()) await authGuest();
      else {
        const r = await api<{ profile: Profile; username?: string }>('/api/me');
        account.value = { username: r.username, linked: !!r.username };
        adoptServerProfile(r.profile);
      }
      connectWs();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setToken(null);
        setTimeout(tryAuth, 500);
        return;
      }
      online.value = 'offline';
      setTimeout(tryAuth, 8000);
    }
  };
  void tryAuth();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !wsReady() && token()) connectWs();
  });
  window.addEventListener('online', () => !wsReady() && connectWs());
}

/** Sincroniza nome do jogador (também aplicado localmente). */
export function setName(name: string) {
  return doOp({ k: 'name', name });
}

export { mutateProfile };
