#!/usr/bin/env python3
"""
Split the monolithic TunnelVision research log into a multi-page static site.

Extracts base64 media, splits HTML into chapter pages, creates shared CSS/JS,
and builds an index page with sidebar navigation.
"""

import os
import re
import base64
import json
import hashlib
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).parent  # genesis/
SRC = ROOT / "TunnelVision_Prototype_Exploration_Log.html"
ASSETS = ROOT / "assets"
IMG_DIR = ASSETS / "images"
VID_DIR = ASSETS / "videos"
CSS_DIR = ASSETS / "css"
JS_DIR = ASSETS / "js"
RESEARCH = ROOT / "research"

# ── Ensure directories ──────────────────────────────────────────────
for d in [IMG_DIR, VID_DIR, CSS_DIR, JS_DIR, RESEARCH]:
    d.mkdir(parents=True, exist_ok=True)


def read_source():
    return SRC.read_text(encoding="utf-8")


# ── Step 1: Parse out CSS and JS ────────────────────────────────────
def extract_css(html):
    """Extract CSS from <style> tag."""
    m = re.search(r"<style>(.*?)</style>", html, re.DOTALL)
    if m:
        return m.group(1)
    return ""


def extract_js(html):
    """Extract the lightbox JS (last <script> block)."""
    m = re.search(r"<script>\s*\(\(\) => \{.*?\}\)\(\);\s*</script>", html, re.DOTALL)
    if m:
        return m.group(0)
    return ""


# ── Step 2: Extract base64 media ────────────────────────────────────
def extract_base64_media(html):
    """Find all data: URIs, save to files, return replacement map."""
    replacements = {}
    seen_hashes = {}  # dedup identical data
    
    # Track context for naming
    img_counter = {"exploration-start": 0, "exploration": {}, "canonical": 0, 
                   "motion": 0, "other": 0, "lightbox": 0}
    
    # Find current section context based on position
    def get_context(pos):
        """Determine which section we're in based on position in HTML."""
        # Find the nearest preceding section id
        section_pattern = re.compile(r'id="([\w-]+)"')
        last_id = None
        for m in section_pattern.finditer(html[:pos]):
            last_id = m.group(1)
        return last_id or "unknown"
    
    # Pattern for data URIs in src attributes and JS
    data_uri_pattern = re.compile(
        r'(data:(image|video)/(jpeg|jpg|png|mp4|webm);base64,([A-Za-z0-9+/=\s]+))'
    )
    
    media_count = {"images": 0, "videos": 0}
    
    for match in data_uri_pattern.finditer(html):
        full_uri = match.group(1)
        media_type = match.group(2)  # image or video
        fmt = match.group(3)  # jpeg, png, mp4
        b64_data = match.group(4).replace('\n', '').replace('\r', '').replace(' ', '')
        
        if full_uri in replacements:
            continue
        
        # Compute hash to dedup
        data_hash = hashlib.md5(b64_data[:1000].encode()).hexdigest()[:12]
        
        if data_hash in seen_hashes:
            replacements[full_uri] = seen_hashes[data_hash]
            continue
        
        # Decode and save
        try:
            raw = base64.b64decode(b64_data)
        except Exception as e:
            print(f"Warning: failed to decode base64 at pos {match.start()}: {e}")
            continue
        
        # Determine filename based on context
        pos = match.start()
        ctx = get_context(pos)
        
        ext = "jpg" if fmt in ("jpeg", "jpg") else fmt
        
        if media_type == "video":
            media_count["videos"] += 1
            filename = f"motion-test-{media_count['videos']:02d}.{ext}"
            save_dir = VID_DIR
        else:
            media_count["images"] += 1
            filename = name_image(ctx, pos, ext, html, media_count["images"])
            save_dir = IMG_DIR
        
        filepath = save_dir / filename
        # Avoid collisions
        while filepath.exists():
            name_base = filepath.stem
            filepath = save_dir / f"{name_base}-dup.{ext}"
        
        filepath.write_bytes(raw)
        
        if media_type == "video":
            rel_path = f"assets/videos/{filepath.name}"
        else:
            rel_path = f"assets/images/{filepath.name}"
        
        replacements[full_uri] = rel_path
        seen_hashes[data_hash] = rel_path
    
    print(f"Extracted {media_count['images']} images and {media_count['videos']} videos")
    return replacements


