# Package Compatibility Matrix

Generated: 2026-03-24T01:52:36.433Z

## Status Summary

- pass: 5
- runtime-fail: 4
- harness-fail: 2
- no-runtime-test: 0
- counted tests: 1803/1971 passed, 15 failed, 153 skipped

## Results

| Package | npm | Version | Status | Total | Passed | Failed | Skipped | Rate | Counted | Tier |
|---------|-----|---------|--------|-------|--------|--------|---------|------|---------|------|
| semver | semver | 7.7.4 | runtime-fail | 50 | 44 | 6 | - | 88% | yes | 1 |
| dotenv | dotenv | 17.3.1 | runtime-fail | 9 | - | 9 | - | 0% | yes | 1 |
| commander | commander | 14.0.3 | pass | 1367 | 1367 | - | - | 100% | yes | 1 |
| chalk | chalk | 5.6.2 | runtime-fail | 29 | 29 | - | - | 100% | yes | 1 |
| bytes | bytes | 3.1.2 | pass | 30 | 30 | - | - | 100% | yes | 1 |
| uuid | uuid | 13.0.0 | pass | 11 | 11 | - | - | 100% | yes | 1 |
| validator | validator | 13.15.26 | pass | 306 | 306 | - | - | 100% | yes | 1 |
| minimatch | minimatch | 10.2.4 | harness-fail | - | - | - | - | N/A | no | 1 |
| debug | debug | 4.4.3 | runtime-fail | 16 | 16 | - | - | 100% | yes | 1 |
| lru-cache | lru-cache | 11.2.7 | harness-fail | - | - | - | - | N/A | no | 1 |
| minimist | minimist | 1.2.8 | pass | 153 | - | - | 153 | 100% | yes | 1 |

## Tier Summaries

- Tier 1: 5/11 packages passing, counted tests 1803/1971
- Tier 2: 0/0 packages passing, counted tests 0/0
- Tier 3: 0/0 packages passing, counted tests 0/0
- Tier 4: 0/0 packages passing, counted tests 0/0

## Runtime Failures

