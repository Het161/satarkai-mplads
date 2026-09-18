"""
Generate the README's isometric diagrams.

Written as a generator rather than hand-authored SVG because isometric
projection is arithmetic, and hand-placed polygon points drift out of alignment
the moment anything moves. Re-run with:  python3 scripts/build-diagrams.py

Constraints these have to satisfy, which shape every choice below:
  - GitHub renders README images through <img>, so declarative SVG animation
    (SMIL and CSS @keyframes) plays, but scripts never run and external
    resources never load. Everything is inline and self-contained.
  - GitHub has a light and a dark theme. Each diagram carries its own dark
    ground so it reads the same in both rather than becoming a white slab.
  - Fonts must be generic families; a web font would silently fall back.
"""

import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "assets"
OUT.mkdir(parents=True, exist_ok=True)

LOGO = ROOT / "public" / "logo.svg"
# Next.js only picks up a favicon from inside app/, and serves it at a hashed
# path, so the <img> tags need their own copy under public/. public/logo.svg is
# the source; this is the copy, synced here so the two cannot drift.
APP_ICON = ROOT / "src" / "app" / "icon.svg"


def logo_mark(x, y, size, ink):
    """
    The SatarkAI mark, placed and recoloured for a dark ground.

    Read out of public/logo.svg rather than redrawn here. The mark's geometry
    is fiddly — a fitted circle, a broken arc, a rotated handle — and a second
    hand-placed copy would drift from the first the moment either is touched.
    Only the navy is swapped; the orange bar is the anomaly and keeps its
    colour on any background.
    """
    body = LOGO.read_text(encoding="utf-8")
    body = body[body.index(">", body.index("<svg")) + 1 : body.rindex("</svg>")]
    body = re.sub(r"<title\b.*?</title>", "", body, flags=re.S)
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    body = body.replace("#0E2F5C", ink)
    scale = size / 1136
    return (
        f'<g transform="translate({x},{y}) scale({scale:.5f})" '
        f'opacity="0.97">{body}</g>'
    )

# --- Audit palette, same tokens the application uses -------------------------
INK      = "#0B1220"
NAVY     = "#12356B"
SLATE    = "#8A98B0"
LINE     = "#22304A"
PAPER    = "#F6F8FB"
BLUE     = "#2a78d6"
ORANGE   = "#eb6834"
AQUA     = "#1baf7a"
CRITICAL = "#E2564E"
HIGH     = "#E89B3C"
VIOLET   = "#7C6CE0"

# Isometric basis: 30-degree projection.
COS30, SIN30 = math.cos(math.radians(30)), math.sin(math.radians(30))


def iso(x, y, z=0.0, scale=1.0):
    """Grid coordinates -> screen. x runs right-down, y left-down, z up."""
    return (
        (x - y) * COS30 * scale,
        (x + y) * SIN30 * scale - z * scale,
    )


def pts(points):
    return " ".join(f"{px:.2f},{py:.2f}" for px, py in points)


def shade(hexcolour, factor):
    """Darken (<1) or lighten (>1) a hex colour, for the faces of a solid."""
    h = hexcolour.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16)
        c = c * factor if factor <= 1 else c + (255 - c) * (factor - 1)
        out.append(max(0, min(255, int(round(c)))))
    return "#%02X%02X%02X" % tuple(out)


