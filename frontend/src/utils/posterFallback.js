// Generates a self-contained SVG "poster" (as a data URI) for movies that have
// no image URL, or whose image fails to load. Keeps the grid looking
// intentional instead of showing a broken-image icon, and makes AI-suggested
// movies (which come without a poster) saveable — the backend requires a
// non-empty image field.

const GRADIENTS = [
  ["#f5c518", "#b8890a"],
  ["#3878ff", "#1e3a8a"],
  ["#e11d48", "#7f1d1d"],
  ["#10b981", "#065f46"],
  ["#8b5cf6", "#4c1d95"],
  ["#f97316", "#7c2d12"],
];

function hash(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function escapeXml(str = "") {
  return str.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c])
  );
}

export function generatePoster(name = "Untitled", year = "") {
  const [from, to] = GRADIENTS[hash(name) % GRADIENTS.length];
  const safeName = escapeXml(String(name).slice(0, 40));
  const safeYear = escapeXml(String(year || ""));
  const id = "g" + (hash(name) % 100000);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="300" fill="url(#${id})"/>
  <rect width="400" height="300" fill="rgba(0,0,0,0.28)"/>
  <text x="24" y="40" font-family="Poppins, Arial, sans-serif" font-size="34" opacity="0.85">🎬</text>
  <text x="24" y="170" font-family="Poppins, Arial, sans-serif" font-size="30" font-weight="700" fill="#fff">${safeName}</text>
  <text x="24" y="205" font-family="Inter, Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.8)">${safeYear}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const isBlank = (v) => !v || String(v).trim() === "";
