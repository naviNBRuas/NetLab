export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Calculate subnet details from an IP address and CIDR prefix length.
 * @param {string} ipStr - Dotted decimal IPv4 address
 * @param {number} cidr - CIDR prefix length (0-32)
 * @returns {object|null} Subnet info or null if input invalid
 */
export function calcSubnet(ipStr, cidr) {
  const parts = ipStr.split(".").map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255) || isNaN(cidr) || cidr < 0 || cidr > 32) return null;
  const hostBits = 32 - cidr;
  const usableHosts = cidr < 31 ? Math.pow(2, hostBits) - 2 : cidr === 31 ? 2 : 1;
  const mask = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
  const toOct = n => `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
  const network = (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const first = cidr < 31 ? network + 1 : network;
  const last = cidr < 31 ? broadcast - 1 : broadcast;
  return { network: toOct(network) + "/" + cidr, mask: toOct(mask), wildcard: toOct(~mask >>> 0), broadcast: toOct(broadcast), firstHost: toOct(first), lastHost: toOct(last), usableHosts };
}

/**
 * Generate a deterministic, order-independent key for an edge between two node IDs.
 * @param {string|number} a - First node ID
 * @param {string|number} b - Second node ID
 * @returns {string} Pipe-separated sorted key
 */
export function edgeKey(a, b) {
  return [a, b].sort().join("|");
}

const LEFT_KEY = "netlab.sidebar.left";
const RIGHT_KEY = "netlab.sidebar.right";

/**
 * Compute minimum and maximum sidebar widths based on viewport size.
 * @returns {{leftMin: number, rightMin: number, leftMax: number, rightMax: number}} Bounds object
 */
export function sidebarBounds() {
  if (typeof window === 'undefined') return { leftMin: 72, rightMin: 92, leftMax: 260, rightMax: 360 };
  const vw = window.innerWidth || 1200;
  const leftMin = Math.max(72, Math.min(110, Math.round(vw * 0.18)));
  const rightMin = Math.max(92, Math.min(220, Math.round(vw * 0.20)));
  const leftMax = Math.max(leftMin, Math.min(260, Math.round(vw * 0.42)));
  const rightMax = Math.max(rightMin, Math.min(360, Math.round(vw * 0.48)));
  return { leftMin, rightMin, leftMax, rightMax };
}

/**
 * Read a sidebar width value from localStorage with a fallback default.
 * @param {string} key - localStorage key
 * @param {number} fallback - Default value if not found
 * @returns {number} The stored or fallback width
 */
export function readStoredWidth(key, fallback) {
  if (typeof localStorage === 'undefined') return fallback;
  const raw = Number(localStorage.getItem(key));
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/**
 * Apply sidebar widths as CSS custom properties on the document root and persist to localStorage.
 * @param {number} left - Left sidebar width in pixels
 * @param {number} right - Right sidebar width in pixels
 */
export function applySidebarWidths(left, right) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty("--left-w", `${left}px`);
  root.style.setProperty("--right-w", `${right}px`);
  const l = document.getElementById("l-resize"), r = document.getElementById("r-resize");
  if (l) l.setAttribute("aria-valuenow", String(Math.round(left)));
  if (r) r.setAttribute("aria-valuenow", String(Math.round(right)));
  localStorage.setItem(LEFT_KEY, String(left));
  localStorage.setItem(RIGHT_KEY, String(right));
}

/**
 * Initialize sidebar widths from stored values, clamped to viewport-derived bounds.
 */
export function initSidebarWidths() {
  const { leftMin, rightMin, leftMax, rightMax } = sidebarBounds();
  const left = clamp(readStoredWidth(LEFT_KEY, 148), leftMin, leftMax);
  const right = clamp(readStoredWidth(RIGHT_KEY, 286), rightMin, rightMax);
  applySidebarWidths(left, right);
}