def slab(ox, oy, gx, gy, w, d, thick, colour, scale=1.0, opacity=1.0):
    """An isometric slab: top face plus its two visible sides.

    `thick` is in GRID units, so its on-screen height is thick * scale. Keep it
    around 1 — these are plates that float apart, and a thick one swallows the
    gap to the plate above it and turns a stack of layers into one solid block.

    Three tones of one hue rather than three hues — the faces are the same
    material under different light, and using separate colours for them reads
    as three objects.
    """
    def P(x, y, z):
        sx, sy = iso(x, y, z, scale)
        return (ox + sx, oy + sy)

    top = [P(gx, gy, thick), P(gx + w, gy, thick), P(gx + w, gy + d, thick), P(gx, gy + d, thick)]
    left = [P(gx, gy + d, thick), P(gx + w, gy + d, thick), P(gx + w, gy + d, 0), P(gx, gy + d, 0)]
    right = [P(gx + w, gy, thick), P(gx + w, gy + d, thick), P(gx + w, gy + d, 0), P(gx + w, gy, 0)]

    return (
        f'<polygon points="{pts(left)}" fill="{shade(colour, 0.55)}" opacity="{opacity}"/>'
        f'<polygon points="{pts(right)}" fill="{shade(colour, 0.72)}" opacity="{opacity}"/>'
        f'<polygon points="{pts(top)}" fill="{colour}" opacity="{opacity}"/>'
        f'<polygon points="{pts(top)}" fill="none" stroke="{shade(colour, 1.35)}" '
        f'stroke-width="1" opacity="{opacity * 0.9}"/>'
    ), top


def top_centre(ox, oy, gx, gy, w, d, thick, scale=1.0):
    sx, sy = iso(gx + w / 2, gy + d / 2, thick, scale)
    return ox + sx, oy + sy


def head(width, height, title):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'width="{width}" height="{height}" role="img" aria-label="{title}">'
        f"<title>{title}</title>"
    )


DEFS = f"""
<defs>
  <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#0B1220"/>
    <stop offset="60%" stop-color="#0D1829"/>
    <stop offset="100%" stop-color="#0A101C"/>
  </linearGradient>
  <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="{BLUE}" stop-opacity="0"/>
    <stop offset="50%" stop-color="{BLUE}" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="{BLUE}" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="{BLUE}" stop-opacity="0.30"/>
    <stop offset="100%" stop-color="{BLUE}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glowWarm" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="{ORANGE}" stop-opacity="0.22"/>
    <stop offset="100%" stop-color="{ORANGE}" stop-opacity="0"/>
  </radialGradient>
</defs>
"""

FONT = "font-family=\"'Segoe UI',Roboto,Helvetica,Arial,sans-serif\""


def grid(ox, oy, cells, step, scale=1.0, opacity=0.16):
    """A faint isometric floor, so the solids sit on something."""
    out = []
    span = cells * step
    for i in range(cells + 1):
        a = iso(i * step, 0, 0, scale)
        b = iso(i * step, span, 0, scale)
        out.append(
            f'<line x1="{ox+a[0]:.1f}" y1="{oy+a[1]:.1f}" x2="{ox+b[0]:.1f}" y2="{oy+b[1]:.1f}" '
            f'stroke="{LINE}" stroke-width="1" opacity="{opacity}"/>'
        )
        c = iso(0, i * step, 0, scale)
        d = iso(span, i * step, 0, scale)
        out.append(
            f'<line x1="{ox+c[0]:.1f}" y1="{oy+c[1]:.1f}" x2="{ox+d[0]:.1f}" y2="{oy+d[1]:.1f}" '
            f'stroke="{LINE}" stroke-width="1" opacity="{opacity}"/>'
        )
    return "".join(out)


# ============================================================================
# 1. Banner
# ============================================================================

