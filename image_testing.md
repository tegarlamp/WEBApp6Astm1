# Image Integration Testing Playbook

- Use base64-encoded images for all tests and requests.
- Accepted image formats: JPEG, PNG, WEBP only.
- Do not use SVG, BMP, HEIC, or other formats.
- Do not upload blank, solid-color, or uniform-variance images.
- Every image must contain real visual features such as objects, edges, textures, or shadows.
- If an image is not PNG/JPEG/WEBP, transcode it to PNG or JPEG before upload and re-detect MIME after transformation.
- For animated GIF/APNG/WEBP, extract the first frame only.
- Resize large images to reasonable bounds.
