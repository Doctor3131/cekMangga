# cekMangga mobile app specification

## Goal

Provide an Indonesian-language, Android-focused Expo app that lets a user select or capture one mango photo, review it, and request a real classification from the FastAPI service. Never fabricate results.

## User flow

Home → camera or gallery → validated preview → analysis → classification or actionable status. Camera denial leaves gallery available; permanently denied camera permission offers Settings. Picker cancellation returns silently. Preview supports replacement. “Coba Lagi” retries the same image only when tapped; “Scan Lagi” resets the flow. Leaving/resetting a pending analysis invalidates its response.

## Image requirements

- Accept JPEG and PNG only, maximum 10 MB.
- Validate before preview and before sending. Explain invalid format/size and allow replacement.
- Use the system camera capture and image picker; no custom live preview.

## API

- `POST {EXPO_PUBLIC_API_URL}/predict`, multipart field `file`.
- Production URL must use HTTPS. Never include a fake/default endpoint.
- Success requires valid JSON containing `label` exactly `Matang` or `Busuk`; malformed or unknown responses are errors.
- Handle HTTP 503 `{ "code": "model_not_loaded" }` distinctly from network, other server, and invalid-response errors.
- Abort after 30 seconds. No automatic retries.

## Interface and accessibility

- Minimal, spacious, nature-inspired green palette with rounded cards/buttons.
- Indonesian UI; system sans-serif; safe-area-aware responsive layout.
- At least 44×44 pt targets, WCAG AA text contrast, accessible labels, and text alongside status visuals; avoid color-only meaning.
- Results show only Matang/Busuk (no probability or uncertainty score) plus a small visual-detection/food-safety disclaimer.

## Out of scope

Backend/model implementation or training, mock predictions, history/persistence, accounts, and database.
