/**
 * Hello World WASIX validation program.
 *
 * Tests three core WASIX capabilities:
 *   1. stdout (printf → fd_write)
 *   2. File write (fopen/fwrite → path_open/fd_write)
 *   3. File read  (fopen/fread  → path_open/fd_read)
 *
 * Compiled to wasm/hello.wasm via:
 *   scripts/build-wasm.sh hello
 *
 * Loaded in browser via:
 *   const module = await WebAssembly.compileStreaming(fetch('wasm/hello.wasm'));
 *   const instance = await runWasix(module, { mount: { '/data': dir } });
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define TEST_FILE "/data/test-output.txt"
#define TEST_DATA "Hello from WASIX!\n"

int main(void) {
    /* 1. stdout test */
    printf("WASIX hello world\n");

    /* 2. File write test */
    FILE *wf = fopen(TEST_FILE, "w");
    if (!wf) {
        fprintf(stderr, "ERROR: cannot open %s for writing\n", TEST_FILE);
        return 1;
    }
    size_t written = fwrite(TEST_DATA, 1, strlen(TEST_DATA), wf);
    fclose(wf);

    if (written != strlen(TEST_DATA)) {
        fprintf(stderr, "ERROR: wrote %zu of %zu bytes\n", written, strlen(TEST_DATA));
        return 1;
    }
    printf("Wrote %zu bytes to %s\n", written, TEST_FILE);

    /* 3. File read test */
    FILE *rf = fopen(TEST_FILE, "r");
    if (!rf) {
        fprintf(stderr, "ERROR: cannot open %s for reading\n", TEST_FILE);
        return 1;
    }
    char buf[256] = {0};
    size_t read_bytes = fread(buf, 1, sizeof(buf) - 1, rf);
    fclose(rf);

    if (read_bytes == 0) {
        fprintf(stderr, "ERROR: read 0 bytes from %s\n", TEST_FILE);
        return 1;
    }

    if (strcmp(buf, TEST_DATA) != 0) {
        fprintf(stderr, "ERROR: data mismatch — got '%s'\n", buf);
        return 1;
    }

    printf("Read back: %s", buf);
    printf("All tests passed!\n");
    return 0;
}
