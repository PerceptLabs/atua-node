/* Shim for zlib WASM compilation.
 * Provides sizeof_z_stream() and wrapper functions that handle
 * zlib's macro-based API (deflateInit2 is actually deflateInit2_). */
#include "zlib.h"

int sizeof_z_stream(void) {
    return sizeof(z_stream);
}

/* deflateInit2/inflateInit2 are macros in zlib.h that expand to
 * deflateInit2_/inflateInit2_ with version and struct size params.
 * The TypeScript binding expects simple function names, so we undefine
 * the macros and provide wrapper functions. */
#undef deflateInit2
#undef inflateInit2

int deflateInit2(z_stream *strm, int level, int method,
                 int windowBits, int memLevel, int strategy) {
    return deflateInit2_(strm, level, method, windowBits, memLevel, strategy,
                         ZLIB_VERSION, (int)sizeof(z_stream));
}

int inflateInit2(z_stream *strm, int windowBits) {
    return inflateInit2_(strm, windowBits, ZLIB_VERSION, (int)sizeof(z_stream));
}
