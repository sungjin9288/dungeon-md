# B1 boot profiling — 2026-09-07

## Verdict

The observed 2.4–3.8s historical delay was **not reproduced** in this paired run.
The five added artworks plus 96px sprite bake are not demonstrated to cause a
multi-second slowdown. No runtime optimization or asset reduction was applied.
The exact cause of the old slow samples remains unproven; this is not a device
performance PASS or a claim that B1 has zero loading cost.

## Reproduce

Run from the `dungeon-phaser` repository root, using its existing Playwright
installation. Start an owned Vite server and choose a new, non-existing receipt
filename; the profiler writes JSON exclusively and never replaces old receipts.

```bash
npm run dev -- --host 127.0.0.1 --strictPort
node scripts/profile-character-b1-boot.mjs tools/character-b1-boot-profile-next.json
```

The script uses headed Chromium, fresh isolated contexts, 390×844 DPR2, reduced
motion, the same warrior/MQ-008 minimal fixture, and `/?skipTutorial=1`.
Runtime files, saved user data and original evidence are not changed.

Both arms use identical response routing, which disables HTTP cache. Only the
comparison arm removes the exact five B1 registry records and changes the ritual
world bake from96 to48 **in browser responses**. This is an ablation experiment,
not a complete restoration of an earlier checkout. Both arms keep the current
Quest code, all136 legacy JPGs, existing backgrounds and gameplay logic.

Order is A/B/B/A/A/B/B/A. The first pair is labelled warm-up in advance and is
retained in the receipt. Measurements stop at the first Home `postrender` event,
not after a screenshot wait. This differs from the old Home-active-only receipt;
compare the two arms here, not absolute timings across incompatible methods.

## Evidence

First complete resource-inventory receipt: `tools/character-b1-boot-profile-paired03.json`.
SHA-256: `e3c3fc7fcc644f29cd729261163d8206b90f020ea796d8d07007083e84ee2fda`.
Screenshot: `tools/screenshots/character-b1-boot-profile-paired03.png`.
Its exact profiler source is preserved at
`output/character-art/b1/boot-profile-paired03.mjs` and hash-matches that receipt.

| Measurement | Current nine/96 | Comparison four/48 |
| --- | ---: | ---: |
| All observed navigation-to-first-Home samples, ms |917.637,713.140,690.910,693.322|668.146,660.775,688.299,650.924|
| Post-warm-up median, ms; n=3 each |693.322|660.775|
| Navigation→Boot preload median, ms |365.9|342.5|
| Loader start→complete median, ms |215.7|205.4|
| Procedural texture generation median, ms |16.8|16.2|
| Texture completion→Home frame median, ms |49.6|48.5|
| Recorded resource requests |421|416|
| Legacy JPG requests |136|136|
| Ritual PNG requests / source bytes |9 / 2,386,361|4 / 1,170,093|

Median observed difference is32.547ms (about4.9%), not several seconds. This tiny
sample has no significance test or device budget; it neither proves equivalence
nor establishes a durable regression. Phase medians are independent statistics,
not additive parts of a single median run. Texture-generation instrumentation
covers Boot's procedural invader/monster work; Home sprite work is in the next
phase, so 16.8ms is not the isolated 96px sprite cost.

The current run loaded263 development source/dependency modules before/around
startup. Code/bootstrap and asset loading dominate the measured texture-generation
work. The slowest individual requests were generally existing backgrounds,
including the2,558,459-byte dungeon chamber; no background was changed. Correlation
does not by itself authorize lazy loading or an architectural change.

Shared-host load averages were recorded rather than assumed idle. The preceding
series had one-minute loads around17; the final series around11. This supports
treating the host as uncontrolled, but does not establish the cause of historical
samples, whose host load was not recorded.

### Final safety/replay check

The profiler now preflights both JSON and PNG paths before starting a browser and
uses exclusive writes for both. Reusing the paired03 filename exited1 with
`Refusing to overwrite profile evidence`, leaving its bytes unchanged.

The final source was rerun for8 fresh contexts into
`tools/character-b1-boot-profile-paired04.json` (SHA-256
`b419800626c7a27200e2739e128cb18efa56f6204a108f506fd6565557f4fc0d`).
All current samples:1548.825/1086.284/1037.806/1112.904ms.
All comparison samples:1263.693/1084.030/957.324/1007.185ms.
Post-warm-up medians were1086.284 versus1007.185ms, a79.099ms difference.
The variation between series remains visible; neither series supports a
multi-second B1-induced delay. All8 final samples pass source count, actual
48/96 dimensions, full136+4/9 image request inventory and error gates.
The final screenshot was opened; all18 source hashes and its PNG hash match.

## Harness corrections and preservation

- `tools/character-b1-boot-profile-attempt01.json`: first route transform rejected
  the last compiled registry record because it omitted a trailing comma. This
  failure was in the profiler, not the game. Both comma forms are now supported;
  exact replacement counts are asserted and route errors are captured.
- `tools/character-b1-boot-profile-paired02.json`: phase markers and arm dimensions
  passed, but default Resource Timing capacity250 omitted the later asset requests.
  Its resource inventory is incomplete and is not used as the final resource proof.
- Final profiler sets capacity4096, detects buffer overflow, and asserts136 JPG
  requests plus4/9 PNG requests, loaded source count and48/96 sprite dimensions.
- All8 samples in each complete-inventory series have0 captured console/page/network errors and0 source drift.
  The final source hashes cover the previous17 runtime/QA sources plus this profiler.
  Current Home screenshots were opened and visually checked.
- Previous B1 audits, assets, boot observations and their hashes remain historical
  evidence. No reset, cleanup, commit, push, native sync or new dependency occurred.
- Fresh verification: `npm test`105 files/2904 tests PASS, profiler syntax and
  `git diff --check` PASS. Build was not rerun: runtime, dependencies and build
  configuration are unchanged; this turn added diagnostics and documentation only.
- Task-owned Vite PID37638 stopped; TCP8083 has no listener at closeout.

## Next gate

Profiling infrastructure and the bounded B1 ablation are complete. Keep the
historical slow-sample cause/device-performance verdict open. Before changing
startup architecture, establish a production-build baseline under recorded,
repeatable host/device conditions and a product-owned readiness budget. If the
slowdown reproduces, use its phase/resource evidence to select a minimal fix.
Do not call this diagnostic run a performance optimization.
