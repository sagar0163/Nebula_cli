---
description: Cloud AI Fallback Strategy & Environment Loading
---

# Problem
1.  **Environment Variables**: When running `nebula` from a project subdirectory (e.g., `~/projects/foo`), `dotenv` was looking for `.env` in that subdir, failing to load API keys.
2.  **Fallback Loop**: When Cloud AI failed due to missing keys, the logic defaulted back to Local AI, creating a confusing failure loop or silent exit.

# Solution: `env-loader.js` & Smart Fallback
We introduced a dedicated loader and stricter fallback logic.

## 1. Global Environment Loader
`src/utils/env-loader.js` explicitly resolves the `.env` file from the Nebula installation root.

```javascript
// src/utils/env-loader.js
const rootDir = join(__dirname, '../../'); 
const envPath = join(rootDir, '.env');
dotenv.config({ path: envPath });
```
This is imported **first** in `src/index.js` to ensure keys like `GROQ_API_KEY` are available immediately.

## 2. Priority Queue (Ollama -> Groq -> Gemini)
In `src/services/ai.service.js`, the `getFix` method now uses a "Skip Local" flag to prevent circular retries.

```javascript
// Flow:
// 1. UniversalPredictor tries Vector Memory.
// 2. If miss, asks AI Service.
// 3. AI Service tries Cloud (Groq/Gemini) if configured.
// 4. Fallback to Local (Ollama) ONLY if 'skipLocal' is NOT set.
```

In `UniversalPredictor`, we now explicitly pass `skipLocal: true` when we know we want to force Cloud AI or fail fast, preventing the "Local AI -> Fail -> Local AI" loop.

## 3. Verification
Run `nebula predict` from any deep subdirectory. It should:
1.  Read `.env` from Nebula root.
2.  Use Groq/Gemini if keys are present.
3.  Fail clearly if keys are missing (without retrying Ollama).
