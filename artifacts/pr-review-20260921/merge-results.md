# Ascencio PR merge results

**Done. 42 merged into `main`; 0 open PRs remain.** User explicitly accepted documented shared CI failure. No branches deleted; no history rewrite or protection bypass.

Remote main: [`3dbc1ce937ad83865a08622ef1b7070117539718`](https://github.com/AronGomu/ascencio/commit/3dbc1ce937ad83865a08622ef1b7070117539718).

## Evidence

V1. `gh pr merge <number> --repo AronGomu/ascencio --merge --match-head-commit <reviewed-sha>` ran sequentially for #26–#67. All PR states verified `MERGED`.

V2. Every merge commit has exactly two expected parents: prior remote main, approved PR head. Final 93 changed paths match reviewed aggregate; all other tracked paths unchanged from reviewed base.

V3. `gh pr list --state open --limit 1000` → `[]`. `git ls-remote --heads origin` confirms all 42 PR branches retained.

V4. Raw receipts: `artifacts/pr-review-20260921/merge-receipts.jsonl`. Final tree/state evidence: `artifacts/pr-review-20260921/post-merge-verification.json`.

V5. Local dirty checkout preserved, not pulled. Only `origin/main` advanced locally via fetch. Removed owned `.tmp/pr-merge-20260923/merge.py` plus empty scratch directory.

## Residual risk

R1. Shared CI asset download failure remains unresolved. Full remote headless/browser gates had not run; prior local targeted tests, typecheck, build, boundaries, Chromium PWA retry passed. Merge proceeds under explicit acceptance, not false green-CI claim.

## Merge commits

| PR | State | Merge SHA |
|---|---|---|
| [26](https://github.com/AronGomu/ascencio/pull/26) | MERGED | [c11f9460ef6dc032ae9fef8598afefd3178df938](https://github.com/AronGomu/ascencio/commit/c11f9460ef6dc032ae9fef8598afefd3178df938) |
| [27](https://github.com/AronGomu/ascencio/pull/27) | MERGED | [9c549f6fca3e3c2eafa2929ad29017924884e3dc](https://github.com/AronGomu/ascencio/commit/9c549f6fca3e3c2eafa2929ad29017924884e3dc) |
| [28](https://github.com/AronGomu/ascencio/pull/28) | MERGED | [bdf23751ed4cc04f05336277e4578b85b9f226b8](https://github.com/AronGomu/ascencio/commit/bdf23751ed4cc04f05336277e4578b85b9f226b8) |
| [29](https://github.com/AronGomu/ascencio/pull/29) | MERGED | [47895be0c342b22ee482d23925f2f5b88b0e7a61](https://github.com/AronGomu/ascencio/commit/47895be0c342b22ee482d23925f2f5b88b0e7a61) |
| [30](https://github.com/AronGomu/ascencio/pull/30) | MERGED | [a74a0187ccd7b07a4d999f404ca084ceb1e78be4](https://github.com/AronGomu/ascencio/commit/a74a0187ccd7b07a4d999f404ca084ceb1e78be4) |
| [31](https://github.com/AronGomu/ascencio/pull/31) | MERGED | [981ab98039cb98f8bc6399e5ee3031d767e02dc6](https://github.com/AronGomu/ascencio/commit/981ab98039cb98f8bc6399e5ee3031d767e02dc6) |
| [32](https://github.com/AronGomu/ascencio/pull/32) | MERGED | [04916f9b520b641ddb00925874023a99874268f6](https://github.com/AronGomu/ascencio/commit/04916f9b520b641ddb00925874023a99874268f6) |
| [33](https://github.com/AronGomu/ascencio/pull/33) | MERGED | [93096dccf74b423625953051fe94a4017e40d122](https://github.com/AronGomu/ascencio/commit/93096dccf74b423625953051fe94a4017e40d122) |
| [34](https://github.com/AronGomu/ascencio/pull/34) | MERGED | [ca2c685497c435af39b91660c315eef6ee542ee4](https://github.com/AronGomu/ascencio/commit/ca2c685497c435af39b91660c315eef6ee542ee4) |
| [35](https://github.com/AronGomu/ascencio/pull/35) | MERGED | [dc2832d300c11948cb584e2ae0a705d87b36d322](https://github.com/AronGomu/ascencio/commit/dc2832d300c11948cb584e2ae0a705d87b36d322) |
| [36](https://github.com/AronGomu/ascencio/pull/36) | MERGED | [ce18e824d359f279b3349fce9245ce9aa9b04301](https://github.com/AronGomu/ascencio/commit/ce18e824d359f279b3349fce9245ce9aa9b04301) |
| [37](https://github.com/AronGomu/ascencio/pull/37) | MERGED | [a3001893630e7ae36b176bc9ea2dbd38e88b84a0](https://github.com/AronGomu/ascencio/commit/a3001893630e7ae36b176bc9ea2dbd38e88b84a0) |
| [38](https://github.com/AronGomu/ascencio/pull/38) | MERGED | [ca18b517314d89a576a793254cc0f638bfeea61d](https://github.com/AronGomu/ascencio/commit/ca18b517314d89a576a793254cc0f638bfeea61d) |
| [39](https://github.com/AronGomu/ascencio/pull/39) | MERGED | [a0368d2317466ccbc3f356deb515717abfbbd39e](https://github.com/AronGomu/ascencio/commit/a0368d2317466ccbc3f356deb515717abfbbd39e) |
| [40](https://github.com/AronGomu/ascencio/pull/40) | MERGED | [63eb44967a14b598f37c56c809c27ae5a7d405df](https://github.com/AronGomu/ascencio/commit/63eb44967a14b598f37c56c809c27ae5a7d405df) |
| [41](https://github.com/AronGomu/ascencio/pull/41) | MERGED | [15f0111baf57922cb4dbe1f95368986c52d2f5db](https://github.com/AronGomu/ascencio/commit/15f0111baf57922cb4dbe1f95368986c52d2f5db) |
| [42](https://github.com/AronGomu/ascencio/pull/42) | MERGED | [76f7716f6b65c9c8046d37a619744be084d30619](https://github.com/AronGomu/ascencio/commit/76f7716f6b65c9c8046d37a619744be084d30619) |
| [43](https://github.com/AronGomu/ascencio/pull/43) | MERGED | [5a2fac6e2e26120146b6c15ab1ddb11829c06d66](https://github.com/AronGomu/ascencio/commit/5a2fac6e2e26120146b6c15ab1ddb11829c06d66) |
| [44](https://github.com/AronGomu/ascencio/pull/44) | MERGED | [2fd32c8d8d0bcd2d712abff535bfe55a0afa7d4e](https://github.com/AronGomu/ascencio/commit/2fd32c8d8d0bcd2d712abff535bfe55a0afa7d4e) |
| [45](https://github.com/AronGomu/ascencio/pull/45) | MERGED | [0a2caa2676d43678bccf82f384166dfea8df2611](https://github.com/AronGomu/ascencio/commit/0a2caa2676d43678bccf82f384166dfea8df2611) |
| [46](https://github.com/AronGomu/ascencio/pull/46) | MERGED | [9f41ea8f70047015b20c362974288acdc13ad1e2](https://github.com/AronGomu/ascencio/commit/9f41ea8f70047015b20c362974288acdc13ad1e2) |
| [47](https://github.com/AronGomu/ascencio/pull/47) | MERGED | [6b05b9fc3908f74da7b5a06ec3bfbc026dcc0289](https://github.com/AronGomu/ascencio/commit/6b05b9fc3908f74da7b5a06ec3bfbc026dcc0289) |
| [48](https://github.com/AronGomu/ascencio/pull/48) | MERGED | [3535480c9e27bf5435dfb4006930b468b54aad29](https://github.com/AronGomu/ascencio/commit/3535480c9e27bf5435dfb4006930b468b54aad29) |
| [49](https://github.com/AronGomu/ascencio/pull/49) | MERGED | [373e3614f468fe833c37d5811d30c5a805fa7cdd](https://github.com/AronGomu/ascencio/commit/373e3614f468fe833c37d5811d30c5a805fa7cdd) |
| [50](https://github.com/AronGomu/ascencio/pull/50) | MERGED | [df5f94beaf4e8823bb53eda2b8a99b6ddf1d6a49](https://github.com/AronGomu/ascencio/commit/df5f94beaf4e8823bb53eda2b8a99b6ddf1d6a49) |
| [51](https://github.com/AronGomu/ascencio/pull/51) | MERGED | [4ed9faf3911508552f4419a4dcf3d1b35ec16b3c](https://github.com/AronGomu/ascencio/commit/4ed9faf3911508552f4419a4dcf3d1b35ec16b3c) |
| [52](https://github.com/AronGomu/ascencio/pull/52) | MERGED | [4be117968e5b2689473d89e75f91a42c8bcee6cb](https://github.com/AronGomu/ascencio/commit/4be117968e5b2689473d89e75f91a42c8bcee6cb) |
| [53](https://github.com/AronGomu/ascencio/pull/53) | MERGED | [4c28b315d5da72a7f8b16ca9317da9db0aa275c1](https://github.com/AronGomu/ascencio/commit/4c28b315d5da72a7f8b16ca9317da9db0aa275c1) |
| [54](https://github.com/AronGomu/ascencio/pull/54) | MERGED | [fb85bb74790008cb1e3b94959d0bf82ead510a19](https://github.com/AronGomu/ascencio/commit/fb85bb74790008cb1e3b94959d0bf82ead510a19) |
| [55](https://github.com/AronGomu/ascencio/pull/55) | MERGED | [d53611bb23d2a131ca781a046d29e25471b781ed](https://github.com/AronGomu/ascencio/commit/d53611bb23d2a131ca781a046d29e25471b781ed) |
| [56](https://github.com/AronGomu/ascencio/pull/56) | MERGED | [7eca0e134c73b52733b7850805c1a658239bc879](https://github.com/AronGomu/ascencio/commit/7eca0e134c73b52733b7850805c1a658239bc879) |
| [57](https://github.com/AronGomu/ascencio/pull/57) | MERGED | [309663c40394fbf0fd68ebd50a36784a95c047d3](https://github.com/AronGomu/ascencio/commit/309663c40394fbf0fd68ebd50a36784a95c047d3) |
| [58](https://github.com/AronGomu/ascencio/pull/58) | MERGED | [338699baeb941def1f9de4bca842dc75cf35f52c](https://github.com/AronGomu/ascencio/commit/338699baeb941def1f9de4bca842dc75cf35f52c) |
| [59](https://github.com/AronGomu/ascencio/pull/59) | MERGED | [813fdf123fcea5694dac41febade3f60bb4def1b](https://github.com/AronGomu/ascencio/commit/813fdf123fcea5694dac41febade3f60bb4def1b) |
| [60](https://github.com/AronGomu/ascencio/pull/60) | MERGED | [4da3e29b42656b6988a056512cc6dde90738b05e](https://github.com/AronGomu/ascencio/commit/4da3e29b42656b6988a056512cc6dde90738b05e) |
| [61](https://github.com/AronGomu/ascencio/pull/61) | MERGED | [dd4e0e5942396b7c193c1d36f892c95a7ba55baf](https://github.com/AronGomu/ascencio/commit/dd4e0e5942396b7c193c1d36f892c95a7ba55baf) |
| [62](https://github.com/AronGomu/ascencio/pull/62) | MERGED | [524e1d6bb3157bbe8e01097288aca1c6341315f3](https://github.com/AronGomu/ascencio/commit/524e1d6bb3157bbe8e01097288aca1c6341315f3) |
| [63](https://github.com/AronGomu/ascencio/pull/63) | MERGED | [8c0ccb94eaa95b38f12b79d6e9969c13f57bae73](https://github.com/AronGomu/ascencio/commit/8c0ccb94eaa95b38f12b79d6e9969c13f57bae73) |
| [64](https://github.com/AronGomu/ascencio/pull/64) | MERGED | [c9fa7369ca2fff269e041c1c5d12d9e1a4f6ec4a](https://github.com/AronGomu/ascencio/commit/c9fa7369ca2fff269e041c1c5d12d9e1a4f6ec4a) |
| [65](https://github.com/AronGomu/ascencio/pull/65) | MERGED | [99be012ae51b133a388f9e3d0ace2a526e351527](https://github.com/AronGomu/ascencio/commit/99be012ae51b133a388f9e3d0ace2a526e351527) |
| [66](https://github.com/AronGomu/ascencio/pull/66) | MERGED | [a46b586ff5c85b65aca4eb29de57bb13ab6b68ec](https://github.com/AronGomu/ascencio/commit/a46b586ff5c85b65aca4eb29de57bb13ab6b68ec) |
| [67](https://github.com/AronGomu/ascencio/pull/67) | MERGED | [3dbc1ce937ad83865a08622ef1b7070117539718](https://github.com/AronGomu/ascencio/commit/3dbc1ce937ad83865a08622ef1b7070117539718) |
