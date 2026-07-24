# Coursera Skip Video (Clean Version)

## 🌟 Introduction

This is a **completely safe rewritten (Clean Rebuild)** version of the "Coursera Skip Video" (or Coursera Tool) extension.

The original version of this extension was found to contain highly dangerous malicious code (specializing in account theft and remote control). Therefore, I have **rewritten the entire source code from scratch** in the root directory to provide automation features on Coursera in a **100% safe manner**. The new source code completely removes hidden code, does not collect cookies, and does not secretly send your data anywhere.

## 🚀 Key Features (Clean Version)

- **Auto Complete (Bypass/Skip):** Automatically skip and mark Coursera readings and videos as completed.
- **Auto Quiz:** Supports automatically solving quizzes.
- **Safe & Transparent:** Open-source, transparent, and completely free of malware or data theft behaviors.

## 📂 Repository Structure

This project is divided into two distinct parts:

### 1. Safe Part (Usable Source Code)
All files located in the **root directory** (such as `manifest.json`, `background.js`, `content.js`, `popup.html`, etc.) are **clean source code rewritten by me**. You can safely use this directory to load into your browser.

### 2. Security Analysis & Hacker's Malware (For Reference Only)
- ⚠️ **`build/` directory**: Contains the hacker's original source code (obfuscated). This code contains malware and is kept **strictly for security research and evidentiary purposes**. **ABSOLUTELY DO NOT** load this directory into your browser!
- `BUILD_FORENSIC_REPORT.md`: A detailed forensic report on data theft behaviors in the original version.
- `*decode*.js` files (`real_decode.js`, `decoder.js`, `correct_decode.js`...): Scripts created by me to reverse engineer and deobfuscate the hacker's malware to write the report.

## 🕵️‍♂️ About the Original Version (Malicious Version)

As detailed in the `BUILD_FORENSIC_REPORT.md` report, the original extension contains highly sophisticated malware:
- **Session Cookie Theft:** Automatically collects `CAUTH` and `CSRF3-Token`. Malicious actors can use this to hijack your Coursera account.
- **Personal Information Theft:** Steals email and `userId`.
- **Command and Control (C2) Network:** Continuously receives remote commands via the hacker's `metadata.json`.
- **API Key Leakage:** Secretly sends the user's API Key (Gemini) to the attacker's server.

> 💡 **Recommendation:** If you have ever used the hacker's original version from unverified sources, **log out of your Coursera account** immediately (to invalidate old cookies), change your password, and revoke any API Keys you have provided.

---

## 🛠 Installation Guide (Clean Version)

1. Download this entire repository to your machine.
2. Open Chrome / Edge browser, go to the Extensions Management page: `chrome://extensions/`.
3. Turn on **Developer mode** in the top right corner.
4. Click the **Load unpacked** button.
5. Select the **root directory** of this repository (absolutely do not select the `build` directory).
6. Done! The extension is now ready to be safely used on Coursera.
