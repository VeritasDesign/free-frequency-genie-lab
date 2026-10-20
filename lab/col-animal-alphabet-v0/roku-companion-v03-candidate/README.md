# Roku v0.3 candidate — not installed
Reuses v0.2 HTTPS ReceiverTask. The scene now observes each distinct command event and restarts the Video node even for repeated same-letter selections. Receiver is **disabled** by default. No receiver token, endpoint, or admin secret is embedded. Sample Mux video remains a **non-animal placeholder**. This is **not a deliverable animal video catalog**.

Before hardware testing: provision receiver securely, set endpoint/receiverId/receiverToken using owner-controlled setup, enable Task, validate BrightScript syntax on Roku, install candidate separately with rollback to v0.2. No change to installed v0.2 Roku ZIP. The Fire sender still requires pairing UI and actual HTTPS relay deployment.