def name_image(ctx, pos, ext, html, counter):
    """Generate a systematic name for an extracted image."""
    # Check if this is in the canonical-reel lightbox JS (frames array)
    # The JS frames are after </main> near end of file
    if pos > len(html) - 200000:  # Near end = likely in JS frames array
        # Try to find which canonical frame label
        before = html[max(0, pos-200):pos]
        label_m = re.search(r'"label":\s*"([A-H])"', before)
        if label_m:
            return f"canonical-{label_m.group(1)}.{ext}"
    
    # Check for frame-badge context (canonical frames in filmstrip)
    before_ctx = html[max(0, pos-2000):pos]
    
    if ctx == "canonical-reel" or "canonical-reel" in before_ctx:
        badge_m = re.search(r'class="frame-badge">([A-H])<', before_ctx[-500:])
        if badge_m:
            return f"canonical-{badge_m.group(1)}-reel.{ext}"
        return f"canonical-reel-{counter:02d}.{ext}"
    
    # Check step number for exploration sections
    step_m = re.search(r'class="step-num">(\d+)<', before_ctx[-1000:])
    if step_m:
        step_num = step_m.group(1)
        # Check if reference or candidate
        if "chosen" in before_ctx[-500:]:
            return f"exploration-{step_num}-chosen.{ext}"
        elif "rejected" in before_ctx[-500:] or "rejected-badge" in before_ctx[-500:]:
            return f"exploration-{step_num}-rejected.{ext}"
        
        # Count candidates within this step
        ref_m = re.search(r'alt="[Rr]eference', before_ctx[-300:])
        if ref_m:
            return f"exploration-{step_num}-ref.{ext}"
        
        # Generic candidate
        return f"exploration-{step_num}-c{counter:02d}.{ext}"
    
    # START block
    if "START" in before_ctx[-500:] or 'class="start-block"' in before_ctx[-500:]:
        badge_m = re.search(r'class="frame-badge">([A-H])<', before_ctx[-500:])
        if badge_m:
            return f"exploration-start-{badge_m.group(1)}.{ext}"
        return f"exploration-start.{ext}"
    
    # Motion test images
    if ctx and "motion" in ctx:
        return f"motion-{counter:02d}.{ext}"
    
    # Camotion / later sections
    if ctx:
        return f"{ctx}-{counter:02d}.{ext}"
    
    return f"image-{counter:02d}.{ext}"


