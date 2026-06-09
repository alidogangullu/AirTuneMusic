cmake_minimum_required(VERSION 3.22)
project(airtune_jni CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_C_STANDARD 11)

add_definitions(
    -DANDROID
    -DNO_GSTREAMER
    -DNOHOLD
    -D_REENTRANT
    -DSTANDALONE
    -D__STDC_CONSTANT_MACROS
    -D__STDC_LIMIT_MACROS
    -DTARGET_POSIX
    -D_LINUX
    -fPIC
    -DTARGET_RT_LITTLE_ENDIAN=1
)

set(UXPLAY_LIB ${CMAKE_CURRENT_SOURCE_DIR}/uxplay)

# ── llhttp ────────────────────────────────────────────────────────────────────
add_library(llhttp STATIC
    ${UXPLAY_LIB}/llhttp/llhttp.c
    ${UXPLAY_LIB}/llhttp/http.c
    ${UXPLAY_LIB}/llhttp/api.c
)
target_include_directories(llhttp PUBLIC ${UXPLAY_LIB}/llhttp)

# ── playfair ──────────────────────────────────────────────────────────────────
add_library(playfair STATIC
    ${UXPLAY_LIB}/playfair/playfair.c
    ${UXPLAY_LIB}/playfair/hand_garble.c
    ${UXPLAY_LIB}/playfair/modified_md5.c
    ${UXPLAY_LIB}/playfair/omg_hax.c
    ${UXPLAY_LIB}/playfair/sap_hash.c
)
target_include_directories(playfair PUBLIC ${UXPLAY_LIB}/playfair)

# ── OpenSSL prebuilt ──────────────────────────────────────────────────────────
set(OPENSSL_DIR ${CMAKE_CURRENT_SOURCE_DIR}/openssl/${ANDROID_ABI})
if(EXISTS ${OPENSSL_DIR})
    add_library(ssl STATIC IMPORTED)
    set_target_properties(ssl PROPERTIES IMPORTED_LOCATION ${OPENSSL_DIR}/lib/libssl.a)
    add_library(crypto STATIC IMPORTED)
    set_target_properties(crypto PROPERTIES IMPORTED_LOCATION ${OPENSSL_DIR}/lib/libcrypto.a)
    set(OPENSSL_INCLUDE ${OPENSSL_DIR}/include)
else()
    message(WARNING "OpenSSL prebuilt not found at ${OPENSSL_DIR}")
    add_library(ssl INTERFACE)
    add_library(crypto INTERFACE)
    set(OPENSSL_INCLUDE "")
endif()

# ── libplist ──────────────────────────────────────────────────────────────────
set(PLIST_SRC ${CMAKE_CURRENT_SOURCE_DIR}/libplist)
add_library(plist STATIC
    ${PLIST_SRC}/src/plist.c
    ${PLIST_SRC}/src/bplist.c
    ${PLIST_SRC}/src/xplist.c
    ${PLIST_SRC}/src/jplist.c
    ${PLIST_SRC}/src/oplist.c
    ${PLIST_SRC}/src/bytearray.c
    ${PLIST_SRC}/src/hashtable.c
    ${PLIST_SRC}/src/ptrarray.c
    ${PLIST_SRC}/src/base64.c
    ${PLIST_SRC}/src/jsmn.c
    ${PLIST_SRC}/src/time64.c
    ${PLIST_SRC}/src/out-default.c
    ${PLIST_SRC}/src/out-limd.c
    ${PLIST_SRC}/src/out-plutil.c
    ${PLIST_SRC}/libcnary/cnary.c
    ${PLIST_SRC}/libcnary/node.c
    ${PLIST_SRC}/libcnary/node_list.c
)
target_include_directories(plist PUBLIC
    ${PLIST_SRC}/include
    ${PLIST_SRC}/src
    ${PLIST_SRC}/libcnary/include
)
target_compile_definitions(plist PRIVATE PACKAGE_VERSION="2.6.0" HAVE_STRNDUP=1)
target_compile_options(plist PRIVATE -Wno-unused-result -Wno-unused-function -Wno-static-local-in-inline)
set(PLIST_INCLUDE ${PLIST_SRC}/include)

# ── Apple ALAC decoder (Apache 2.0) ──────────────────────────────────────────
set(ALAC_SRC ${CMAKE_CURRENT_SOURCE_DIR}/alac)
add_library(alac STATIC
    ${ALAC_SRC}/ALACDecoder.cpp
    ${ALAC_SRC}/ALACBitUtilities.c
    ${ALAC_SRC}/ag_dec.c
    ${ALAC_SRC}/dp_dec.c
    ${ALAC_SRC}/matrix_dec.c
    ${ALAC_SRC}/EndianPortable.c
)
target_include_directories(alac PUBLIC ${ALAC_SRC})
target_compile_options(alac PRIVATE -Wno-unused-variable -Wno-unused-function)

# ── UxPlay core (no GStreamer/renderers) ──────────────────────────────────────
add_library(uxplay_core STATIC
    ${UXPLAY_LIB}/byteutils.c
    ${UXPLAY_LIB}/crypto.c
    ${UXPLAY_LIB}/fairplay_playfair.c
    ${UXPLAY_LIB}/http_request.c
    ${UXPLAY_LIB}/http_response.c
    ${UXPLAY_LIB}/httpd.c
    ${UXPLAY_LIB}/logger.c
    ${UXPLAY_LIB}/mirror_buffer.c
    ${UXPLAY_LIB}/netutils.c
    ${UXPLAY_LIB}/pairing.c
    ${UXPLAY_LIB}/raop.c
    ${UXPLAY_LIB}/raop_buffer.c
    ${UXPLAY_LIB}/raop_ntp.c
    ${UXPLAY_LIB}/raop_rtp.c
    ${UXPLAY_LIB}/raop_rtp_mirror.c
    ${UXPLAY_LIB}/srp.c
    ${UXPLAY_LIB}/utils.c
)
target_include_directories(uxplay_core PUBLIC
    ${UXPLAY_LIB}
    ${OPENSSL_INCLUDE}
    ${PLIST_INCLUDE}
)
target_link_libraries(uxplay_core llhttp playfair plist ssl crypto)

# ── Android system libraries ──────────────────────────────────────────────────
find_library(log-lib log)
find_library(android-lib android)

# ── airtune_jni shared library ────────────────────────────────────────────────
add_library(airtune_jni SHARED
    native_bridge.cpp
    android_raop_callbacks.c
    android_dnssd_shim.c
)

target_include_directories(airtune_jni PRIVATE
    ${UXPLAY_LIB}
    ${OPENSSL_INCLUDE}
    ${PLIST_INCLUDE}
    ${ALAC_SRC}
)

target_link_libraries(airtune_jni
    uxplay_core
    alac
    ${log-lib}
    ${android-lib}
)