def banner():
    W, H = 1280, 400
    s = [head(W, H, "SatarkAI — MPLADS anomaly and oversight platform, by Team Technoverse"), DEFS]
    s.append(f'<rect width="{W}" height="{H}" fill="url(#ground)"/>')
    s.append(f'<ellipse cx="980" cy="200" rx="330" ry="210" fill="url(#glow)"/>')
    s.append(f'<ellipse cx="1180" cy="340" rx="220" ry="140" fill="url(#glowWarm)"/>')

    # Floating plates, lowest first. Labels sit beside the stack rather than on
    # it: a plate's own surface is largely hidden by the plate above, so a label
    # centred on it is a label nobody can read.
    S, FOOT, THICK = 17, 6, 1.0
    OX, OY, GAP = 1010, 250, 48
    layers = [
        ("Postgres · Prisma", NAVY),
        ("Rule engine", BLUE),
        ("Model service", VIOLET),
        ("Role dashboards", AQUA),
    ]
    half_w = FOOT * COS30 * S
    for i, (label, colour) in enumerate(layers):
        lift = i * GAP
        body, _ = slab(OX, OY - lift, 0, 0, FOOT, FOOT, THICK, colour, scale=S)
        s.append(body)
        # Left vertex of this plate's top face, where the leader attaches.
        ly = OY - lift + FOOT * SIN30 * S - THICK * S
        lx = OX - half_w
        s.append(
            f'<line x1="{lx-8:.0f}" y1="{ly:.0f}" x2="{lx-2:.0f}" y2="{ly:.0f}" '
            f'stroke="{colour}" stroke-width="1.5" opacity="0.85"/>'
        )
        s.append(
            f'<text x="{lx-14:.0f}" y="{ly+4:.0f}" {FONT} font-size="12.5" font-weight="600" '
            f'fill="#DCE8F8" text-anchor="end">{label}</text>'
        )

    top_y = OY - 3 * GAP - THICK * S
    s.append(
        f'<rect x="{OX-half_w:.0f}" y="0" width="{2*half_w:.0f}" height="3" '
        f'fill="url(#sweep)" opacity="0.95">'
        f'<animateTransform attributeName="transform" type="translate" '
        f'values="0,{OY+30:.0f}; 0,{top_y:.0f}; 0,{OY+30:.0f}" dur="6s" '
        f'repeatCount="indefinite"/></rect>'
    )
    for dx, delay, colour in [(-58, 0, CRITICAL), (0, 1.2, HIGH), (56, 2.4, BLUE), (-24, 3.6, AQUA)]:
        s.append(
            f'<circle cx="{OX+dx}" cy="{top_y-14:.0f}" r="4" fill="{colour}">'
            f'<animate attributeName="cy" values="{top_y-14:.0f};{top_y-46:.0f};{top_y-14:.0f}" '
            f'dur="4s" begin="{delay}s" repeatCount="indefinite"/>'
            f'<animate attributeName="opacity" values="0;1;0" dur="4s" '
            f'begin="{delay}s" repeatCount="indefinite"/></circle>'
        )

    # Mark and wordmark share a baseline block: mark on the left, name and
    # transliteration stacked beside it.
    s.append(logo_mark(72, 88, 76, "#DCE8F8"))
    s.append(
        f'<text x="168" y="150" {FONT} font-size="62" font-weight="700" fill="#FFFFFF" '
        f'letter-spacing="-1.5">Satark<tspan fill="{BLUE}">AI</tspan></text>'
    )
    s.append(
        f'<text x="172" y="182" {FONT} font-size="15" fill="{SLATE}" letter-spacing="3.5">'
        f'सतर्क · VIGILANT</text>'
    )
    s.append(
        f'<text x="72" y="228" {FONT} font-size="19" fill="#C9D6E8" font-weight="500">'
        f'Catching what a rule-by-rule check cannot see</text>'
    )
    s.append(
        f'<text x="72" y="256" {FONT} font-size="14" fill="{SLATE}">'
        f'AI-assisted anomaly, fraud and inefficiency detection for MPLADS</text>'
    )
    s.append(
        f'<rect x="72" y="288" width="196" height="34" rx="6" fill="{BLUE}" opacity="0.14" '
        f'stroke="{BLUE}" stroke-width="1" stroke-opacity="0.5"/>'
        f'<circle cx="92" cy="305" r="4" fill="{AQUA}">'
        f'<animate attributeName="opacity" values="1;0.25;1" dur="2.4s" repeatCount="indefinite"/>'
        f'</circle>'
        f'<text x="106" y="310" {FONT} font-size="13" font-weight="600" fill="#DCE8F8" '
        f'letter-spacing="1.6">TEAM TECHNOVERSE</text>'
    )
    s.append(
        f'<text x="288" y="310" {FONT} font-size="12" fill="{SLATE}">'
        f'SIH 2026 · PS 26102 · MoSPI</text>'
    )
    s.append("</svg>")
    (OUT / "banner.svg").write_text("".join(s), encoding="utf-8")