# ── Step 3: Split HTML into sections ────────────────────────────────
def split_into_chapters(html):
    """
    Split the body content into chapter groups.
    Returns dict of chapter_name -> html_content
    """
    # Remove <head>, extract body content
    body_m = re.search(r"<body[^>]*>(.*?)</main>", html, re.DOTALL)
    if not body_m:
        raise ValueError("Could not find <body>...</main>")
    
    body = body_m.group(1)
    
    # Remove the old TOC nav
    body = re.sub(r'<nav class="toc[^"]*"[^>]*>.*?</nav>', '', body, flags=re.DOTALL)
    
    # Remove back-to-contents links (we'll replace with prev/next)
    body = re.sub(r'<a class="back-toc"[^>]*>.*?</a>', '', body)
    
    # Define section boundaries by their id or class markers
    # Chapter 1: origin through sequence-audit (hero, story, exploration, canonical-reel, sequence-audit)
    # Chapter 2: motion (Tests 00-10), findings, first ready-code (no id)
    # Chapter 3: checkpoint, architecture section
    # Chapter 4: camotion-checkpoint, cinematographer-benchmark
    # Chapter 5: terran-action, banded-compositor, start-orientation, reduced-strength
    
    # Split using section markers
    # We'll use a regex to find section boundaries
    
    # Find all major section starts
    section_starts = []
    for m in re.finditer(r'<section\s+class="([^"]*)"(?:\s+id="([^"]*)")?', body):
        section_starts.append({
            'pos': m.start(),
            'class': m.group(1),
            'id': m.group(2) or '',
            'full_match': m.group(0)
        })
    
    # Also find the hero section (div with class hero)
    hero_m = re.search(r'<div class="hero"', body)
    if hero_m:
        section_starts.insert(0, {
            'pos': hero_m.start(),
            'class': 'hero',
            'id': 'origin',
            'full_match': hero_m.group(0)
        })
    
    # Sort by position
    section_starts.sort(key=lambda x: x['pos'])
    
    # Map sections to chapters
    chapter_map = {
        # Chapter 1: origin & exploration
        'ch1': ['hero', 'origin', 'story', 'exploration', 'canonical-reel', 'sequence-audit'],
        # Chapter 2: motion experiments  
        'ch2': ['motion', 'findings', 'ready-code-first'],
        # Chapter 3: pre-code checkpoint
        'ch3': ['checkpoint', 'architecture'],
        # Chapter 4: camotion research
        'ch4': ['camotion-checkpoint', 'cinematographer-benchmark'],
        # Chapter 5: depth-banded camotion
        'ch5': ['terran-action', 'banded-compositor', 'start-orientation', 'reduced-strength'],
    }
    
    # Build chapter content by extracting section ranges
    chapters = {}
    
    # We need to identify which sections go to which chapter
    # Let's assign each section_start to a chapter
    section_chapter = {}
    
    for s in section_starts:
        sid = s['id']
        sclass = s['class']
        
        if sid in ('origin', 'story') or sclass == 'hero':
            section_chapter[s['pos']] = 'ch1'
        elif 'start-block' in sclass:
            section_chapter[s['pos']] = 'ch1'
        elif sid == 'exploration' or sclass == 'step':
            section_chapter[s['pos']] = 'ch1'
        elif sid == 'canonical-reel' or 'canonical-reel' in sclass:
            section_chapter[s['pos']] = 'ch1'
        elif sid == 'sequence-audit':
            section_chapter[s['pos']] = 'ch1'
        elif sid == 'motion' or 'motion-lab' in sclass:
            section_chapter[s['pos']] = 'ch2'
        elif sid == 'findings' or sclass == 'summary':
            section_chapter[s['pos']] = 'ch2'
        elif sclass == 'ready-code' and not sid:
            # First unnamed ready-code goes to ch2
            if 'ch2' not in [section_chapter.get(p) for p in section_chapter if section_chapter[p] == 'ch2' and any(ss['class'] == 'ready-code' for ss in section_starts if ss['pos'] == p)]:
                section_chapter[s['pos']] = 'ch2'
            else:
                section_chapter[s['pos']] = 'ch2'
        elif sid == 'checkpoint':
            section_chapter[s['pos']] = 'ch3'
        elif sclass == 'architecture':
            section_chapter[s['pos']] = 'ch3'
        elif sid == 'camotion-checkpoint':
            section_chapter[s['pos']] = 'ch4'
        elif sid == 'cinematographer-benchmark':
            section_chapter[s['pos']] = 'ch4'
        elif sid == 'terran-action':
            section_chapter[s['pos']] = 'ch5'
        elif sid == 'banded-compositor':
            section_chapter[s['pos']] = 'ch5'
        elif sid == 'start-orientation':
            section_chapter[s['pos']] = 'ch5'
        elif sid == 'reduced-strength':
            section_chapter[s['pos']] = 'ch5'
    
    # Now extract content for each chapter
    # Sort positions
    positions = sorted(section_chapter.keys())
    
    for ch_name in ['ch1', 'ch2', 'ch3', 'ch4', 'ch5']:
        ch_positions = [p for p in positions if section_chapter[p] == ch_name]
        if not ch_positions:
            chapters[ch_name] = ""
            continue
        
        start = min(ch_positions)
        # End is the start of next chapter's first section, or end of body
        next_ch_positions = [p for p in positions if p > max(ch_positions) and section_chapter[p] != ch_name]
        if next_ch_positions:
            end = min(next_ch_positions)
        else:
            end = len(body)
        
        chapters[ch_name] = body[start:end]
    
    # Also extract footer
    footer_m = re.search(r'<footer>.*?</footer>', html, re.DOTALL)
    footer = footer_m.group(0) if footer_m else ""
    
    return chapters, footer


# ── Step 4: Fix paths for chapter pages ─────────────────────────────
def fix_paths_for_chapter(content, replacements):
    """Replace data URIs with relative paths from research/ dir."""
    for data_uri, rel_path in replacements.items():
        # From research/ dir, assets is at ../assets/
        chapter_rel = f"../{rel_path}"
        content = content.replace(data_uri, chapter_rel)
    
    # Fix external camotion paths: from genesis/ they were ../camotion/
    # From genesis/research/ they need to be ../../camotion/
    content = content.replace('src="../camotion/', 'src="../../camotion/')
    content = content.replace("src='../camotion/", "src='../../camotion/")
    
    return content


