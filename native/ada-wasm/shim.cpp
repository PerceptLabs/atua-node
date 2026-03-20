/**
 * Ada URL parser WASM shim.
 *
 * Includes the ada C++ implementation (excluding its built-in C API)
 * and provides custom C API functions matching the TypeScript
 * AdaExports interface signatures.
 */

// Include ada C++ implementation up to (but not including) the C API section.
// The C API section (ada_c.cpp) starts at line ~14896 and defines functions
// that return ada_string structs — which don't work well with WASM FFI.
// We provide our own C API with (result, outLen) → ptr signatures instead.

// First, define a macro to prevent the C API section from being compiled
#define ADA_ADA_C_CPP_ALREADY_INCLUDED 1

#include "ada.h"

// Now include ada.cpp but skip its C API
// We use a trick: include ada.cpp as a header and handle the C API exclusion
// by providing our own `get_instance` helper and C API functions.
// Instead of modifying ada.cpp, we compile it separately and use the linker.

#include <stdlib.h>
#include <string.h>

// Helper to get the url_aggregator from opaque pointer
static ada::result<ada::url_aggregator>& get_inst(void* result) {
    return *reinterpret_cast<ada::result<ada::url_aggregator>*>(result);
}

// Helper to extract a string_view and write to outLen ptr
static const char* sv_to_ptr(std::string_view sv, unsigned int* outLen) {
    *outLen = static_cast<unsigned int>(sv.size());
    return sv.data();
}

extern "C" {

void* ada_parse(const char* input, size_t len) {
    auto* result = new ada::result<ada::url_aggregator>(
        ada::parse<ada::url_aggregator>(std::string_view(input, len))
    );
    return result;
}

void ada_free(void* result) {
    delete reinterpret_cast<ada::result<ada::url_aggregator>*>(result);
}

int ada_is_valid(void* result) {
    return get_inst(result).has_value() ? 1 : 0;
}

const char* ada_get_href(void* result, unsigned int* outLen) {
    if (!get_inst(result).has_value()) { *outLen = 0; return nullptr; }
    return sv_to_ptr(get_inst(result)->get_href(), outLen);
}

const char* ada_get_protocol(void* result, unsigned int* outLen) {
    if (!get_inst(result).has_value()) { *outLen = 0; return nullptr; }
    return sv_to_ptr(get_inst(result)->get_protocol(), outLen);
}

const char* ada_get_hostname(void* result, unsigned int* outLen) {
    if (!get_inst(result).has_value()) { *outLen = 0; return nullptr; }
    return sv_to_ptr(get_inst(result)->get_hostname(), outLen);
}

const char* ada_get_port(void* result, unsigned int* outLen) {
    if (!get_inst(result).has_value()) { *outLen = 0; return nullptr; }
    return sv_to_ptr(get_inst(result)->get_port(), outLen);
}

const char* ada_get_pathname(void* result, unsigned int* outLen) {
    if (!get_inst(result).has_value()) { *outLen = 0; return nullptr; }
    return sv_to_ptr(get_inst(result)->get_pathname(), outLen);
}

const char* ada_get_search(void* result, unsigned int* outLen) {
    if (!get_inst(result).has_value()) { *outLen = 0; return nullptr; }
    return sv_to_ptr(get_inst(result)->get_search(), outLen);
}

const char* ada_get_hash(void* result, unsigned int* outLen) {
    if (!get_inst(result).has_value()) { *outLen = 0; return nullptr; }
    return sv_to_ptr(get_inst(result)->get_hash(), outLen);
}

const char* ada_get_username(void* result, unsigned int* outLen) {
    if (!get_inst(result).has_value()) { *outLen = 0; return nullptr; }
    return sv_to_ptr(get_inst(result)->get_username(), outLen);
}

const char* ada_get_password(void* result, unsigned int* outLen) {
    if (!get_inst(result).has_value()) { *outLen = 0; return nullptr; }
    return sv_to_ptr(get_inst(result)->get_password(), outLen);
}

const char* ada_get_origin(void* result, unsigned int* outLen) {
    if (!get_inst(result).has_value()) { *outLen = 0; return nullptr; }
    // get_origin() returns a std::string (owned), not a string_view.
    // We need to copy it to malloc'd memory so it survives.
    std::string origin = get_inst(result)->get_origin();
    *outLen = static_cast<unsigned int>(origin.size());
    char* copy = (char*)malloc(origin.size());
    memcpy(copy, origin.data(), origin.size());
    return copy;
}

} // extern "C"
