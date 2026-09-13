# Battlefield art prompts

Every sector's board is generated procedurally. `src/substrate.ts` paints the background from a seeded recipe: solder-mask colour drifts from teal through blue, violet and crimson to charcoal, and routing density, component count, silkscreen, corrosion, exposed fibreglass and glowing cracks all scale continuously from sector 000 to 999. Sprites for enemies, installations, the core and ports are SVG in `src/art.ts`. Nothing is a fixed, hand-placed scene.

Image models are still useful for **raw material**: small textures that the painter tiles, mirrors, crops, rotates and blends per seed. Each is optional. The painter draws a procedural stand-in when a file is missing, so you can add them one at a time and the game never breaks.

## Automatic generation with Codex

If the Codex CLI is installed and logged in, one command generates every texture below through its image tool and drops them in place:

```sh
scripts/generate-textures.sh          # skips files that already exist
scripts/generate-textures.sh --force  # regenerate everything
```

Each image takes about a minute. The manual prompts below produce the same files by hand.

## Where the output goes

| Prompt  | Save the download as             | How the game uses it                                                            |
| ------- | -------------------------------- | ------------------------------------------------------------------------------- |
| 1       | `public/textures/grain.webp`     | Mirrored into a seamless tile, blended over the solder mask on every sector.    |
| 2       | `public/textures/scratches.webp` | Screened at low opacity with a random rotation; stronger in deep sectors.       |
| 3       | `public/textures/corrosion.webp` | Multiplied inside corrosion patches from sector 300 onward.                     |
| 4       | `public/textures/weave.webp`     | Shows through burnt-off mask patches from sector 550 onward.                    |
| 5       | `public/textures/board-1.webp`   | Cropped, zoomed and flipped per seed, screened faintly for photographic detail. |
| 5 again | `public/textures/board-2.webp`   | Same, for variety.                                                              |

`public/textures/board-0.webp` is the original hand-made substrate photo, used the same way as prompts 5.

No code change is needed. Run `npm run dev`, then reload the page after dropping a file in. To check deep sectors, open Settings, enable developer mode, and jump between sectors.

Downloads are PNG; convert them to WebP with ImageMagick so the game finds them and the bundle stays small:

```sh
convert ~/Downloads/grain.png -resize 1024x -quality 85 public/textures/grain.webp
```

## How to use the prompts

Copy one block in full and paste it as a single message to Nano Banana in the Gemini web app. Download the result and save it under the name above. Each prompt is self-contained; none of them needs an attachment.

If a result has text, a border, a big object in the middle, or a visible lighting gradient, reply "Regenerate with the same settings but remove the [text / border / gradient]" instead of starting over.

## Prompt 1: solder-mask grain

```
I am making a browser tower-defense game set on a computer circuit board. The board backgrounds are drawn procedurally by code, and I need small texture images the code can tile and blend. This one is the surface grain of the solder mask, the thin coloured lacquer on a circuit board. The code will mirror-tile it and blend it at 30% opacity in overlay mode, so it must be a flat, neutral texture with no colour and no features.

Generate: a seamless, tileable, extreme close-up texture of matte solder-mask lacquer on a circuit board. Neutral mid-grey, no colour tint. Fine irregular micro-grain, a faint orange-peel surface, very subtle random mottling. Perfectly even lighting with no gradient from one side to the other, no highlights, no shadows, no vignette.

Strictly no traces, no components, no holes, no text, no logos, no border, no frame. The texture must fill the frame edge to edge. Square, 1:1 aspect ratio.
```

## Prompt 2: scratches and dust

```
I am making a browser tower-defense game set on a computer circuit board. The board backgrounds are drawn procedurally by code, and I need small texture images the code can tile and blend. This one is a wear layer of scratches and dust. The code will mirror-tile it, rotate it randomly, and blend it in screen mode at low opacity, so the marks must be light on a pure black background: everything black disappears, everything light shows as wear.

Generate: a seamless, tileable, extreme close-up texture of fine scratches, hairline scuffs, and small dust specks on a dark surface. Pure black background. Marks are thin, light grey to white, of varied length and random direction, with a few clusters of tiny dust particles. Sparse overall: most of the image stays black.

Strictly no colour, no lighting gradient, no large shapes, no text, no logos, no border, no frame. The texture must fill the frame edge to edge. Square, 1:1 aspect ratio.
```

## Prompt 3: corrosion

```
I am making a browser tower-defense game set on a computer circuit board. The board backgrounds are drawn procedurally by code, and I need small texture images the code can tile and blend. This one is corrosion for damaged boards deep in the game. The code will mirror-tile it and multiply it inside small circular patches, so it must be a dense, evenly distributed texture with no single focal point and no lighting gradient.

Generate: a seamless, tileable, extreme close-up texture of copper corrosion and oxidation: green-blue verdigris, rust orange, dark brown pitting, and crusty mineral deposits, all mixed at a fine scale. Matte, slightly rough. Even lighting with no highlights, no shadows, no vignette.

Strictly no recognisable objects, no traces, no components, no text, no logos, no border, no frame. The texture must fill the frame edge to edge. Square, 1:1 aspect ratio.
```

## Prompt 4: fibreglass weave

```
I am making a browser tower-defense game set on a computer circuit board. The board backgrounds are drawn procedurally by code, and I need small texture images the code can tile and blend. This one is the bare fibreglass substrate that shows where the solder mask has burned off on the most damaged boards. The code will mirror-tile it and clip it into small irregular patches, so it must be a uniform, regular weave with no focal point and no lighting gradient.

Generate: a seamless, tileable, extreme close-up texture of FR4 circuit-board fibreglass with the solder mask removed: a tight woven glass-fibre pattern in pale yellow-green and khaki, slightly translucent, with faint scorching at a few threads. Matte finish. Even lighting with no highlights, no shadows, no vignette.

Strictly no traces, no components, no holes, no text, no logos, no border, no frame. The texture must fill the frame edge to edge. Square, 1:1 aspect ratio.
```

## Prompt 5: board photograph for background detail

```
I am making a browser tower-defense game set on a computer circuit board. The board backgrounds are drawn procedurally by code, and I need a photograph the code can crop into random pieces, zoom, flip, and blend very faintly under its own drawing. Because only small random crops are used, the image should be uniformly detailed everywhere, with no single focal point, no big chip in the middle, and no lighting gradient from one side to the other.

Generate: a top-down orthographic macro photograph of a densely routed printed circuit board, perfectly flat and parallel to the camera, no perspective and no tilt. Even, diffuse studio lighting with no specular hotspots and no vignette. Fine copper traces running in orderly bundles with 45-degree bends, many plated vias, thin silkscreen outlines, and small surface-mount resistors and capacitors distributed evenly across the whole board. Dark solder mask. Matte finish with subtle film grain.

Strictly no text, no letters, no numbers, no logos, no large chips, no connectors, no hands, no tools, no reflections. The image must fill the frame edge to edge with no border. Aspect ratio 3:2, landscape.
```

Run this prompt twice for `board-1.webp` and `board-2.webp`. Vary one phrase between runs, such as "green solder mask" or "black solder mask", so the two crops differ.

## Licensing note

Google's terms let you use generated images in your own project. Outputs carry an invisible SynthID watermark, which is harmless here. The README credits generated textures as AI-generated; keep that line accurate as you add more.