# ── Step 5: Build chapter pages ─────────────────────────────────────
CHAPTER_INFO = [
    ("01-origin-and-exploration.html", "Origin & Exploration", "ch1"),
    ("02-motion-experiments.html", "Motion Experiments", "ch2"),
    ("03-pre-code-checkpoint.html", "Pre-Code Checkpoint", "ch3"),
    ("04-camotion-research.html", "Camotion Research", "ch4"),
    ("05-depth-banded-camotion.html", "Depth-Banded Camotion", "ch5"),
]


def sidebar_html(current_file, from_index=False):
    """Generate sidebar nav HTML."""
    prefix = "research/" if from_index else ""
    home_href = "../index.html" if not from_index else "index.html"
    
    links = []
    links.append(f'  <a href="{home_href}" class="nav-home">Home</a>')
    for filename, title, _ in CHAPTER_INFO:
        href = f"{prefix}{filename}" if from_index else filename
        active = ' class="active"' if filename == current_file else ''
        links.append(f'  <a href="{href}"{active}>{title}</a>')
    
    return f'''<nav class="sidebar" id="sidebar">
  <button class="nav-toggle" id="nav-toggle" aria-label="Toggle navigation">☰</button>
  <div class="sidebar-title">TUNNELVISION RESEARCH</div>
{chr(10).join(links)}
</nav>'''


def prev_next_nav(idx):
    """Generate prev/next navigation links."""
    parts = []
    if idx > 0:
        prev_file, prev_title, _ = CHAPTER_INFO[idx - 1]
        parts.append(f'<a href="{prev_file}" class="prev-link">← {prev_title}</a>')
    if idx < len(CHAPTER_INFO) - 1:
        next_file, next_title, _ = CHAPTER_INFO[idx + 1]
        parts.append(f'<a href="{next_file}" class="next-link">{next_title} →</a>')
    
    return f'<nav class="chapter-nav">{" ".join(parts)}</nav>'


def chapter_page(filename, title, content, idx):
    """Build a complete chapter page."""
    has_lightbox = 'canonical-reel' in content or 'journey-lightbox' in content
    
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width,initial-scale=1" name="viewport"/>
<title>{title} — TunnelVision Research</title>
<link rel="stylesheet" href="../assets/css/research.css"/>
</head>
<body>
{sidebar_html(filename)}
<main>
{content}
{prev_next_nav(idx)}
</main>
<script src="../assets/js/research.js"></script>
</body>
</html>'''


# ── Step 6: Build the lightbox HTML and extract it ──────────────────
def extract_lightbox_html(html):
    """Extract the lightbox overlay div from the original HTML."""
    m = re.search(r'(<div aria-hidden="true" class="journey-lightbox".*?</div>\s*</div>\s*</div>)', html, re.DOTALL)
    if m:
        return m.group(1)
    return ""


# ── Step 7: Build CSS ──────────────────────────────────────────────
def build_css(original_css):
    """Clean up CSS and add sidebar styles."""
    # Keep all original CSS but add sidebar styles
    sidebar_css = '''
/* ── Sidebar navigation ──────────────────────────────────────────── */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 200px;
  height: 100vh;
  background: var(--panel);
  border-right: 1px solid var(--line);
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  z-index: 100;
}
.sidebar-title {
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .16em;
  color: var(--accent);
  margin-bottom: 12px;
}
.sidebar a {
  display: block;
  padding: 8px 10px;
  color: var(--muted);
  text-decoration: none;
  font-size: 13px;
  border-radius: 6px;
  transition: background .15s, color .15s;
}
.sidebar a:hover {
  background: var(--panel2);
  color: var(--ink);
}
.sidebar a.active {
  background: rgba(199,255,202,.08);
  color: var(--accent);
  font-weight: 700;
}
.sidebar a.nav-home {
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 6px;
}
.nav-toggle {
  display: none;
  background: none;
  border: 1px solid var(--line);
  color: var(--ink);
  font-size: 22px;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 10px;
}

body {
  padding-left: 220px;
}

