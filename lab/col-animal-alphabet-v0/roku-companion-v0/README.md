# Col's Animal Alphabet — Roku receiver v0.1

**Scope:** isolated Roku SceneGraph launch-only proof. It displays a title and explicit *not paired* / *no video* warnings. **No network requests, pairing credentials, ECP commands, YouTube integration, media playback, or changes to existing Roku apps.**

## Installation preparation

1. Confirm which Roku TV will be the first test device and whether it already has a sideloaded app (Roku permits only one at a time).
2. Enable Roku developer mode using the **Roku remote**: Home ×3, Up ×2, Right, Left, Right, Left, Right. Follow the on-screen license agreement and set a local developer password. This is separate from Fire tablet developer settings. Never paste the password into GitHub or chat.
3. On a computer or browser on the same network, open the Roku's *on-screen Development Application Installer URL*. Log in as `rokudev` with the password created on the TV. Upload a ZIP of this folder's **contents** (manifest at ZIP root), not the parent folder. Install and look for the two explicit status messages. A Roku may replace an existing sideloaded app, so obtain owner approval before installation.
4. If it fails, collect a screenshot of the error (without network IP or password) and inspect the Roku debug console.

## Packaging

ZIP the `manifest`, `source/` and `components/` at archive root. Do not include this README or any secrets. The Roku app is not installed or device-tested yet.

## Gates

- [ ] Independent source review / static checks
- [ ] ZIP archive verified to contain `manifest` at root
- [ ] Developer mode enabled on chosen TV
- [ ] Roku app sideloaded and launches
- [ ] Licensed sample clip plays via SceneGraph Video node
- [ ] Private pairing transport and distinct-tap sequence verified
- [ ] Same-animal repeated tap restarts clip
- [ ] Fire tablet + Element TV family acceptance
- [ ] TCL Roku TV compatibility check

Roku official docs: https://developer.roku.com/dev/docs/developer-setup and https://developer.roku.com/dev/docs/playing-videos
