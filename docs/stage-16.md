# Stage 16 — Images and Figma Exports

**Goal:** Make screenshots, diagrams, and design exports searchable through descriptions from a local vision model.

**Status:** Not started

**Prerequisites:** Stages 10 and 12.

**Decision:** [0012 Image understanding](decisions/0012-image-understanding.md)

## Tasks

1. Add `VISION_PORT` with `describeImage`, implement it in the Ollama adapter (`modules/inference/adapters/ollama/`), and add the runtime to health. Config: `VISION_MODEL` (default `qwen2.5vl:7b`), `VISION_MAX_EDGE_PX`, `VISION_TIMEOUT_MS`. Update decision 0005 with the third model.
2. `VisionService` (runtime-agnostic): vision identity `<runtime>/<model>` plus prompt version, timeout, no retries beyond the inference policy, no fallback.
3. Image preparation in the worker pool: validate magic bytes, decode, scale to `VISION_MAX_EDGE_PX`, rasterize SVG and extract its `<text>` nodes. Pin an image library (candidate `sharp`).
4. Fixed prompt asking for a short description, visible text verbatim, and UI elements (fields, buttons, states, roles). The image content cannot change the prompt.
5. Chunks: `content_kind = 'image_description'`, locator `image` (frame or file name), `title` from the file or frame name. Unchanged detection includes the vision identity.
6. Figma:
   - PNG, JPG, WebP, SVG exports use the path above; PDF exports use Stage 12.
   - A Figma JSON export is parsed structurally (pages, frames, text layers, component names), one chunk per frame, no vision call.
7. Embedded images from DOCX (Stage 14) and scanned PDF pages (Stage 12, if page rendering is added) use the same path.
8. Eval: synthetic UI screenshots and a synthetic Figma JSON export with questions about screens, fields, and roles.

## Tests

- Fake `VISION_PORT` in specs; runtime names and shapes only in adapter specs.
- Unchanged image is never described twice; changing `VISION_MODEL` re-describes.
- Missing vision model fails image files with a clear reason and no fallback.
- Prompt-injection text inside an image does not change behavior.
- Figma JSON fixture yields one chunk per frame with its text.

## Definition of Done

- Design exports and screenshots answer questions with image citations, using only local models.
