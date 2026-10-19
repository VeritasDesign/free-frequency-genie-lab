# Col's Animal Alphabet — isolated tablet prototype v0

Mission: https://github.com/VeritasDesign/free-frequency-genie-lab/issues/171

## State
- **BUILT:** single-file HTML touch prototype, A–Z, at least one animal per letter, A=Alligator, B=Bear, U=Sea Urchin; event sequence increments for every tap including repeated taps.
- **NOT PROVEN:** Fire Silk runtime, installed PWA, Roku command service, Roku companion app, video hosting, TV playback, replay-on-TV, latency.
- **NOT DONE:** deploy, publish, merge, or call paid inference.

## How to test safely
Open `index.html` in a local browser. Tap Lion twice: output must read Tap #2: Lion selected. Tap Sea Urchin: output must read Tap #3: Sea Urchin selected. The `animal-selection` browser event includes `{animal,letter,sequence}`; there is **no network transport** yet.

## Next conveyor gates
1. Host an isolated preview only after owner authorizes target; avoid all existing production Cloudflare Worker routes and projects.
2. Verify Amazon Fire 7 (12th gen), Fire OS 8.3.3.8, Silk home-screen/standalone behavior. Add web manifest, icons, and service worker only with suitable assets and installability proof.
3. Research Roku OS 15.3.4 on Element E4AA70R: companion-channel install, media playback, HTTPS poll transport and applicable platform restrictions. Roku TV developer mode was disabled during diagnostic; Fire developer options do not change that.
4. Add authenticated paired command service and allowlisted clip catalog; repeated same-animal click sequence must force player restart at zero. No public open control endpoint.
5. Verify on Element Roku TV first, TCL Roku TV second; independent tests and owner approval before release.

## Security
No credentials, device serials, MACs, account emails, or LAN addresses in this source. No YouTube scraping. No repo-wide automated builders enabled by this prototype.
