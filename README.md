<div align="center">
  <h1>🚀 Coursera Automation Tool (Clean & Safe)</h1>
  <p><strong>A 100% safe, open-source browser extension to automate Coursera tasks. Skip videos, complete readings, and save time efficiently without any malicious code.</strong></p>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.4.0-blue.svg" alt="Version">
  <a href="https://chromewebstore.google.com/detail/coursera-skip-video-read/jjbgneddmjkolgmpamecbhfgjgdiajlf">
    <img src="https://img.shields.io/badge/Chrome_Web_Store-Install_1--Click-success?logo=googlechrome&logoColor=white" alt="Chrome Web Store">
  </a>
  <a href="https://chromewebstore.google.com/detail/coursera-skip-video-read/jjbgneddmjkolgmpamecbhfgjgdiajlf/reviews">
    <img src="https://img.shields.io/badge/Reviews-Rate_5★-gold" alt="Rate 5 Stars">
  </a>
  <img src="https://img.shields.io/badge/status-active-success.svg" alt="Status">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
</p>

<p align="center">
  <img src="./screenshot-main.png" alt="Coursera Automation Active Lesson" width="750">
</p>
<p align="center">
  <em>Live detection on active Coursera lecture with 1-click completion</em>
</p>

## 🌟 Introduction

This is the **completely safe, clean-rebuilt version** of the popular Coursera Automation / Skip extensions.

Unlike other versions circulating online that may contain harmful code (cookie stealing, data exfiltration), this repository provides a **transparent, from-scratch rewrite**. There are absolutely no hidden scripts, no remote tracking, and no cookie exfiltration. This tool is built by the community, for the community, ensuring your privacy and security.

## ✨ Features

- **📌 In-Page Floating Widget (New in v1.4.0):** An always-available floating widget injected directly into Coursera course pages via Shadow DOM. Never gets closed or interrupted when clicking outside. Features a draggable header, collapsible FAB badge (`⚡`), and remembers its position and state in `localStorage`.
- **⚡ Complete Current Lesson:** Instantly mark the currently opened Coursera video lecture or reading material as completed.
- **🚀 Complete All Video & Reading (Bulk):** Automatically detect, batch-process, and complete all video lectures and reading items across the entire course.
- **💬 Complete All Discussions (New in v1.4.0):** Batch-completes all mandatory discussion prompts across the course with rate-limit protection and automated response posting.
- **👥 Auto Peer Review:** 1-Click grading for peer-reviewed assignments. Automatically selects maximum rubric scores, inputs natural positive feedback comments, and highlights submit button.
- **⭐ Smart Review & Rating:** Easily support the project with a 5-star rating directly from within the extension.
- **🌐 Internationalization (i18n):** Full support for **English** and **Vietnamese (Tiếng Việt)** with a 1-click switcher `[🌐 EN | VI]` in both the floating widget and popup.
- **✨ Clean & Friendly UI/UX:** Streamlined dark theme with zero clutter, clean course name formatting, and an intuitive 3-step guide screen.
- **🔒 100% Secure & Open-Source:** Fully transparent code. Safe for your personal Coursera account.

## 🛠 Installation Guide

### Option 1: Official Chrome Web Store (Recommended - 1 Click)
👉 **[Click here to Install from Chrome Web Store](https://chromewebstore.google.com/detail/coursera-skip-video-read/jjbgneddmjkolgmpamecbhfgjgdiajlf)**

> [!NOTE]
> **Why do I see "Proceed with caution"?**  
> As a newly verified developer account, Chrome Enhanced Safe Browsing displays this precautionary prompt for all new extensions. Simply click **"Continue to install"**. Our entire extension is 100% open-source and publicly auditable here!

---

### Option 2: Manual Developer Mode (From Source)
1. Clone or download this repository as a `.zip` file and extract it.
2. Open your Chromium-based browser (Chrome, Edge, Brave, Opera, Arc) and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click the **Load unpacked** button.
5. Select the **`coursera-skip-tool` folder** containing `manifest.json`.
6. 🎉 You're all set!

## 📖 How to Use (Step-by-Step)

1. **Enroll** in your desired Coursera course.
2. **Open any page** in your course (e.g. `https://www.coursera.org/learn/{courseSlug}/...`).
3. **Use either the In-Page Floating Widget or the Toolbar Extension Popup:**
   - 📌 **In-Page Floating Widget**: Automatically appears in the bottom-right corner of any Coursera course page. You can drag it by the header, minimize it into a floating `⚡` badge, or keep it open while reading. Clicks elsewhere on the page will never interrupt its background operations!
   - 🧩 **Extension Popup**: Or click the extension icon in your browser toolbar anytime.
4. **Choose your desired automation action:**
   - ⚡ **Complete Current Lesson**: Instantly marks the active video, reading material, or discussion prompt as finished.
   - 🚀 **Complete All Video & Reading**: Batch processes and completes all video lectures & reading items across the entire course.
   - 💬 **Complete All Discussions**: Scans all discussion prompt assignments in the course and posts natural responses automatically.
   - 👥 **Auto Grade Peer Review**: When viewing a peer assignment, automatically grades with full marks and polite constructive feedback.
5. 🌐 **Language Switcher**: Click `[VI / EN]` anytime to switch interface language.

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><strong>Q: Why does the extension show "Ready to Automate / Follow 3 steps" instead of the complete buttons?</strong></summary>
<br>
The extension is designed to only activate when you are viewing an actual lesson page (such as a <strong>Video Lecture</strong> or <strong>Reading Material</strong>). Simply click into any lecture or reading item in your enrolled course, and open the extension popup again!
</details>

<details>
<summary><strong>Q: Why do I see a 403 / 401 Permission Error?</strong></summary>
<br>
Please make sure you are actively logged in and <strong>enrolled</strong> in the course on Coursera before running the tool.
</details>

## 💡 SEO & Helping the Community

If you find this tool helpful, please support us by:
- ⭐ **Starring** this repository on GitHub!
- 🔗 **Sharing** the link on Reddit (`r/coursera`, `r/learnprogramming`), Discord, or student communities.
- 🏷️ Adding relevant tags in GitHub settings (`coursera`, `coursera-skip-tool`, `automation`, `browser-extension`, `speed-learning`).

## 🤝 Contributing

Contributions of all kinds are welcome! Whether you are fixing a bug, adding a new language translation, or improving the documentation:

1. Check out our **[Contributing Guidelines (CONTRIBUTING.md)](./CONTRIBUTING.md)** for local development setup, code structure, and guidelines.
2. Feel free to open an [Issue](https://github.com/tuankiet18-dev/coursera-skip-tool/issues) or submit a [Pull Request](https://github.com/tuankiet18-dev/coursera-skip-tool/pulls).

## ⚖️ Disclaimer

This tool is created for educational and research purposes to demonstrate browser automation capabilities. Use it responsibly and in accordance with Coursera's terms of service.
