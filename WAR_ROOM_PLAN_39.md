# Issue 39 Plan
- [x] Add npx / instant mode detection and --persist flag parsing in src/index.js
- [ ] Skip memory/vector initialization and use in-memory context for instant mode
- [ ] Default to Ollama/free-tier for instant mode if no config exists
- [ ] Show one-time prompt about 'nebula setup' in instant mode
- [ ] Gracefully degrade error healing and vector matching in instant mode
- [ ] Write unit tests / verify functionality works as expected
