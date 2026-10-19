# ReceiverTask (source-only v0.3 candidate)

A disabled-by-default SceneGraph Task that polls an authenticated HTTPS command endpoint off the render thread. Its fields are `endpoint`, `receiverId`, `receiverToken`, `enabled`, `command` and `connectionState`. This component is **not wired into HomeScene** until the isolated durable relay and safe provisioning exist. The existing v0.2 TV-installed video sample is untouched.

Security: never embed tokens in a distributable Roku ZIP; do not activate until authenticated receiver bootstrap, secure credential storage, family owner pairing, media allowlist and persistent storage have passed review.

Pending device-specific validation: Roku BrightScript compiler/type behavior, asynchronous response handling, error/backoff/revoke paths, background lifecycle, event ordering. This is source code, not a successful Roku build or proof of tablet-to-TV control.
