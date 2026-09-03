#!/usr/bin/env bash
# Build the GitHub Pages staging directory from genesis/ and referenced
# Camotion research evidence.  No permanent media duplication in the repo.
#
# Only Camotion evidence actually referenced by the research HTML is staged.
# Unreferenced files are never published.
#
# Usage:  ./scripts/build-pages.sh [output_dir]
#         Default output_dir: _pages

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$REPO_ROOT/_pages}"

rm -rf "$OUT"

# 1. Copy genesis site contents (the research site source).
cp -R "$REPO_ROOT/genesis/" "$OUT"

# Remove files that are not part of the published site.
rm -f "$OUT/split_site.py"
rm -f "$OUT/.DS_Store"
rm -rf "$OUT/Video Exploration"
rm -rf "$OUT/Keyframe Exploration"
rm -f "$OUT/TunnelVision_Prototype_Exploration_Log.html"
rm -f "$OUT/TunnelTV.png"

# 2. Scan research HTML for references into camotion/tuning/ and stage
#    only the files actually used.  Fail if a referenced file is missing.
MISSING=0
while IFS= read -r rel; do
    # rel looks like ../../camotion/tuning/foo.png or ../camotion/tuning/foo.png
    # Strip only leading ../ segments to get the repo-relative path.
    repo_rel="$(echo "$rel" | sed 's|^\(\.\./\)*||')"

    # Must start with camotion/tuning/ after normalization.
    case "$repo_rel" in
        camotion/tuning/*) ;;
        *)
            echo "ERROR: normalized path does not start with camotion/tuning/: $repo_rel (from $rel)" >&2
            MISSING=$((MISSING + 1))
            continue
            ;;
    esac

    # Reject any remaining .. path traversal.
    case "$repo_rel" in
        *..*)
            echo "ERROR: path contains '..' after normalization: $repo_rel (from $rel)" >&2
            MISSING=$((MISSING + 1))
            continue
            ;;
    esac

    src="$REPO_ROOT/$repo_rel"
    dest="$OUT/$repo_rel"

    if [ ! -f "$src" ]; then
        echo "ERROR: referenced evidence not found: $repo_rel" >&2
        MISSING=$((MISSING + 1))
        continue
    fi

    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
done < <(
    # Extract href="..." and src="..." values containing camotion/tuning.
    # Use grep (not rg) so this runs on GitHub-hosted Ubuntu runners.
    grep -hEo '(src|href)="[^"]*camotion/tuning[^"]*"' \
        "$REPO_ROOT"/genesis/*.html \
        "$REPO_ROOT"/genesis/research/*.html 2>/dev/null \
    | sed -E 's/^(src|href)="//; s/"$//' \
    | sort -u \
    || true
)

if [ "$MISSING" -gt 0 ]; then
    echo "FATAL: $MISSING referenced Camotion evidence file(s) missing." >&2
    exit 1
fi

# 3. Rewrite ../../camotion/tuning → ../camotion/tuning in research pages.
#    genesis/research/ was two levels below repo root; now it is one level
#    below the site root.
for f in "$OUT"/research/*.html; do
    if sed --version >/dev/null 2>&1; then
        sed -i 's|../../camotion/tuning|../camotion/tuning|g' "$f"
    else
        sed -i '' 's|../../camotion/tuning|../camotion/tuning|g' "$f"
    fi
done

if [ -d "$OUT/camotion" ]; then
    EVIDENCE_COUNT=$(find "$OUT/camotion" -type f | wc -l | tr -d ' ')
    EVIDENCE_SIZE=$(du -sh "$OUT/camotion" | cut -f1)
else
    EVIDENCE_COUNT=0
    EVIDENCE_SIZE=0
fi

echo "Pages staged in: $OUT"
echo "Files: $(find "$OUT" -type f | wc -l | tr -d ' ')"
echo "Size:  $(du -sh "$OUT" | cut -f1)"
echo "Camotion evidence: $EVIDENCE_COUNT files, $EVIDENCE_SIZE"
