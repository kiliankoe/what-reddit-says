![What Reddit says](assets/icon-256.png)
# What Reddit says
Web Extension: Easily find Reddit discussions about the page you're browsing.

![Screenshot](assets/screenshot.png)

## About
Dead-simple yet very useful web extension that looks for threads on [Reddit](https://www.reddit.com) via Reddit's JSON API. Forked from the "What Hacker News Says" extension. For your privacy and general browser performance this extension fetches the API only when the popup is clicked and does not run any background script. It also requires minimum permissions (just `activeTab` and accessing reddit.com).

## Install
Currently available as an unpacked extension for local development. Clone this repo and manually load it in your browser:

- **Chrome/Chromium**: Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the repository folder.
- **Firefox**: Go to `about:debugging`, click "This Firefox", click "Load Temporary Add-on", and select the `manifest.json` file.

## Changelog
See [CHANGELOG.md](CHANGELOG.md).

## License
© 2020 Pino Ceniccola, © 2025 Kilian Koeltzsch. MIT License.
