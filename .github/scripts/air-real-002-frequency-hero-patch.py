#!/usr/bin/env python3
from pathlib import Path

p = Path("build_landing.py")
s = p.read_text()
marker = "/* AIR-REAL-002 desktop Frequency hero correction */"
if marker not in s:
    anchor = "mobile='''/* Approved FREQ phone-only correction */"
    desktop = """desktop='''/* AIR-REAL-002 desktop Frequency hero correction */
@media(min-width:761px){
 body[data-skin="frequency"] .heroArt #hero-scene{object-fit:contain;object-position:center;transform:none}
}'''
"""
    if s.count(anchor) != 1:
        raise SystemExit("DESKTOP_PATCH_ANCHOR_MISMATCH")
    s = s.replace(anchor, desktop + anchor)
    old = 'html=html.replace("</style>",beta_css+mobile+"</style>")'
    new = 'html=html.replace("</style>",beta_css+desktop+mobile+"</style>")'
    if s.count(old) != 1:
        raise SystemExit("STYLE_COMPOSE_ANCHOR_MISMATCH")
    s = s.replace(old, new)
    p.write_text(s)
print("AIR_REAL_002_PATCH_SCRIPT PASS")
