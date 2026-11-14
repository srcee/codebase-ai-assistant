# 0012: Image understanding

Status: proposed (Stage 16)

## Context

Design exports, screenshots, and diagrams carry requirements that exist nowhere else as text: field labels, button states, role names in a matrix screenshot, flow arrows. They must become searchable text, with local inference only. Figma is used only through local exports (decision 0009).

## Decision

- **A local vision model describes each image.** One request returns a short description and the visible text verbatim. No separate OCR engine. The default model is `qwen2.5vl:7b` through Ollama, configured with `VISION_MODEL`.
- **New port `VISION_PORT`** (`describeImage(image, options)`), separate from `CHAT_PORT`, so the chat port stays text-only and runtimes without vision can still serve chat. The Ollama adapter implements it. Health reports the vision model like the other models, and a missing model fails image files with a clear reason, never a fallback.
- **Vision identity** is `<runtime>/<model>` plus a prompt version. It is stored with image chunks and is part of unchanged detection, so changing the model or prompt re-describes images.
- **Preparation runs in the parsing pool** (decision 0011). Images are checked, decoded, and scaled to at most `VISION_MAX_EDGE_PX` (default 1600) on the long edge. SVG is rasterized, and its `<text>` nodes are also kept as text. The HTTP call runs in the main thread.
- **Output is untrusted.** The description is stored as an `image_description` chunk and embedded like text. It is delimited in prompts like any other retrieved content, and text inside an image cannot change system policy.
- **Figma exports.** PNG, JPG, WebP, and SVG go through this path. PDF exports go through the PDF pipeline. A Figma JSON export (file or plugin output) is parsed structurally: one chunk per frame with its text layers and component names, no vision call.

## Consequences

- Image indexing is slow (seconds per image on a laptop GPU, more on CPU). Unchanged images are never described twice.
- Descriptions can be wrong. Citations point to the image so the user can check the original.
- Scanned PDF pages without a text layer can use this path once page rendering is available.