/* ── Chapter prev/next ──────────────────────────────────────────── */
.chapter-nav {
  display: flex;
  justify-content: space-between;
  padding: 40px 0 20px;
  border-top: 1px solid var(--line);
  margin-top: 60px;
}
.chapter-nav a {
  color: var(--accent);
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}
.chapter-nav a:hover {
  text-decoration: underline;
}
.chapter-nav .next-link {
  margin-left: auto;
}

/* ── Mobile responsive ──────────────────────────────────────────── */
@media (max-width: 1100px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: -260px;
    width: 240px;
    height: 100vh;
    transition: left .25s ease;
    z-index: 200;
    box-shadow: none;
  }
  .sidebar.open {
    left: 0;
    box-shadow: 4px 0 20px rgba(0,0,0,.5);
  }
  .nav-toggle {
    display: block;
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 300;
    background: var(--panel);
  }
  body {
    padding-left: 0;
  }
}
'''
    
    # Remove the old TOC/nav styles (conflicting v13-v18 overrides)
    # We'll strip out the toc-related CSS
    cleaned = re.sub(r'\.toc[^{]*\{[^}]*\}', '', original_css)
    cleaned = re.sub(r'\.toc-title[^{]*\{[^}]*\}', '', cleaned)
    cleaned = re.sub(r'\.side-nav[^{]*\{[^}]*\}', '', cleaned)
    cleaned = re.sub(r'\.back-toc[^{]*\{[^}]*\}', '', cleaned)
    
    return cleaned + "\n" + sidebar_css


# ── Step 8: Build JS ───────────────────────────────────────────────
def build_js(html, replacements):
    """Build the shared JS file with lightbox + mobile nav toggle."""
    # Extract the frames array from the original JS
    frames_m = re.search(r'const frames = (\[.*?\]);', html, re.DOTALL)
    frames_json = "[]"
    if frames_m:
        frames_json = frames_m.group(1)
        # Replace data URIs in frames
        for data_uri, rel_path in replacements.items():
            # In JS context from research/ pages
            chapter_rel = f"../{rel_path}"
            frames_json = frames_json.replace(data_uri, chapter_rel)
    
    return f'''// TunnelVision Research — shared JS
