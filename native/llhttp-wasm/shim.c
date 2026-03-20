/* Shim for llhttp WASM compilation.
 * Provides sizeof_llhttp() and no-op callback stubs. */
#include "llhttp.h"

int sizeof_llhttp(void) {
    return sizeof(llhttp_t);
}

/* llhttp's WASM-oriented API expects these callback symbols.
 * Our TypeScript binding reads results via getter functions
 * (llhttp_get_method, llhttp_get_status_code, etc.) instead
 * of using callbacks, so these are no-ops. */
int wasm_on_message_begin(llhttp_t* p)         { return 0; }
int wasm_on_url(llhttp_t* p, const char* at, size_t len)          { return 0; }
int wasm_on_status(llhttp_t* p, const char* at, size_t len)       { return 0; }
int wasm_on_header_field(llhttp_t* p, const char* at, size_t len) { return 0; }
int wasm_on_header_value(llhttp_t* p, const char* at, size_t len) { return 0; }
int wasm_on_headers_complete(llhttp_t* p)      { return 0; }
int wasm_on_body(llhttp_t* p, const char* at, size_t len)         { return 0; }
int wasm_on_message_complete(llhttp_t* p)      { return 0; }