def architecture():
    W, H = 1280, 700
    s = [head(W, H, "SatarkAI system architecture"), DEFS]
    s.append(f'<rect width="{W}" height="{H}" fill="url(#ground)"/>')
    s.append(f'<ellipse cx="470" cy="380" rx="440" ry="300" fill="url(#glow)"/>')
    s.append(
        f'<text x="48" y="52" {FONT} font-size="21" font-weight="700" fill="#FFFFFF">'
        f'System architecture</text>'
        f'<text x="48" y="76" {FONT} font-size="13" fill="{SLATE}">'
        f'Four layers. The model service is the only one the platform can lose and keep working.</text>'
    )

    S, W_, D_, THICK = 19, 9, 6, 1.1
    OX, OY, GAP = 470, 540, 118
    tiers = [
        (VIOLET, "MODEL SERVICE", "optional",
         ["FastAPI · scikit-learn · Python 3.13", "IsolationForest anomaly score",
          "Delay-risk prediction · ablation explanations"]),
        (NAVY, "DATA", "",
         ["PostgreSQL · Prisma", "Works · Payments · Evidence · Alerts",
          "AuditLog · DetectorOutcome (feedback loop)"]),
        (BLUE, "APPLICATION", "",
         ["Next.js 14 · Server Components", "scopeFor() jurisdiction filter on every query",
          "Server actions · review workflow · exports"]),
        (AQUA, "PRESENTATION", "",
         ["5 role dashboards · alert queue · drill-down", "Audit trail · CSV and PDF export",
          "English / हिन्दी · WCAG 2.1 AA"]),
    ]

    half_w = W_ * COS30 * S
    label_x = OX + half_w + 26
    for i, (colour, title, tag, items) in enumerate(tiers):
        lift = i * GAP
        body, _ = slab(OX, OY - lift, 0, 0, W_, D_, THICK, colour, scale=S)
        s.append(body)

        # Right vertex of the top face — the leader's anchor.
        ry = OY - lift + W_ * SIN30 * S - THICK * S
        rx = OX + half_w
        s.append(
            f'<line x1="{rx+2:.0f}" y1="{ry:.0f}" x2="{label_x-8:.0f}" y2="{ry:.0f}" '
            f'stroke="{colour}" stroke-width="1.4" opacity="0.8"/>'
            f'<circle cx="{rx+2:.0f}" cy="{ry:.0f}" r="3" fill="{colour}"/>'
        )
        s.append(
            f'<text x="{label_x:.0f}" y="{ry-8:.0f}" {FONT} font-size="14" font-weight="700" '
            f'fill="#FFFFFF" letter-spacing="1">{title}'
            + (f'<tspan {FONT} font-size="11" font-weight="500" fill="{ORANGE}">'
               f'   ({tag})</tspan>' if tag else "")
            + "</text>"
        )
        for j, item in enumerate(items):
            s.append(
                f'<text x="{label_x:.0f}" y="{ry+12+j*17:.0f}" {FONT} font-size="11.5" '
                f'fill="#CBD9EC" opacity="0.95">{item}</text>'
            )

    for delay in (0, 1.5, 3.0):
        s.append(
            f'<circle cx="{OX}" cy="{OY+20}" r="5" fill="{BLUE}" opacity="0.9">'
            f'<animate attributeName="cy" values="{OY+20};{OY-3*GAP-30}" dur="4.5s" '
            f'begin="{delay}s" repeatCount="indefinite"/>'
            f'<animate attributeName="opacity" values="0;0.95;0.95;0" dur="4.5s" '
            f'begin="{delay}s" repeatCount="indefinite"/></circle>'
        )

    s.append(
        f'<g opacity="0.97">'
        f'<rect x="48" y="452" width="300" height="106" rx="8" fill="{ORANGE}" fill-opacity="0.10" '
        f'stroke="{ORANGE}" stroke-width="1.2" stroke-opacity="0.55"/>'
        f'<text x="68" y="478" {FONT} font-size="12" font-weight="700" fill="{ORANGE}" '
        f'letter-spacing="1">ML_MODE=rules · THE DEFAULT</text>'
        f'<text x="68" y="500" {FONT} font-size="11.5" fill="#D6E2F2">'
        f'Unreachable or slow is treated as</text>'
        f'<text x="68" y="518" {FONT} font-size="11.5" fill="#D6E2F2">'
        f'&#8220;no model signals this run&#8221;, not an error.</text>'
        f'<text x="68" y="540" {FONT} font-size="11.5" fill="{SLATE}">'
        f'134 of 174 alerts need no Python at all.</text>'
        f'</g>'
    )
    s.append(
        f'<g opacity="0.97">'
        f'<rect x="48" y="580" width="300" height="86" rx="8" fill="{AQUA}" fill-opacity="0.10" '
        f'stroke="{AQUA}" stroke-width="1.2" stroke-opacity="0.55"/>'
        f'<text x="68" y="606" {FONT} font-size="12" font-weight="700" fill="{AQUA}" '
        f'letter-spacing="1">RBAC IS A QUERY FILTER</text>'
        f'<text x="68" y="628" {FONT} font-size="11.5" fill="#D6E2F2">'
        f'A missing jurisdiction yields DENY_ALL, so</text>'
        f'<text x="68" y="646" {FONT} font-size="11.5" fill="#D6E2F2">'
        f'the failure mode is &#8220;see nothing&#8221;, never all.</text>'
        f'</g>'
    )
    s.append("</svg>")
    (OUT / "architecture.svg").write_text("".join(s), encoding="utf-8")