// Lightbox for canonical journey filmstrip
(function() {{
  const frames = {frames_json};
  const reelItems = Array.from(document.querySelectorAll('#canonical-reel .film-cell'));
  const lb = document.getElementById('journey-lightbox');
  if (!lb || !frames.length) return;

  const img = lb.querySelector('.lb-image');
  const label = lb.querySelector('.lb-label');
  const counter = lb.querySelector('.lb-counter');
  const prev = lb.querySelector('.lb-prev');
  const next = lb.querySelector('.lb-next');
  const close = lb.querySelector('.lb-close');
  let index = 0;

  function render() {{
    const f = frames[index];
    img.src = f.src;
    img.alt = f.alt;
    label.textContent = `Frame ${{f.label}}`;
    counter.textContent = `${{index + 1}} / ${{frames.length}}`;
  }}

  function openAt(i) {{
    index = i;
    render();
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lb-open');
    close.focus();
  }}

  function hide() {{
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-open');
  }}

  function step(delta) {{
    index = (index + delta + frames.length) % frames.length;
    render();
  }}

  reelItems.forEach(function(el, i) {{
    el.addEventListener('click', function() {{ openAt(i); }});
    el.addEventListener('keydown', function(e) {{
      if (e.key === 'Enter' || e.key === ' ') {{
        e.preventDefault();
        openAt(i);
      }}
    }});
  }});

  prev.addEventListener('click', function() {{ step(-1); }});
  next.addEventListener('click', function() {{ step(1); }});
  close.addEventListener('click', hide);
  lb.querySelector('.lb-backdrop').addEventListener('click', hide);

  document.addEventListener('keydown', function(e) {{
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') hide();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  }});
}})();

// Mobile nav toggle
(function() {{
  var toggle = document.getElementById('nav-toggle');
  var sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;
  
  toggle.addEventListener('click', function() {{
    sidebar.classList.toggle('open');
  }});
  
  // Close sidebar when clicking a link on mobile
  sidebar.querySelectorAll('a').forEach(function(a) {{
    a.addEventListener('click', function() {{
      if (window.innerWidth <= 1100) {{
        sidebar.classList.remove('open');
      }}
    }});
  }});
  
  // Close sidebar when clicking outside
  document.addEventListener('click', function(e) {{
    if (window.innerWidth <= 1100 && 
        sidebar.classList.contains('open') && 
        !sidebar.contains(e.target) && 
        e.target !== toggle) {{
      sidebar.classList.remove('open');
    }}
  }});
}})();
'''


# ── Step 9: Build index.html ────────────────────────────────────────
def build_index():
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width,initial-scale=1" name="viewport"/>
<title>TunnelVision Research</title>
<link rel="stylesheet" href="assets/css/research.css"/>
</head>
<body>
{sidebar_html(None, from_index=True)}
<main>
<div class="hero">
<div class="eyebrow">RESEARCH LOG</div>
<h1>TunnelVision</h1>
<p class="dek">TunnelVision turns manually directed TunnelTV filmmaking into an agentic system. TunnelTV was developed by Terran Boylan for the AI music video <em>Digging in the Dirt</em>.</p>
</div>

<section style="padding:48px 0;border-bottom:1px solid var(--line)">
<h2>Current research baseline</h2>
<p>Ghost Library / Seedance 2.5, Camotion 01.5, depth-banded outgoing exposure, strength 0.08. Not universal; one fixture.</p>
</section>

<section style="padding:48px 0;border-bottom:1px solid var(--line)">
<h2>Key findings</h2>
<ul style="color:var(--muted);line-height:1.8;font-size:16px;padding-left:20px">
<li>Visual continuity ≠ traversability</li>
<li>Continuous locomotion prompting outranks destination matching</li>
<li>Depth weighting improved motion conditioning on Ghost Library</li>
<li>Terran's workflow is depth-banded exposure compositing, not one depth-scaled blur</li>
<li>Motion-treating the strong depth mask was important in 01.5</li>
<li>Terminal-at-canonical start exposure worsened Seedance behavior (01.6)</li>
<li>Halving strength removed obvious recursion but weakened geometry authority (01.7)</li>
<li>Directed A→B requires endpoint fidelity</li>
</ul>
</section>

<section style="padding:48px 0;border-bottom:1px solid var(--line)">
<h2>Next experiment</h2>
<p style="color:var(--muted)">Not yet selected.</p>
</section>

<section style="padding:48px 0;border-bottom:1px solid var(--line)">
<h2>Research chapters</h2>
<div style="display:grid;gap:12px;margin-top:16px">
  <a href="research/01-origin-and-exploration.html" style="display:block;padding:16px 20px;background:var(--panel);border:1px solid var(--line);border-radius:12px;color:var(--ink);text-decoration:none;font-size:17px;font-weight:600">01 — Origin &amp; Exploration</a>
  <a href="research/02-motion-experiments.html" style="display:block;padding:16px 20px;background:var(--panel);border:1px solid var(--line);border-radius:12px;color:var(--ink);text-decoration:none;font-size:17px;font-weight:600">02 — Motion Experiments</a>
  <a href="research/03-pre-code-checkpoint.html" style="display:block;padding:16px 20px;background:var(--panel);border:1px solid var(--line);border-radius:12px;color:var(--ink);text-decoration:none;font-size:17px;font-weight:600">03 — Pre-Code Checkpoint</a>
  <a href="research/04-camotion-research.html" style="display:block;padding:16px 20px;background:var(--panel);border:1px solid var(--line);border-radius:12px;color:var(--ink);text-decoration:none;font-size:17px;font-weight:600">04 — Camotion Research</a>
  <a href="research/05-depth-banded-camotion.html" style="display:block;padding:16px 20px;background:var(--panel);border:1px solid var(--line);border-radius:12px;color:var(--ink);text-decoration:none;font-size:17px;font-weight:600">05 — Depth-Banded Camotion</a>
</div>
</section>

<section style="padding:48px 0">
<h3>Provenance</h3>
<p style="color:var(--muted);font-size:14px">TunnelTV = Terran Boylan · TunnelVision = this project · <a href="https://www.5050.dev/videos/v/4bkjb3htbteraepxtc9cnb9rc7azp2" style="color:var(--accent)">Digging in the Dirt</a></p>
</section>
</main>
<script src="assets/js/research.js"></script>
</body>
</html>'''


# ── Main ────────────────────────────────────────────────────────────
def main():
    print("Reading source HTML...")
    html = read_source()
    print(f"Source: {len(html):,} bytes, {html.count(chr(10))+1} lines")
    
    print("\nExtracting CSS...")
    original_css = extract_css(html)
    css = build_css(original_css)
    (CSS_DIR / "research.css").write_text(css, encoding="utf-8")
    print(f"  → assets/css/research.css ({len(css):,} bytes)")
    
    print("\nExtracting base64 media...")
    replacements = extract_base64_media(html)
    
    print("\nBuilding JS...")
    js = build_js(html, replacements)
    (JS_DIR / "research.js").write_text(js, encoding="utf-8")
    print(f"  → assets/js/research.js ({len(js):,} bytes)")
    
    print("\nSplitting into chapters...")
    chapters, footer = split_into_chapters(html)
    
    # Extract lightbox HTML for chapter 1
    lightbox_html = extract_lightbox_html(html)
    # Fix lightbox data URIs
    lightbox_html = fix_paths_for_chapter(lightbox_html, replacements)
    
    for idx, (filename, title, ch_key) in enumerate(CHAPTER_INFO):
        content = chapters.get(ch_key, "")
        if not content:
            print(f"  WARNING: No content for {ch_key} / {filename}")
            continue
        
        # Fix paths
        content = fix_paths_for_chapter(content, replacements)
        
        # Add lightbox HTML to chapter 1 (after </main> but before </body>)
        extra = ""
        if ch_key == "ch1":
            extra = lightbox_html
        
        # Add footer to last chapter
        if idx == len(CHAPTER_INFO) - 1:
            content += "\n" + footer
        
        page = chapter_page(filename, title, content, idx)
        if extra:
            page = page.replace("</main>", f"</main>\n{extra}")
        
        (RESEARCH / filename).write_text(page, encoding="utf-8")
        print(f"  → research/{filename} ({len(page):,} bytes)")
    
    print("\nBuilding index.html...")
    index = build_index()
    (ROOT / "index.html").write_text(index, encoding="utf-8")
    print(f"  → index.html ({len(index):,} bytes)")
    
    # ── Validation ──────────────────────────────────────────────────
    print("\n" + "="*60)
    print("VALIDATION")
    print("="*60)
    
    # Check for remaining base64
    all_html_files = list(RESEARCH.glob("*.html")) + [ROOT / "index.html"]
    base64_count = 0
    for f in all_html_files:
        text = f.read_text(encoding="utf-8")
        count = len(re.findall(r'data:(?:image|video)', text))
        if count:
            print(f"  ⚠ {f.name}: {count} remaining data: URIs")
            base64_count += count
    
    if base64_count == 0:
        print("  ✓ Zero data:image/data:video URIs in any HTML file")
    else:
        print(f"  ✗ {base64_count} total remaining data: URIs")
    
    # Check media file existence
    print("\nMedia files:")
    img_files = list(IMG_DIR.glob("*"))
    vid_files = list(VID_DIR.glob("*"))
    print(f"  Images: {len(img_files)}")
    print(f"  Videos: {len(vid_files)}")
    
    # Verify referenced files exist
    missing = []
    for f in all_html_files:
        text = f.read_text(encoding="utf-8")
        for m in re.finditer(r'(?:src|href)="([^"]*)"', text):
            ref = m.group(1)
            if ref.startswith(("http", "mailto", "#", "javascript")):
                continue
            # Resolve relative to file's directory
            ref_path = f.parent / ref
            if not ref_path.exists():
                missing.append((f.name, ref))
    
    if missing:
        print(f"\n  ⚠ {len(missing)} broken references:")
        for fname, ref in missing[:20]:
            print(f"    {fname} → {ref}")
    else:
        print("\n  ✓ All src/href references resolve to existing files")
    
    # File sizes
    print("\nFile sizes:")
    print(f"  Old monolith: {SRC.stat().st_size:,} bytes ({SRC.stat().st_size / 1024 / 1024:.1f} MB)")
    print(f"  index.html:   {(ROOT / 'index.html').stat().st_size:,} bytes")
    for filename, _, _ in CHAPTER_INFO:
        p = RESEARCH / filename
        if p.exists():
            print(f"  {filename}: {p.stat().st_size:,} bytes")
    
    total_media = sum(f.stat().st_size for f in img_files + vid_files)
    print(f"\n  Total extracted media: {total_media:,} bytes ({total_media / 1024 / 1024:.1f} MB)")
    print(f"  Old monolith preserved: {SRC.exists()}")


if __name__ == "__main__":
    main()
