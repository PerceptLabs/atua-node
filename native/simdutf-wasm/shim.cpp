/**
 * simdutf WASM shim.
 * Wraps C++ namespace functions into C-linkage exports
 * matching the SimdutfExports TypeScript interface.
 */
#include "simdutf.h"

extern "C" {

int validate_utf8(const char* buf, size_t len) {
    return simdutf::validate_utf8(buf, len) ? 1 : 0;
}

int validate_utf16(const char* buf, size_t len) {
    // len is number of UTF-16 code units
    return simdutf::validate_utf16le(reinterpret_cast<const char16_t*>(buf), len) ? 1 : 0;
}

size_t convert_utf8_to_utf16(const char* input, size_t inputLen, char* output) {
    return simdutf::convert_utf8_to_utf16le(
        input, inputLen,
        reinterpret_cast<char16_t*>(output)
    );
}

size_t convert_utf16_to_utf8(const char* input, size_t inputLen, char* output) {
    return simdutf::convert_utf16le_to_utf8(
        reinterpret_cast<const char16_t*>(input), inputLen,
        output
    );
}

size_t utf8_length_from_utf16(const char* input, size_t inputLen) {
    return simdutf::utf8_length_from_utf16le(
        reinterpret_cast<const char16_t*>(input), inputLen
    );
}

size_t utf16_length_from_utf8(const char* input, size_t inputLen) {
    return simdutf::utf16_length_from_utf8(input, inputLen);
}

int detect_encoding(const char* buf, size_t len) {
    auto enc = simdutf::autodetect_encoding(buf, len);
    switch (enc) {
        case simdutf::encoding_type::UTF8:    return 1;
        case simdutf::encoding_type::UTF16_LE: return 2;
        case simdutf::encoding_type::UTF16_BE: return 3;
        default: return 0;
    }
}

} // extern "C"
