/* WASI stubs for QuickJS */
#include <stdint.h>
#include <stddef.h>

/* environ is not available in WASI as a global variable */
char **environ = (char**)0;

/* QuickJS REPL and standalone bytecode — not needed in reactor mode */
const uint8_t qjsc_standalone[] = { 0 };
const uint32_t qjsc_standalone_size = 0;
const uint8_t qjsc_repl[] = { 0 };
const uint32_t qjsc_repl_size = 0;
