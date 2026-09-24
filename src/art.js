export const icons = {
  leaf: '<path d="M5 19C1 7 9 3 21 3c1 12-4 18-16 16Z"/><path d="m5 19 10-10"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  flower:
    '<path d="M12 8C5-2 0 10 8 12c-10 7 2 12 4 4 7 10 12-2 4-4 10-7-2-12-4-4Z"/><circle cx="12" cy="12" r="2"/>',
  undo: '<path d="M8 4 3 9l5 5M4 9h10a6 6 0 1 1 0 12"/>',
  hint: '<path d="M8 16c0-3-3-3-3-7a7 7 0 0 1 14 0c0 4-3 4-3 7M8 17h8m-7 4h6"/>',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 4 3c-1 .5-1 1-1 3m0 3h.01"/>',
  sound:
    '<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 4-6 5H2v6h3l6 5ZM16 9l6 6m0-6-6 6"/>',
  trophy:
    '<path d="M7 3h10v5c0 8-10 8-10 0ZM7 5H3v3c0 3 3 4 5 4m9-7h4v3c0 3-3 4-5 4m-4 2v6m-5 1h10"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18m-13 4h2m4 0h2"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
};
export const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.leaf}</svg>`;
export const plants = [
  { name: "Little sprout", need: 0, color: "#88ad7c" },
  { name: "Golden daisy", need: 8, color: "#e5b85f" },
  { name: "Wild poppy", need: 20, color: "#dd8069" },
  { name: "Bluebell", need: 40, color: "#829cc6" },
  { name: "Sweet clover", need: 75, color: "#95b37c" },
  { name: "Lavender", need: 120, color: "#a390bb" },
  { name: "Peach blossom", need: 180, color: "#dfa18c" },
  { name: "Moonflower", need: 260, color: "#c6cbaa" },
  { name: "Sunflower", need: 360, color: "#d7a947" },
];
export function plantArt(index = 0) {
  const c = plants[index].color;
  let petals = "";
  if (index === 0)
    petals =
      '<ellipse cx="43" cy="40" rx="15" ry="7" transform="rotate(35 43 40)" fill="#94b685"/><ellipse cx="64" cy="30" rx="16" ry="8" transform="rotate(-35 64 30)" fill="#6e9774"/>';
  else if (index === 5)
    for (let i = 0; i < 5; i++)
      petals += `<ellipse cx="${i % 2 ? 54 : 47}" cy="${20 + i * 7}" rx="8" ry="5" fill="${c}"/>`;
  else
    for (let i = 0; i < 7; i++)
      petals += `<ellipse cx="52" cy="24" rx="7" ry="13" transform="rotate(${(i * 360) / 7} 52 36)" fill="${c}"/>`;
  return `<svg viewBox="0 0 104 120" aria-hidden="true"><ellipse cx="53" cy="112" rx="31" ry="5" fill="#234a3810"/><path d="M52 89V36" stroke="#63856c" stroke-width="3" fill="none"/><path d="M52 76C31 74 27 61 29 58c17 0 25 9 23 18M53 64c19-1 25-13 23-17-17 2-24 10-23 17" fill="#86a583"/>${petals}${index > 0 && index !== 5 ? '<circle cx="52" cy="36" r="7" fill="#f7d88d"/><circle cx="50" cy="34" r="2" fill="#fff2c3"/>' : ""}<path d="m30 85 5 22q17 9 34 0l5-22Z" fill="#d3a284"/><path d="m33 91 5 15q5 3 9 3l-3-18" fill="#e0b79b"/><rect x="27" y="82" width="50" height="10" rx="4" fill="#e4b99b"/><path d="M32 86h39" stroke="#edcbb2" stroke-width="2"/></svg>`;
}
export function gardenArt(count = 1) {
  return `<svg class="garden-art" viewBox="0 0 260 225" aria-label="Your growing garden" role="img"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#e8eddc"/><stop offset="1" stop-color="#f4f1df"/></linearGradient></defs><rect x="19" y="10" width="222" height="184" rx="110" fill="url(#sky)"/><circle cx="184" cy="53" r="21" fill="#eee0aa"/><path d="M24 163q47-39 99 0t117-4v33H24" fill="#d2ddbe"/><path d="M20 182q75-32 146-3t75 2v18H20" fill="#b8caaa"/><path d="M33 191h198l-16 23H52Z" fill="#c6a88b"/><path d="M52 214v-13m34 13v-13m43 13v-13m43 13v-13m43 13v-13" stroke="#ae9076"/><path d="M20 193h223" stroke="#dbc2a4" stroke-width="9" stroke-linecap="round"/><g transform="translate(23 75) scale(.85)">${plantArt(Math.min(count - 1, 8)).replace(/<\/?svg[^>]*>/g, "")}</g><g transform="translate(101 95) scale(.68)">${plantArt(count > 2 ? 2 : 0).replace(/<\/?svg[^>]*>/g, "")}</g><g transform="translate(164 107) scale(.58)">${plantArt(count > 4 ? 5 : 0).replace(/<\/?svg[^>]*>/g, "")}</g><path d="M33 72q-8-12-15-3m17 2q2-14 11-13" stroke="#abbc98" stroke-width="2" fill="none"/><path d="m218 105 4-8m-4 8 9-2" stroke="#b6bb8c" stroke-width="2"/></svg>`;
}