# ============================================================================
# 3. Detection pipeline
# ============================================================================

def pipeline():
    W, H = 1280, 470
    s = [head(W, H, "SatarkAI detection pipeline"), DEFS]
    s.append(f'<rect width="{W}" height="{H}" fill="url(#ground)"/>')
    s.append(f'<ellipse cx="640" cy="230" rx="560" ry="230" fill="url(#glow)"/>')
    s.append(
        f'<text x="48" y="50" {FONT} font-size="21" font-weight="700" fill="#FFFFFF">'
        f'Detection pipeline</text>'
        f'<text x="48" y="74" {FONT} font-size="13" fill="{SLATE}">'
        f'Three layers of evidence, in order of how much each one needs. A human decides at the end of all of them.</text>'
    )

    stages = [
        (150, NAVY,   "eSAKSHI record",
         ["968 works", "2,162 payments", "4,274 evidence files"]),
        (420, BLUE,   "8 rule detectors",
         ["Deterministic · citable", "One scheme rule each", "No Python needed"]),
        (690, AQUA,   "2 statistical tests",
         ["Cost outliers (MAD)", "Agency concentration", "Binomial tail test"]),
        (960, VIOLET, "IsolationForest",
         ["11 features", "Unusual in combination", "Needs the service"]),
    ]

    for i, (x, colour, title, items) in enumerate(stages):
        body, _ = slab(x, 200, 0, 0, 5, 5, 1.2, colour, scale=26)
        s.append(body)
        cx, cy = top_centre(x, 200, 0, 0, 5, 5, 1.2, scale=26)
        s.append(
            f'<text x="{cx:.0f}" y="{cy-18:.0f}" {FONT} font-size="13" font-weight="700" '
            f'fill="#FFFFFF" text-anchor="middle">{title}</text>'
        )
        for j, item in enumerate(items):
            s.append(
                f'<text x="{cx:.0f}" y="{cy+4+j*16:.0f}" {FONT} font-size="11" '
                f'fill="#D6E2F2" text-anchor="middle" opacity="0.92">{item}</text>'
            )

        if i < len(stages) - 1:
            x1, x2 = x + 118, x + 262
            s.append(
                f'<line x1="{x1}" y1="234" x2="{x2}" y2="234" stroke="{shade(colour, 1.2)}" '
                f'stroke-width="2" opacity="0.45" stroke-dasharray="4 5"/>'
            )
            s.append(
                f'<circle cx="{x1}" cy="234" r="4.5" fill="{colour}">'
                f'<animate attributeName="cx" values="{x1};{x2}" dur="2.2s" '
                f'begin="{i*0.5}s" repeatCount="indefinite"/>'
                f'<animate attributeName="opacity" values="0;1;0" dur="2.2s" '
                f'begin="{i*0.5}s" repeatCount="indefinite"/></circle>'
            )

    # The output, and the fact that it stops at a person.
    s.append(
        f'<g>'
        f'<rect x="370" y="344" width="540" height="96" rx="10" fill="{INK}" fill-opacity="0.85" '
        f'stroke="{BLUE}" stroke-width="1.4" stroke-opacity="0.7"/>'
        f'<text x="640" y="376" {FONT} font-size="14" font-weight="700" fill="#FFFFFF" '
        f'text-anchor="middle">Explainable, ranked alert &#8212; then a human</text>'
        f'<text x="640" y="400" {FONT} font-size="11.5" fill="#D6E2F2" text-anchor="middle">'
        f'Plain-language reason &#183; the rule in words &#183; the records &#183; the score itemised</text>'
        f'<text x="640" y="422" {FONT} font-size="11.5" fill="{HIGH}" text-anchor="middle" '
        f'font-weight="600">Acknowledge &#183; Seek clarification &#183; Mark explained &#183; Escalate</text>'
        f'</g>'
    )
    for x in (420, 860):
        s.append(
            f'<line x1="640" y1="318" x2="{x}" y2="344" '
            f'stroke="{LINE}" stroke-width="1.5" opacity="0.45"/>'
        )

    s.append("</svg>")
    (OUT / "pipeline.svg").write_text("".join(s), encoding="utf-8")


