#!/usr/bin/env bash
# Generate the optional substrate textures with the Codex CLI's image tool.
# Requires a logged-in `codex` (ChatGPT account) and ImageMagick. Existing files
# are skipped unless --force is given. Output lands in public/textures/ as WebP.
# A ChatGPT usage-limit error means: wait for the reset, then rerun.
set -euo pipefail
cd "$(dirname "$0")/.."
force=${1:-}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

generate() {
  local name=$1 size=$2 prompt=$3
  local target="public/textures/$name.webp"
  if [[ -f $target && $force != --force ]]; then
    echo "skip  $target (exists)"
    return
  fi
  echo "make  $target"
  rm -f "$work/$name.png"
  codex exec --skip-git-repo-check -s workspace-write -C "$work" \
    "Use your image generation tool to create ONE image, then copy the resulting PNG file into the current working directory as $name.png (use the shell to copy it from wherever the tool saved it, e.g. under ~/.codex/generated_images). Do not create anything else. Image prompt: $prompt" \
    >"$work/$name.log" 2>&1 || { echo "codex failed for $name; see $work/$name.log"; cat "$work/$name.log" | tail -20; return 1; }
  if [[ ! -f $work/$name.png ]]; then
    echo "no image produced for $name"
    tail -20 "$work/$name.log"
    return 1
  fi
  convert "$work/$name.png" -resize "$size" -quality 85 -define webp:method=6 "$target"
  echo "done  $target ($(identify -format '%wx%h' "$target"))"
}

square="Perfectly even lighting with no gradient from one side to the other, no highlights, no shadows, no vignette. Strictly no text, no logos, no border, no frame. The texture must fill the frame edge to edge. Square, 1:1 aspect ratio, 1024x1024."

generate grain 1024x1024 "A seamless, tileable, extreme close-up texture of matte solder-mask lacquer on a circuit board. Neutral mid-grey, no colour tint. Fine irregular micro-grain, a faint orange-peel surface, very subtle random mottling. No traces, no components, no holes. $square"
generate scratches 1024x1024 "A seamless, tileable, extreme close-up texture of fine scratches, hairline scuffs, and small dust specks on a dark surface. Pure black background. Marks are thin, light grey to white, of varied length and random direction, with a few clusters of tiny dust particles. Sparse overall: most of the image stays black. No colour, no large shapes. $square"
generate corrosion 1024x1024 "A seamless, tileable, extreme close-up texture of copper corrosion and oxidation: green-blue verdigris, rust orange, dark brown pitting, and crusty mineral deposits, all mixed at a fine scale with no single focal point. Matte, slightly rough. No recognisable objects, no traces, no components. $square"
generate weave 1024x1024 "A seamless, tileable, extreme close-up texture of FR4 circuit-board fibreglass with the solder mask removed: a tight woven glass-fibre pattern in pale yellow-green and khaki, slightly translucent, with faint scorching at a few threads. Matte finish, uniform and regular with no focal point. No traces, no components, no holes. $square"

board="A top-down orthographic macro photograph of a densely routed printed circuit board, perfectly flat and parallel to the camera, no perspective and no tilt. Even, diffuse studio lighting with no specular hotspots and no vignette. Fine copper traces running in orderly bundles with 45-degree bends, many plated vias, thin silkscreen outlines, and small surface-mount resistors and capacitors distributed evenly across the whole board, with no single focal point and no big chip in the middle. Matte finish with subtle film grain. Strictly no text, no letters, no numbers, no logos, no large chips, no connectors, no hands, no tools, no reflections. The image must fill the frame edge to edge with no border. Aspect ratio 3:2, landscape, 1536x1024."
generate board-1 1800x "$board Dark green solder mask."
generate board-2 1800x "$board Black solder mask with silver traces."
# board-0.webp is the original hand-made substrate photo and is not regenerated.
