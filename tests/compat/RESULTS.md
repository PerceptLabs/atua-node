# Package Compatibility Matrix

Generated: 2026-03-21T01:30:07.606Z

| Package | Version | Total | Passed | Failed | Rate | Tier |
|---------|---------|-------|--------|--------|------|------|
| express | 5.2.1 | 0 | 0 | 0 | 0% | 3 |
| undici | 6.21.1 | 657 | 654 | 3 | 100% | 3 |
| pino | 9.6.0 | 0 | 0 | 0 | 0% | 3 |
| archiver | 7.0.1 | 41 | 39 | 2 | 95% | 3 |
| ws | 8.18.1 | 428 | 428 | 0 | 100% | 3 |
| readable-stream | 4.7.0 | 189 | 189 | 0 | 100% | 3 |
| tar | 7.5.12 | 31 | 13 | 3 | 42% | 3 |
| formidable | 3.5.2 | 76 | 69 | 4 | 91% | 3 |
| nodemailer | 6.9.16 | 26 | 24 | 2 | 92% | 3 |
| glob | 10.4.5 | 38 | 32 | 6 | 84% | 3 |
| body-parser | 2.2.2 | 269 | 269 | 0 | 100% | 3 |
| raw-body | 3.0.2 | 55 | 55 | 0 | 100% | 3 |
| serve-static | 1.16.2 | 92 | 92 | 0 | 100% | 3 |
| finalhandler | 2.1.1 | 110 | 106 | 0 | 96% | 3 |
| send | 1.2.1 | 139 | 137 | 2 | 99% | 3 |
| compression | 1.8.1 | 57 | 56 | 0 | 98% | 3 |
| **Tier 1 Total** | | **0** | **0** | **0** | **N/A** | **1** |
| **Tier 2 Total** | | **0** | **0** | **0** | **N/A** | **2** |
| **Tier 3 Total** | | **2208** | **2163** | **45** | **98%** | **3** |

## Failures

| Package | Test | Error | Node API | Category |
|---------|------|-------|----------|----------|
| undici | test/connect-pre-shared-session.js | - | net | compat-bug |
| undici | test/http2.js | ENOENT: no such file or directory, open '/mnt/c/Users/v1sua/atua-node/tests/compat/.packages/undici/ | fs | compat-bug |
| undici | test/https.js | - | http | compat-bug |
| archiver | archiver | api | unknown | compat-bug |
| archiver | plugins | zip | unknown | compat-bug |
| tar | test/create.ts # time=48460.876ms | - | unknown | compat-bug |
| tar | test/get-write-flag.js # time=45441.122ms | - | unknown | compat-bug |
| tar | test/pack.js # time=35046.131ms | - | unknown | compat-bug |
| nodemailer | SMTP-Connection Tests | Test hook "before" at test/smtp-connection/smtp-connection-test.js:32:9 generated asynchronous activ | net | compat-bug |
| nodemailer | SMTP Transport Tests | Test hook "beforeEach" at test/smtp-transport/smtp-tranport-test.js:43:9 generated asynchronous acti | unknown | compat-bug |
| glob | test/bin.ts # time=45491.762ms | - | unknown | compat-bug |
| glob | test/memfs.ts # time=30474.186ms | - | unknown | compat-bug |
| glob | test/realpath.ts # time=51509.889ms | - | path | compat-bug |
| glob | timeout! | - | timers | compat-bug |
| glob | timeout! | - | timers | compat-bug |
| glob | timeout! | - | timers | compat-bug |
| send | should work without root | ✔ should 404 if file path contains trailing slash (windows) | path | compat-bug |
| send | should still serve files with dots in name | 137 passing (671ms) | unknown | compat-bug |
| send | send(file, options) | index | unknown | compat-bug |
| send | send(file, options) | root | unknown | compat-bug |
