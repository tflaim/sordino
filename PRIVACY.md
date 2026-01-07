# Privacy Policy

**Effective Date:** January 6, 2026
**Last Updated:** January 6, 2026

## Overview

Sordino is a browser extension that helps you focus by soft-blocking distracting websites. Your privacy is fundamental to how we built this extension.

**The short version:** Sordino does not collect, transmit, or share any of your data. Everything stays on your device.

## Data Collection

**We do not collect any data.** Specifically:

- No personal information
- No browsing history
- No analytics or telemetry
- No usage statistics sent to external servers
- No cookies or tracking pixels
- No third-party integrations

## Data Storage

Sordino stores the following data **locally on your device only**:

- Your blocked site list and categories
- Schedule configurations
- Bypass usage (resets daily)
- Daily/weekly statistics (blocks triggered, bypasses used)

This data is stored using your browser's built-in storage API (`chrome.storage.local` / `browser.storage.local`) and never leaves your device.

## Data Sharing

**We do not share any data** because we do not have access to any data. There are:

- No external API calls
- No server-side components
- No third-party services
- No advertising networks

## Permissions Explained

Sordino requests the following permissions:

| Permission | Why It's Needed |
|------------|-----------------|
| `storage` | Save your settings locally on your device |
| `tabs` | Detect when you navigate to update blocking status |
| `activeTab` | Interact with the current tab to show/hide overlays |
| `alarms` | Check schedules periodically |
| `<all_urls>` | Block any website you configure (you control which sites) |

The `<all_urls>` permission is required because Sordino needs to work on any site you choose to block. **We do not monitor, log, or transmit your browsing activity.**

## Open Source

Sordino is open source. You can review the complete source code at:
https://github.com/tflaim/sordino

## Changes to This Policy

If we ever change this privacy policy, we will update the "Last Updated" date above. Given our commitment to collecting zero data, we don't anticipate significant changes.

## Contact

If you have questions about this privacy policy, please open an issue on GitHub:
https://github.com/tflaim/sordino/issues

---

**Summary:** Sordino runs entirely on your device. We don't collect data, we don't want your data, and we've built the extension so we can't access your data even if we wanted to.
