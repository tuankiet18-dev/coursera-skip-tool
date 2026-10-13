<div align="center">
  <h1>Coursera Skip Video &amp; Reading</h1>
  <p><strong>A free, open-source browser extension that streamlines Coursera: complete videos and readings, handle discussions and peer reviews, and optionally get AI help on quizzes with your own API key.</strong></p>
  <p>
    <a href="https://chromewebstore.google.com/detail/coursera-skip-video-read/jjbgneddmjkolgmpamecbhfgjgdiajlf">Install</a> ·
    <a href="https://tuankiet18-dev.github.io/coursera-skip-privacy/guide.html">User guide</a> ·
    <a href="https://tuankiet18-dev.github.io/coursera-skip-privacy/">Privacy policy</a> ·
    <a href="https://github.com/tuankiet18-dev/coursera-skip-tool/issues">Report a bug</a>
  </p>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.6.0-blue.svg" alt="Version">
  <a href="https://chromewebstore.google.com/detail/coursera-skip-video-read/jjbgneddmjkolgmpamecbhfgjgdiajlf">
    <img src="https://img.shields.io/badge/Chrome_Web_Store-Install-success?logo=googlechrome&logoColor=white" alt="Chrome Web Store">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  </a>
</p>

<p align="center">
  <img src="./screenshot-main.png" alt="Coursera Skip popup on an active lesson" width="750">
</p>

> [!IMPORTANT]
> This is an independent project, **not affiliated with, authorized or endorsed by Coursera**. Using it may violate Coursera's [Terms of Use](https://www.coursera.org/about/terms) and [Honor Code](https://www.coursera.org/about/terms/honorcode). Coursera states that work produced with AI tools can lead to course failure or account deactivation. You are solely responsible for how you use it. See [Disclaimer](#disclaimer).

## Features

| Feature | What it does |
|---|---|
| **Complete Current Lesson** | Marks the open video or reading as completed. On a discussion prompt, posts a short reply. |
| **Complete All Video &amp; Reading** | Bulk-completes every video and reading in the course (with a confirmation prompt first). |
| **Complete All Discussions** | Posts a reply on each discussion prompt, skips ones it already posted, and reports exactly why any item failed. |
| **Auto Grade Peer Review** | Fills in a peer review's rubric and comments. You review it and submit it yourself. |
| **AI Auto-Answer Quiz** *(optional)* | Sends the quiz questions to an AI provider using **your own API key** (Gemini, OpenAI or Groq), selects the answers and highlights Submit. You verify, accept the Honor Code and submit yourself. |
| **Floating widget + popup** | The same actions are available from a draggable in-page widget and from the toolbar popup. |
| **English / Vietnamese** | One-click language switch. |

### Privacy by design

- **No server of our own.** The extension never sends your data to the author.
- API keys and settings stay in your browser's local storage.
- When you use AI, questions go directly from your browser to the provider you picked.
- Full details: [Privacy Policy](https://tuankiet18-dev.github.io/coursera-skip-privacy/).

## Install

### Chrome Web Store (recommended)

[**Install from the Chrome Web Store**](https://chromewebstore.google.com/detail/coursera-skip-video-read/jjbgneddmjkolgmpamecbhfgjgdiajlf)

> [!NOTE]
> New extensions from new developer accounts can trigger Chrome's "Proceed with caution" prompt. The full source is in this repository so you can inspect it yourself.

### From source (developer mode)

1. Clone or download this repository and extract it.
2. Open `chrome://extensions/` in Chrome, Edge, Brave or another Chromium browser.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the repository folder (the one that contains `manifest.json`).

## Usage

1. Sign in to Coursera and open a lesson in a course you are **enrolled in**.
2. The widget appears at the bottom-right of the page, or click the extension icon for the popup.
3. Pick an action. Read the [user guide](https://tuankiet18-dev.github.io/coursera-skip-privacy/guide.html) for what each button does, how to set up AI keys, and how to fix common errors (503 overload, 429 quota, 401/403 key errors, and more).

## Development

```bash
# Run the simulation test suite (no browser needed)
node test_simulation.js
```

- `content.js`: in-page logic, floating widget and the Coursera API helpers
- `background.js`: service worker that proxies AI provider calls
- `popup.html` / `popup.js`: toolbar popup
- See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and guidelines.

Contributions are welcome: bug fixes, translations, docs. Open an [issue](https://github.com/tuankiet18-dev/coursera-skip-tool/issues) or a [pull request](https://github.com/tuankiet18-dev/coursera-skip-tool/pulls). When reporting a bug, include the lesson type, the message shown, and the `[CourseraSkip]` lines from the browser console (with personal information removed).

## Support the project

It is free and stays free. If it saved you time:

- Star this repository.
- [Support the author on Ko-fi](https://tuankiet18-dev.github.io/coursera-skip-privacy/donate.html) (optional).

## Disclaimer

1. **Non-affiliation.** Coursera and related marks are trademarks of Coursera Inc. This project is not associated with, authorized by, or endorsed by Coursera Inc.
2. **Your responsibility.** You are solely responsible for complying with Coursera's Terms of Use and Honor Code and with your school's or employer's rules. The authors do not encourage academic dishonesty.
3. **Risk.** Using this software may lead to penalties such as account restrictions, course failure or loss of certificates. The authors are not liable for any such outcome.
4. **No warranty.** Provided "AS IS" under the [MIT License](./LICENSE), without warranty of any kind. Coursera can change its site at any time, which can break features without notice.