# ============================================================================
# 4. Jurisdiction pyramid
# ============================================================================

def jurisdiction():
    W, H = 1280, 520
    s = [head(W, H, "Jurisdiction scoping across the five MPLADS roles"), DEFS]
    s.append(f'<rect width="{W}" height="{H}" fill="url(#ground)"/>')
    s.append(f'<ellipse cx="470" cy="300" rx="400" ry="230" fill="url(#glow)"/>')
    s.append(
        f'<text x="48" y="50" {FONT} font-size="21" font-weight="700" fill="#FFFFFF">'
        f'One filter, five jurisdictions</text>'
        f'<text x="48" y="74" {FONT} font-size="13" fill="{SLATE}">'
        f'Same queries for everyone. Only the scope differs &#8212; there is no &#8220;national mode&#8221; switch to get wrong.</text>'
    )

    # Widest at the bottom is deliberate: the Ministry sits above every
    # jurisdiction below it and sees all of them.
    S, THICK = 20, 1.0
    OX, OY = 470, 312
    levels = [
        (0,   "#1B4F9C", "MINISTRY / MoSPI", "every state and UT", 9),
        (54,  NAVY,      "STATE NODAL AUTHORITY", "one state", 7.5),
        (108, BLUE,      "DISTRICT AUTHORITY", "one district", 6),
        (162, AQUA,      "MEMBER OF PARLIAMENT", "own recommended works", 4.5),
        (210, VIOLET,    "IMPLEMENTING AGENCY", "own assigned works", 3),
    ]

    for lift, colour, title, sub, size in levels:
        body, _ = slab(OX, OY - lift, 0, 0, size, size, THICK, colour, scale=S)
        s.append(body)

        # Leader from the plate's left vertex. Labels sit off the stack because
        # each plate's surface is largely hidden by the one above it.
        lx = OX - size * COS30 * S
        ly = OY - lift + size * SIN30 * S - THICK * S
        s.append(
            f'<line x1="{lx-6:.0f}" y1="{ly:.0f}" x2="{lx-1:.0f}" y2="{ly:.0f}" '
            f'stroke="{colour}" stroke-width="1.5" opacity="0.85"/>'
            f'<circle cx="{lx-1:.0f}" cy="{ly:.0f}" r="3" fill="{colour}"/>'
        )
        s.append(
            f'<text x="{lx-14:.0f}" y="{ly-1:.0f}" {FONT} font-size="12" font-weight="700" '
            f'fill="#FFFFFF" text-anchor="end" letter-spacing="0.5">{title}</text>'
        )
        s.append(
            f'<text x="{lx-14:.0f}" y="{ly+14:.0f}" {FONT} font-size="10.5" '
            f'fill="{SLATE}" text-anchor="end">{sub}</text>'
        )

    # The code, because the claim is about code.
    code = [
        ("const { scope } = await requireSession();", "#8FB9EE"),
        ("", ""),
        ("prisma.work.findMany({ where: scope.work })", "#CBD9EC"),
        ("prisma.alert.count({ where: scope.alert })", "#CBD9EC"),
        ("", ""),
        ("// Missing jurisdiction -> DENY_ALL", "#7C8AA3"),
        ("// A broken account sees NOTHING,", "#7C8AA3"),
        ("// never everything.", "#7C8AA3"),
    ]
    s.append(
        f'<rect x="820" y="152" width="416" height="238" rx="10" fill="#070C15" '
        f'stroke="{LINE}" stroke-width="1.2"/>'
    )
    s.append(
        f'<circle cx="842" cy="174" r="4.5" fill="{CRITICAL}" opacity="0.8"/>'
        f'<circle cx="858" cy="174" r="4.5" fill="{HIGH}" opacity="0.8"/>'
        f'<circle cx="874" cy="174" r="4.5" fill="{AQUA}" opacity="0.8"/>'
        f'<text x="894" y="178" {FONT} font-size="10.5" fill="{SLATE}">src/lib/scope.ts</text>'
    )
    for i, (text, colour) in enumerate(code):
        if not text:
            continue
        s.append(
            f'<text x="842" y="{210 + i*21}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" '
            f'font-size="11.5" fill="{colour}">{text.replace("<", "&lt;").replace(">", "&gt;")}</text>'
        )
    s.append(
        f'<rect x="820" y="152" width="416" height="238" rx="10" fill="none" '
        f'stroke="{BLUE}" stroke-width="1.2" opacity="0.5">'
        f'<animate attributeName="opacity" values="0.15;0.6;0.15" dur="3.2s" '
        f'repeatCount="indefinite"/></rect>'
    )

    s.append("</svg>")
    (OUT / "jurisdiction.svg").write_text("".join(s), encoding="utf-8")


def sync_app_icon():
    """Keep the favicon byte-identical to the mark it is a copy of."""
    APP_ICON.write_text(LOGO.read_text(encoding="utf-8"), encoding="utf-8")


if __name__ == "__main__":
    banner()
    architecture()
    pipeline()
    jurisdiction()
    sync_app_icon()
    for f in sorted(OUT.glob("*.svg")):
        print(f"  {f.name:22} {f.stat().st_size / 1024:6.1f} KB")
    print(f"  {'icon.svg (synced)':22} {APP_ICON.stat().st_size / 1024:6.1f} KB")