- **semver** (7.7.4) via `npm test --ignore-scripts`: semver/internal    |     100 |      100 |     100 |     100 | | constants.js      |     100 |      100 |     100 |     100 | | debug.js          |     100 |      100 |     100 |     100 | | identifiers.js    |     100 |      100 |     100 |     100 | | lrucache.js       |     100 |      100 |     100 |     100 | | parse-options.js  |     100 |      100 |     100 |     100 | | re.js             |     100 |      100 |     100 |     100 | | semver/ranges      |     100 |      100 |     100 |     100 | | gtr.js            |     100 |      100 |     100 |     100 | | intersects.js     |     100 |      100 |     100 |     100 | | ltr.js            |     100 |      100 |     100 |     100 | | max-satisfying.js |     100 |      100 |     100 |     100 | | min-satisfying.js |     100 |      100 |     100 |     100 | | min-version.js    |     100 |      100 |     100 |     100 | | outside.js        |     100 |      100 |     100 |     100 | | simplify.js       |     100 |      100 |     100 |     100 | | subset.js         |     100 |      100 |     100 |     100 | | to-comparators.js |     100 |      100 |     100 |     100 | | valid.js          |     100 |      100 |     100 |     100 | | -
- **dotenv** (17.3.1) via `npm test`: 1..0 # no tests found | not ok 9 - tests/test-populate.js # time=4197.301ms | --- | stdio: inherit | cwd: /mnt/c/Users/v1sua/atua-node/tests/compat/.packages/dotenv | externalID: tests/test-populate.js | command: /home/shoshi/.nvm/versions/node/v22.22.1/bin/node | args: | - --import=file:///mnt/c/Users/v1sua/atua-node/tests/compat/.packages/dotenv/node_modules/@isaacs/ts-node-temp-fork-for-pr-2009/import.mjs | - --import=file:///mnt/c/Users/v1sua/atua-node/tests/compat/.packages/dotenv/node_modules/@tapjs/mock/dist/esm/import.mjs | - --enable-source-maps | - --import=file:///mnt/c/Users/v1sua/atua-node/tests/compat/.packages/dotenv/node_modules/@tapjs/processinfo/dist/esm/import.mjs | - /mnt/c/Users/v1sua/atua-node/tests/compat/.packages/dotenv/tests/test-populate.js | jobId: 0 | exitCode: 1 | signal: null | ... | # No coverage generated | # { total: 9, pass: 0, fail: 9 } | # time=4418.622ms
- **chalk** (5.6.2) via `npm test`: ✔ level › enable/disable colors based on overall chalk .level property, not individual instances | ✔ level › propagate enable/disable changes from child colors | ✔ level › disable colors if they are not supported (121ms) | ✖ Timed out while running tests | ─ | 29 tests passed | ----------------------|---------|----------|---------|---------|--------------------- | File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s | ----------------------|---------|----------|---------|---------|--------------------- | All files             |   98.53 |    92.92 |   90.47 |   98.53 | | source               |   97.28 |     91.8 |   89.47 |   97.28 | | index.js            |   96.88 |       90 |   88.23 |   96.88 | 68-70,90-91,176-177 | utilities.js        |     100 |      100 |     100 |     100 | | test                 |     100 |    94.73 |     100 |     100 | | _fixture.js         |     100 |      100 |     100 |     100 | | chalk.js            |     100 |       92 |     100 |     100 | 8-9 | instance.js         |     100 |      100 |     100 |     100 | | level.js            |     100 |      100 |     100 |     100 | | no-color-support.js |     100 |      100 |     
- **debug** (4.4.3) via `npm test`: [36m23 03 2026 20:38:40.273:DEBUG [framework.browserify]: [39mcreated browserify bundle: /tmp/407b49400601546a0c82dea3526abf56.browserify.js | [36m23 03 2026 20:38:40.317:DEBUG [framework.browserify]: [39madd bundle to config.files at position 0 | [36m23 03 2026 20:38:40.419:DEBUG [web-server]: [39mInstantiating middleware | [36m23 03 2026 20:38:43.941:DEBUG [framework.browserify]: [39mbuilding bundle | [36m23 03 2026 20:38:43.945:DEBUG [framework.browserify]: [39mupdating src/browser.js in bundle | [36m23 03 2026 20:38:43.946:DEBUG [framework.browserify]: [39mupdating src/common.js in bundle | [36m23 03 2026 20:38:43.947:DEBUG [framework.browserify]: [39mupdating test.js in bundle | [36m23 03 2026 20:38:44.649:DEBUG [framework.browserify]: [39mbundling | [32m23 03 2026 20:38:50.135:INFO [framework.browserify]: [39mbundle built | [32m23 03 2026 20:38:50.143:INFO [karma-server]: [39mKarma v3.1.4 server started at http://0.0.0.0:9876/ | [32m23 03 2026 20:38:50.144:INFO [launcher]: [39mLaunching browsers HeadlessChrome with concurrency 1 | [32m23 03 2026 20:38:50.342:INFO [launcher]: [39mStarting browser ChromeHeadless | [36m23 03 2026 20:38:50.342:DEBUG [temp

## Harness Failures

- **minimatch** (10.2.4) via `n/a`: error: The following untracked working tree files would be overwritten by checkout: | .tshy/build.json | .tshy/commonjs.json | .tshy/esm.json | Please move or remove them before you switch branches. | Aborting
- **lru-cache** (11.2.7) via `n/a`: error: Your local changes to the following files would be overwritten by checkout: | package-lock.json | package.json | Please commit your changes or stash them before you switch branches. | Aborting

## Failure Details

| Package | Test | Error | Node API | Category |
|---------|------|-------|----------|----------|
| semver | test/bin/semver.js # time=30098.795ms | no plan | unknown | compat-bug |
| semver | test/functions/gt.js # time=31010.164ms | - | unknown | compat-bug |
| semver | test/functions/gte.js # time=31006.061ms | - | unknown | compat-bug |
| semver | test/functions/lte.js # time=31006.585ms | - | unknown | compat-bug |
| semver | test/functions/neq.js # time=31004.44ms | - | unknown | compat-bug |
| semver | test/internal/debug.js # time=30023.055ms | incorrect number of tests | unknown | compat-bug |
| dotenv | tests/test-cli-options.js # time=4053.834ms | - | unknown | compat-bug |
| dotenv | tests/test-config.js # time=4063.77ms | - | unknown | compat-bug |
| dotenv | tests/test-config-vault.js # time=4027.889ms | - | unknown | compat-bug |
| dotenv | tests/test-config-cli.js # time=4175.143ms | - | unknown | compat-bug |
| dotenv | tests/test-decrypt.js # time=4172.104ms | - | unknown | compat-bug |
| dotenv | tests/test-parse-multiline.js # time=4284.56ms | - | url | compat-bug |
| dotenv | tests/test-parse.js # time=4146.391ms | - | url | compat-bug |
| dotenv | tests/test-env-options.js # time=4034.899ms | - | process | compat-bug |
| dotenv | tests/test-populate.js # time=4197.301ms | - | unknown | compat-bug |
