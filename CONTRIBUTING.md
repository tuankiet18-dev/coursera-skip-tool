# Contributing to Coursera Skip & Learning Assistant 🤝

Thank you for your interest in contributing to **Coursera Skip**! We welcome contributions from developers, designers, and students of all experience levels.

This project is committed to providing a **100% clean, transparent, and open-source** utility to help learners save time while navigating Coursera courses safely.

---

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [How Can I Contribute?](#-how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Adding Translations (i18n)](#adding-translations-i18n)
  - [Code Contributions](#code-contributions)
- [Local Development Setup](#-local-development-setup)
- [Project Architecture](#-project-architecture)
- [Strict Security & Safety Guidelines](#-strict-security--safety-guidelines)
- [Git Workflow & Commit Guidelines](#-git-workflow--commit-guidelines)
- [Submitting a Pull Request (PR)](#-submitting-a-pull-request-pr)

---

## 📜 Code of Conduct

Please treat everyone with respect, kindness, and empathy. Be constructive in issues, discussions, and code reviews. Harassment or disrespectful behavior will not be tolerated.

---

## 💡 How Can I Contribute?

### Reporting Bugs
If you encounter a bug or if Coursera's DOM/API changes:
1. Check existing [Issues](https://github.com/tuankiet18-dev/coursera-skip-tool/issues) to see if it has already been reported.
2. If not, open a new **Bug Report** including:
   - Your browser name and version (e.g., Chrome 128, Edge 127).
   - Coursera course name / slug and lesson type (Video / Reading).
   - Steps to reproduce the issue.
   - Any error messages in the Console (`F12` -> `Console`).

### Suggesting Features
Have an idea to make the tool faster or friendlier?
- Open an issue with the `enhancement` label.
- Clearly describe the feature and why it would benefit other learners.

### Adding Translations (i18n)
We want to support learners worldwide!
- Language dictionaries live inside [`popup.js`](./popup.js) in the `I18N` object.
- You can contribute translations for Spanish, French, Hindi, Chinese, etc., by adding a new language key to `I18N`.

---

## 🛠 Local Development Setup

No complex build steps or node_modules required! This is a pure, vanilla WebExtensions project:

1. **Fork and Clone the repo:**
   ```bash
   git clone https://github.com/tuankiet18-dev/coursera-skip-tool.git
   cd coursera-skip-tool
   ```

2. **Load into your Chromium browser:**
   - Open Chrome / Brave / Edge / Opera and navigate to `chrome://extensions/`.
   - Enable **Developer mode** (toggle switch in the top-right corner).
   - Click **Load unpacked** (Tải tiện ích chưa đóng gói).
   - Select the repository root folder containing `manifest.json`.

3. **Make changes and test:**
   - Whenever you edit `popup.html`, `popup.js`, or `content.js`, click the **Reload 🔄** button on the extension card in `chrome://extensions/` to apply changes immediately.

---

## 🏗 Project Architecture

```
coursera-skip-tool/
├── manifest.json      # Manifest V3 configuration & permissions
├── popup.html         # Modern dark glassmorphism popup UI
├── popup.js           # UI logic, i18n switcher, and event handlers
├── content.js         # Injected script communicating with Coursera page
├── background.js      # Background service worker
├── icon.png           # Extension icon
├── PRIVACY.md         # Transparent privacy policy
└── README.md          # Documentation & store badges
```

- **`content.js`**: Runs in the context of the active Coursera page. It detects lesson types, extracts authentication tokens from Coursera cookies/local storage, and interacts with Coursera's completion endpoints.
- **`popup.js`**: Sends messages to `content.js` and manages the visual progress feedback, error alerts, and language switches.

---

## 🔒 Strict Security & Safety Guidelines

> [!IMPORTANT]
> **Zero Tolerance for Malicious Code or Data Collection:**  
> This project was created specifically to replace malicious extensions circulating online. We hold absolute integrity:
> - **NO external network requests** to third-party tracking or analytics servers.
> - **NO cookie stealing or credential logging**.
> - **NO code obfuscation** or minification without source. All code must remain clean, human-readable vanilla JavaScript.
> Any PR that violates these security principles will be immediately closed and reported.

---

## 🌿 Git Workflow & Commit Guidelines

We use **Conventional Commits** to keep commit history clean and informative:

- `feat:` A new feature (e.g., `feat: add Spanish language support`)
- `fix:` A bug fix (e.g., `fix: handle Coursera updated completion API`)
- `docs:` Documentation changes (e.g., `docs: update installation instructions`)
- `style:` Formatting, UI polish, or CSS tweaks (e.g., `style: improve button hover shadow`)
- `refactor:` Code restructuring without changing user-facing behavior

### Recommended Steps:
1. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Commit your changes with clear messages:
   ```bash
   git commit -m "feat: your meaningful description"
   ```
3. Push to your fork and submit a Pull Request.

---

## 🚀 Submitting a Pull Request (PR)

1. Ensure the extension loads without syntax errors in `chrome://extensions/`.
2. Test both Single Lesson completion and Bulk completion on a live Coursera course.
3. Test that the language switcher functions correctly.
4. Submit your PR against the `main` branch with a concise summary of changes.

Thank you for helping make Coursera learning faster, cleaner, and safer for everyone! ⭐
