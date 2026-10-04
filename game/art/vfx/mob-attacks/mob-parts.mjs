// Shared SVG bodies for the mob-attack effect set. Each string is a full
// <svg> document (width/height attributes are required by node-canvas
// Image loading, viewBox alone is not enough).

// Thin red gum arc (~14 px) with five evenly spaced, symmetric fangs.
// Middle fangs longest so the snapped silhouette still reads as a jaw at
// ~120 px combat size. Shared by the single and multi bite effects.
export const JAW_UPPER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <path d="M44 80 Q128 54 212 80 L208 94 Q128 68 48 94 Z" fill="#a12a38" stroke="#2c0a16" stroke-width="7" stroke-linejoin="round"/>
  <g fill="#ffffff" stroke="#2c0a16" stroke-width="7" stroke-linejoin="round">
    <path d="M52 90 L62 122 L72 88 Z"/>
    <path d="M85 88 L95 132 L105 86 Z"/>
    <path d="M118 86 L128 136 L138 86 Z"/>
    <path d="M151 86 L161 132 L171 88 Z"/>
    <path d="M184 88 L194 122 L204 90 Z"/>
  </g>
</svg>`

export const JAW_LOWER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <path d="M44 176 Q128 202 212 176 L208 162 Q128 188 48 162 Z" fill="#a12a38" stroke="#2c0a16" stroke-width="7" stroke-linejoin="round"/>
  <g fill="#ffffff" stroke="#2c0a16" stroke-width="7" stroke-linejoin="round">
    <path d="M52 166 L62 134 L72 168 Z"/>
    <path d="M85 168 L95 124 L105 170 Z"/>
    <path d="M118 170 L128 120 L138 170 Z"/>
    <path d="M151 170 L161 124 L171 168 Z"/>
    <path d="M184 168 L194 134 L204 166 Z"/>
  </g>
</svg>`

// Blunt charge wedge pointing left (the direction of travel), with three
// speed lines trailing the right edge. The head reads as a blurred
// headbutt/tusks at ~120 px combat size.
export const RAM_WEDGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <g fill="none" stroke="#caa27a" stroke-width="10" stroke-linecap="round" opacity="0.9">
    <path d="M196 92 L246 84"/>
    <path d="M204 128 L250 128"/>
    <path d="M196 164 L246 172"/>
  </g>
  <path d="M30 128 L118 86 L224 94 L224 162 L118 170 Z" fill="#d9a86c" stroke="#3a2410" stroke-width="9" stroke-linejoin="round"/>
  <path d="M30 128 L118 86 L224 94 L200 118 L96 130 Z" fill="#f0d0a0"/>
  <path d="M30 128 L52 114 L46 142 Z" fill="#fff4dd"/>
</svg>`

// Heavy sole/paw print that drops onto the target. Solid dark silhouette
// so it reads on both light and dark ground.
export const STOMP_SOLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <g fill="#3d2416" stroke="#180c05" stroke-width="8" stroke-linejoin="round">
    <ellipse cx="86" cy="86" rx="20" ry="26"/>
    <ellipse cx="128" cy="74" rx="22" ry="28"/>
    <ellipse cx="170" cy="86" rx="20" ry="26"/>
    <rect x="70" y="112" width="116" height="84" rx="34" ry="30"/>
  </g>
  <g fill="#6b452a" opacity="0.85">
    <ellipse cx="128" cy="160" rx="38" ry="24"/>
    <ellipse cx="86" cy="88" rx="10" ry="13"/>
    <ellipse cx="128" cy="76" rx="11" ry="14"/>
    <ellipse cx="170" cy="88" rx="10" ry="13"/>
  </g>
</svg>`

// Crescent blade trail - a single curved cut with a bright leading edge.
// Layers rotate/translate this one texture for vertical, horizontal and
// multi slash variants.
export const SLASH_BLADE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <path d="M18 148 C86 96 170 96 238 140 C172 128 92 156 18 148 Z" fill="#fff4e8" stroke="#b42820" stroke-width="5" stroke-linejoin="round"/>
  <path d="M18 148 C86 96 170 96 238 140 C176 118 94 138 26 146 Z" fill="#ffffff"/>
  <path d="M18 148 C80 110 156 108 226 134 C162 122 90 142 24 146 Z" fill="#ff5a3c" opacity="0.55"/>
</svg>`
