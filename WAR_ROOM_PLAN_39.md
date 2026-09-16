# Issue 39 Plan
- [x] Add npx / instant mode detection and --persist flag parsing in src/index.js
- [x] Skip memory/vector initialization and use in-memory context for instant mode
- [x] Default to Ollama/free-tier for instant mode if no config exists
- [x] Show one-time prompt about 'nebula setup' in instant mode
- [x] Gracefully degrade error healing and vector matching in instant mode
- [x] Write unit tests / verify functionality works as expected
