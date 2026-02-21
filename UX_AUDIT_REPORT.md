# Nebula-CLI UX Audit Report

## Executive Summary

This report evaluates the nebula-cli project through the lens of three distinct user personas. The CLI has strong foundational features but suffers from significant onboarding friction that prevents rapid adoption.

---

## 🎭 Persona 1: The "Newbie" (Junior Dev)

**Goal:** Get started in under 5 minutes. Wants to type a command and see magic.

### Installation Journey

| Step | Attempt | Outcome |
|------|---------|---------|
| `npm install -g @sagar/nebula-cli` | ❌ Failed | Package not published to npm |
| `npm install -g sagar0163/nebula-cli` | ❌ Failed | SSH auth error (no key) |
| `npm install -g https://github.com/...` | ❌ Failed | Still tried SSH |
| Clone + npm link | ✅ Success | Finally works! |

**Time to Hello World:** ~8 minutes (with prior CLI knowledge)

### Issues Encountered

1. **Installation friction:** README suggests `npm install -g sagar0123/nebula-cli#v5.1.0` but package isn't on npm
2. **Wrong username:** README says `sagar0123` but repo is `sagar0163`
3. **No npm link example:** For local installation
4. **SSH fallback:** npm defaults to SSH for GitHub, fails without keys

### What Worked
- `nebula --help` works immediately after installation
- `nebula status` works without API keys
- Visual output is colorful and appealing

### What Confused Me
- "What are the prerequisites?" - Not clear until I hit errors
- "Do I need API keys?" - Unclear from quick start
- "What can I actually run?" - Help doesn't show all commands

### Score: 4/10

---

## 🎭 Persona 2: The "Power User" (Senior Architect)

**Goal:** Automate everything. Needs exit codes, flags, CI integration.

### Evaluation

| Criteria | Finding | Score |
|----------|---------|-------|
| Exit codes | ✅ `nebula --invalid-flag` returns 1 | 9/10 |
| Flags | ✅ `-v`, `-q`, `-c`, `-h` all work | 9/10 |
| Quiet mode | ✅ Suppresses banner | 9/10 |
| CI/CD ready | ❌ No Docker image, no binary releases | 5/10 |
| Error output | ⚠️ Mixes dotenv debug with actual output | 6/10 |

### What Impressed
```bash
nebula --quiet status  # Clean output
echo $?                # Returns 1 on error
```

### What Frustrated
- **Dotenv spam:** Every command shows `[dotenv@17.2.3] injecting env...` - overwhelming!
- **No machine-readable output:** Can't parse JSON for automation
- **No `--version` flag:** Can't script around it easily

### Score: 6/10

---

## 🎭 Persona 3: The "Troubleshooter"

**Goal:** Break things on purpose. Wants error messages to help fix problems.

### Tests Performed

| Test | Input | Expected | Actual | Verdict |
|------|-------|----------|--------|---------|
| Unknown flag | `--invalid-flag` | Helpful error | ✅ Good message | ✅ Pass |
| Missing query | `ask` | Usage hint | ✅ "Usage: nebula ask..." | ✅ Pass |
| Missing config | `-c missing.env` | Clear error | ✅ "Config file not found" | ✅ Pass |
| No API keys | `ask "hello"` | Graceful fallback or clear error | ❌ TypeError crash | ❌ Fail |
| Dangerous command | `ask "rm -rf /"` | Blocked safely | ✅ Blocked | ✅ Pass |

### Critical Failure
```
nebula ask "hello"
# Result: TypeError: Cannot read properties of null (reading 'type')
```

This is a **crash**, not a helpful error. The user has no idea:
- Do they need an API key?
- Which API key?
- How to configure it?

### Score: 6/10

---

## 📊 Overall UX Score: 5.3/10

---

## 🚀 Quick Wins (Priority Order)

### 1. Fix Installation (Impact: Critical)

```diff
- npm install -g sagar0123/nebula-cli#v5.1.0
+ # Option 1: From npm (publish first!)
+ npm install -g @sagar/nebula-cli
+
+ # Option 2: From GitHub
+ npm install -g github:sagar0163/nebula-cli
```

### 2. Reduce Dotenv Noise (Impact: High)

Add to top of `src/index.js`:
```js
// Suppress dotenv tips in production
process.env.DOTENV_TIP = 'off';
```

Or use quiet mode by default for non-verbose runs.

### 3. Add --version Flag (Impact: Medium)

```js
if (args.includes('--version')) {
  console.log('nebula-cli v' + pkg.version);
  process.exit(0);
}
```

### 4. Fix API Key Error (Impact: Critical)

In `src/services/project-analyzer.js`, wrap AI calls in try-catch:
```js
try {
  // AI logic
} catch (err) {
  console.error('❌ AI Error:', err.message);
  console.error('💡 To fix: Set GEMINI_API_KEY or GROQ_API_KEY in .env');
  process.exit(1);
}
```

### 5. Add Quick Start Section (Impact: High)

Add at top of README:
```markdown
## ⚡ 30-Second Quick Start

1. Install: `npm install -g @sagar/nebula-cli` (or see below)
2. Configure: Create `.env` with `GEMINI_API_KEY=your_key`
3. Run: `nebula ask "hello world"`

Don't have an API key? [Get free Gemini key](https://aistudio.google.com/app/apikey)
```

### 6. Add JSON Output Mode (Impact: Medium)

```bash
nebula --json status  # Machine readable
```

---

## 🎯 Long-Term Recommendations

1. **Publish to npm** - Critical for discoverability
2. **Add Docker image** - `docker run nebula-cli ...`
3. **Add shell completions** - `nebula completion bash`
4. **Create onboarding wizard** - `nebula init`
5. **Add --dry-run flag** - Preview without executing

---

## 📋 Issues Found (GitHub)

| Issue | Description | Priority |
|-------|-------------|----------|
| #19 | Package not published to npm | Critical |
| #20 | README installation instructions wrong (sagar0123 vs sagar0163) | Critical |
| #21 | dotenv tips spam stdout on every command | High |
| #22 | API key errors crash instead of helpful message | Critical |
| #23 | No --version flag | Medium |
| #24 | No JSON output mode | Medium |

---

*Audit conducted on: 2026-02-21*
*Version tested: 5.4.0*
