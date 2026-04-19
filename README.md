# ShadowCursor

ShadowCursor is an open-source Chrome extension that turns spoken intent into guided UI assistance for browser-based consoles and dashboards.

It combines:

- a keyboard-triggered voice capture flow
- a screenshot of the active tab
- a lightweight DOM snapshot of visible interactive elements
- an LLM response that either answers the user or proposes UI steps

The current implementation is designed for supervised automation. It highlights targets, asks for confirmation step-by-step, and stores resumable action sessions per tab.

## Current Status

This repository reflects the code that ships today.

- Trigger mode: `Cmd+Shift+K` on macOS, `Ctrl+Shift+K` on Windows/Linux
- Runtime model: answer mode or guided action mode
- Execution model: confirmation-first, resumable sessions
- Extension platform: Chrome Manifest V3

Some earlier product notes described right-click gesture triggers. Those are not part of the current implementation.

## Features

- Record a spoken request from the current page
- Show live transcript feedback while recording
- Stop automatically on silence or manually with keyboard controls
- Capture a screenshot and a DOM summary for multimodal reasoning
- Route requests to Anthropic or OpenAI with user-supplied keys
- Return either:
  - an explanation card for informational questions
  - a step-by-step action plan for interactive tasks
- Animate a ghost cursor and highlight candidate targets
- Persist and resume in-progress action sessions across navigation

## Architecture

```text
manifest.json                  Extension manifest and permissions
webpack.config.js              Bundles the extension into dist/

src/
  background/
    service-worker.ts          Main orchestrator for screenshots, transcript resolution, and LLM routing
    context-assembler.ts       Builds the multimodal prompt payload
    llm-router.ts              Calls Anthropic, OpenAI, or an optional managed proxy
    auth.ts                    Placeholder auth helpers

  content/
    index.ts                   Content script entry point
    trigger.ts                 Keyboard shortcut trigger and capture lifecycle
    voice-capture.ts           MediaRecorder + Web Speech transcription
    dom-scraper.ts             Visible interactive DOM extraction
    action-executor.ts         Step confirmation and action execution
    shadow-cursor.ts           Cursor animation overlay
    highlighter.ts             Target highlight overlay
    answer-card.ts             Explanation-only response UI
    step-approval-card.ts      Per-step review UI
    recording-indicator.ts     In-page voice capture UI
    loading-indicator.ts       Waiting / thinking UI

  popup/
    popup.html
    popup.ts

  options/
    options.html
    options.ts

  shared/
    types.ts                   Shared message and data contracts
    constants.ts               Models, URLs, defaults, timing constants
    storage.ts                 chrome.storage wrappers
    messaging.ts               Typed extension messaging helpers
```

## Runtime Flow

1. The user presses the keyboard shortcut.
2. The content script starts microphone capture and live transcript display.
3. When capture ends, the content script sends:
   - raw audio
   - transcript
   - DOM snapshot
   - page URL and title
4. The background service worker captures a screenshot of the tab.
5. The service worker optionally upgrades the transcript with external STT if configured.
6. The assembled context is sent to the configured LLM provider.
7. The provider returns either:
   - `mode: "answer"` for explanation-only output
   - `mode: "action"` for a supervised action plan
8. The content script renders the result and, for action plans, confirms and executes each step.

## Configuration

User configuration is stored with `chrome.storage.sync`.

Available settings include:

- LLM mode: BYOK or managed proxy
- LLM provider: Claude or OpenAI
- LLM API key
- speech-to-text provider
- speech-to-text API key
- auto-execute preference
- destructive action confirmation preference
- trigger mode

## Development

### Prerequisites

- Node.js 18+
- npm
- Chrome with Developer Mode enabled

### Install

```bash
npm install
```

### Build

```bash
npm run dev
```

or

```bash
npm run build
```

### Load the extension

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Choose `Load unpacked`
4. Select the `dist/` directory

### Test

```bash
npm test
```

Note: the current Jest setup expects `jest-environment-jsdom`. If tests fail in a fresh environment, install the missing dependency or update the Jest config before publishing releases.

## Security And Privacy

ShadowCursor handles sensitive page context. Before using it on production systems, review these implications carefully.

- The extension can read the current page DOM and capture screenshots of the active tab.
- Spoken prompts, screenshots, and DOM summaries may be sent to third-party AI providers.
- API keys entered in the extension are stored in Chrome extension storage, not in source control.
- This repository does not require a `.env` file for normal local development.
- Do not commit real API keys, screenshots, session exports, or console recordings.
- Review permissions and host access before publishing a browser store build.

If you plan to use this extension on internal, regulated, or customer environments, consider adding:

- host allowlisting instead of `<all_urls>`
- stricter redaction before LLM requests
- an enterprise-safe audit trail
- stronger controls around destructive action execution
- encrypted secret handling beyond default extension storage

See [SECURITY.md](SECURITY.md) for disclosure guidance.

## Open-Source Readiness Notes

This repo has been documented to reflect the current code rather than older product assumptions.

- No production API keys are included
- No local environment files are tracked
- Build output is ignored
- Local agent and IDE state should remain untracked
- Public documentation avoids claiming triggers or behaviors that are not currently implemented

## MIT License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
