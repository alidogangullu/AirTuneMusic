/*
 * JNI bridge between Kotlin AirPipeModule and the C RAOP library.
 * Architecture mirrors jqssun/android-airplay-server.
 */

#include <jni.h>
#include <string.h>
#include <stdlib.h>
#include <android/log.h>

extern "C" {
#include "raop.h"
#include "dnssd.h"
#include "logger.h"
#include "android_raop_callbacks.h"
#include "android_dnssd_shim.h"
}

#include "ALACDecoder.h"
#include "ALACBitUtilities.h"

#define TAG "AirPipeNative"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

typedef struct {
    raop_t               *raop;
    dnssd_t              *dnssd;
    android_callback_ctx_t cb_ctx;
    raop_callbacks_t      callbacks;
    char                  hw_addr[6];
} server_ctx_t;

static void _log_callback(void * /*cls*/, int level, const char *msg) {
    int prio = ANDROID_LOG_DEBUG;
    if      (level >= 5) prio = ANDROID_LOG_ERROR;
    else if (level >= 4) prio = ANDROID_LOG_WARN;
    else if (level >= 3) prio = ANDROID_LOG_INFO;
    __android_log_print(prio, TAG, "%s", msg);
}

// ── nativeInit ────────────────────────────────────────────────────────────────

extern "C" JNIEXPORT jlong JNICALL
Java_com_adg_airtunemusic_airplay_AirPlayModule_nativeInit(
        JNIEnv *env, jobject /*thiz*/,
        jobject callback, jbyteArray hwAddr, jstring name,
        jstring keyFile, jboolean nohold, jboolean requirePin) {

    server_ctx_t *ctx = (server_ctx_t *)calloc(1, sizeof(server_ctx_t));
    if (!ctx) return 0;

    jsize hw_len = env->GetArrayLength(hwAddr);
    if (hw_len > 6) hw_len = 6;
    env->GetByteArrayRegion(hwAddr, 0, hw_len, (jbyte *)ctx->hw_addr);

    android_callbacks_init(&ctx->cb_ctx, env, callback);
    ctx->cb_ctx.require_pin = requirePin ? 1 : 0;
    android_callbacks_fill(&ctx->callbacks, &ctx->cb_ctx);

    ctx->raop = raop_init(&ctx->callbacks);
    if (!ctx->raop) {
        LOGE("raop_init failed");
        android_callbacks_destroy(&ctx->cb_ctx, env);
        free(ctx);
        return 0;
    }

    raop_set_log_level(ctx->raop, 3);
    raop_set_log_callback(ctx->raop, _log_callback, nullptr);

    const char *keyfile_c = env->GetStringUTFChars(keyFile, nullptr);
    const char *name_c    = env->GetStringUTFChars(name,    nullptr);

    char device_id[18];
    snprintf(device_id, sizeof(device_id), "%02X:%02X:%02X:%02X:%02X:%02X",
             (unsigned char)ctx->hw_addr[0], (unsigned char)ctx->hw_addr[1],
             (unsigned char)ctx->hw_addr[2], (unsigned char)ctx->hw_addr[3],
             (unsigned char)ctx->hw_addr[4], (unsigned char)ctx->hw_addr[5]);

    int ret = raop_init2(ctx->raop, nohold ? 1 : 0, device_id, keyfile_c);
    if (ret < 0) LOGE("raop_init2 failed: %d", ret);

    if (requirePin) raop_set_plist(ctx->raop, "pin", 0);

    int dns_err = 0;
    ctx->dnssd = dnssd_init(name_c, (int)strlen(name_c),
                             ctx->hw_addr, 6, &dns_err,
                             requirePin ? 1 : 0);
    if (!ctx->dnssd) {
        LOGE("dnssd_init failed: %d", dns_err);
    } else {
        raop_set_dnssd(ctx->raop, ctx->dnssd);
    }

    env->ReleaseStringUTFChars(keyFile, keyfile_c);
    env->ReleaseStringUTFChars(name,    name_c);

    return (jlong)(intptr_t)ctx;
}

// ── nativeStart ───────────────────────────────────────────────────────────────

extern "C" JNIEXPORT jint JNICALL
Java_com_adg_airtunemusic_airplay_AirPlayModule_nativeStart(
        JNIEnv * /*env*/, jobject /*thiz*/, jlong handle, jint requestedPort) {

    server_ctx_t *ctx = (server_ctx_t *)(intptr_t)handle;
    if (!ctx || !ctx->raop) return -1;

    if (requestedPort > 0) raop_set_port(ctx->raop, (unsigned short)requestedPort);
    unsigned short port = (unsigned short)(requestedPort > 0 ? requestedPort : 0);
    int ret = raop_start(ctx->raop, &port);
    if (ret < 0) { LOGE("raop_start failed: %d", ret); return -1; }

    LOGI("AirPlay server started on port %d", (int)port);

    if (ctx->dnssd) {
        dnssd_register_raop(ctx->dnssd, port);
        dnssd_register_airplay(ctx->dnssd, port);
    }

    return (jint)port;
}

// ── nativeStop ────────────────────────────────────────────────────────────────

extern "C" JNIEXPORT void JNICALL
Java_com_adg_airtunemusic_airplay_AirPlayModule_nativeStop(
        JNIEnv * /*env*/, jobject /*thiz*/, jlong handle) {

    server_ctx_t *ctx = (server_ctx_t *)(intptr_t)handle;
    if (!ctx || !ctx->raop) return;

    raop_stop(ctx->raop);
    if (ctx->dnssd) {
        dnssd_unregister_raop(ctx->dnssd);
        dnssd_unregister_airplay(ctx->dnssd);
    }
    LOGI("AirPlay server stopped");
}

// ── nativeDestroy ─────────────────────────────────────────────────────────────

extern "C" JNIEXPORT void JNICALL
Java_com_adg_airtunemusic_airplay_AirPlayModule_nativeDestroy(
        JNIEnv *env, jobject /*thiz*/, jlong handle) {

    server_ctx_t *ctx = (server_ctx_t *)(intptr_t)handle;
    if (!ctx) return;

    if (ctx->raop)  { raop_destroy(ctx->raop);   ctx->raop  = nullptr; }
    if (ctx->dnssd) { dnssd_destroy(ctx->dnssd); ctx->dnssd = nullptr; }
    android_callbacks_destroy(&ctx->cb_ctx, env);
    free(ctx);
}

// ── nativeSetDisplaySize ──────────────────────────────────────────────────────

extern "C" JNIEXPORT void JNICALL
Java_com_adg_airtunemusic_airplay_AirPlayModule_nativeSetDisplaySize(
        JNIEnv * /*env*/, jobject /*thiz*/, jlong handle, jint w, jint h, jint fps) {

    server_ctx_t *ctx = (server_ctx_t *)(intptr_t)handle;
    if (!ctx || !ctx->raop) return;
    raop_set_plist(ctx->raop, "width",       w);
    raop_set_plist(ctx->raop, "height",      h);
    raop_set_plist(ctx->raop, "refreshRate", fps);
}

// ── TXT record helpers ────────────────────────────────────────────────────────

static jobject _build_txt_map(JNIEnv *env, dnssd_t *dnssd, int is_raop) {
    jclass    mapCls  = env->FindClass("java/util/HashMap");
    jmethodID mapInit = env->GetMethodID(mapCls, "<init>", "()V");
    jmethodID mapPut  = env->GetMethodID(mapCls, "put",
                            "(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;");
    jobject map = env->NewObject(mapCls, mapInit);

    int count = is_raop ? android_dnssd_get_raop_txt_count(dnssd)
                        : android_dnssd_get_airplay_txt_count(dnssd);
    for (int i = 0; i < count; i++) {
        const char *k = is_raop ? android_dnssd_get_raop_txt_key(dnssd, i)
                                : android_dnssd_get_airplay_txt_key(dnssd, i);
        const char *v = is_raop ? android_dnssd_get_raop_txt_val(dnssd, i)
                                : android_dnssd_get_airplay_txt_val(dnssd, i);
        if (k && v) {
            jstring jk = env->NewStringUTF(k), jv = env->NewStringUTF(v);
            env->CallObjectMethod(map, mapPut, jk, jv);
            env->DeleteLocalRef(jk); env->DeleteLocalRef(jv);
        }
    }
    env->DeleteLocalRef(mapCls);
    return map;
}

extern "C" JNIEXPORT jobject JNICALL
Java_com_adg_airtunemusic_airplay_AirPlayModule_nativeGetRaopTxtRecords(
        JNIEnv *env, jobject /*thiz*/, jlong handle) {
    server_ctx_t *ctx = (server_ctx_t *)(intptr_t)handle;
    if (!ctx || !ctx->dnssd) return nullptr;
    return _build_txt_map(env, ctx->dnssd, 1);
}

extern "C" JNIEXPORT jobject JNICALL
Java_com_adg_airtunemusic_airplay_AirPlayModule_nativeGetAirplayTxtRecords(
        JNIEnv *env, jobject /*thiz*/, jlong handle) {
    server_ctx_t *ctx = (server_ctx_t *)(intptr_t)handle;
    if (!ctx || !ctx->dnssd) return nullptr;
    return _build_txt_map(env, ctx->dnssd, 0);
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_adg_airtunemusic_airplay_AirPlayModule_nativeGetRaopServiceName(
        JNIEnv *env, jobject /*thiz*/, jlong handle) {
    server_ctx_t *ctx = (server_ctx_t *)(intptr_t)handle;
    if (!ctx || !ctx->dnssd) return nullptr;
    return env->NewStringUTF(android_dnssd_get_raop_servname(ctx->dnssd));
}

// ── nativeSetH265Enabled ──────────────────────────────────────────────────────

extern "C" JNIEXPORT void JNICALL
Java_com_adg_airtunemusic_airplay_AirPlayModule_nativeSetH265Enabled(
        JNIEnv * /*env*/, jobject /*thiz*/, jlong handle, jboolean enabled) {
    server_ctx_t *ctx = (server_ctx_t *)(intptr_t)handle;
    if (!ctx) return;
    ctx->cb_ctx.h265_enabled = enabled ? 1 : 0;
    if (ctx->dnssd) dnssd_set_airplay_features(ctx->dnssd, 42, enabled ? 1 : 0);
}

// ── Software ALAC decoder (Apple reference, Apache 2.0) ──────────────────────

extern "C" JNIEXPORT jlong JNICALL
Java_com_adg_airtunemusic_airplay_AirPlayModule_nativeAlacInit(
        JNIEnv * /*env*/, jobject /*thiz*/,
        jint frameLength, jint numChannels, jint bitDepth,
        jint pb, jint mb, jint kb) {

    ALACDecoder *dec = new ALACDecoder();
    if (!dec) return 0;

    uint8_t cookie[24];
    cookie[0]  = (frameLength >> 24) & 0xFF;
    cookie[1]  = (frameLength >> 16) & 0xFF;
    cookie[2]  = (frameLength >>  8) & 0xFF;
    cookie[3]  =  frameLength        & 0xFF;
    cookie[4]  = 0;                         /* compatibleVersion */
    cookie[5]  = (uint8_t)bitDepth;
    cookie[6]  = (uint8_t)pb;
    cookie[7]  = (uint8_t)mb;
    cookie[8]  = (uint8_t)kb;
    cookie[9]  = (uint8_t)numChannels;
    cookie[10] = 0; cookie[11] = 0xFF;      /* maxRun = 255 */
    cookie[12] = cookie[13] = cookie[14] = cookie[15] = 0; /* maxFrameBytes */
    cookie[16] = cookie[17] = cookie[18] = cookie[19] = 0; /* avgBitRate    */
    cookie[20] = 0; cookie[21] = 0;
    cookie[22] = 0xAC; cookie[23] = 0x44;  /* sampleRate = 44100 */

    int32_t status = dec->Init(cookie, sizeof(cookie));
    if (status != 0) {
        LOGE("ALACDecoder::Init failed: %d", status);
        delete dec;
        return 0;
    }
    LOGI("ALACDecoder initialized: frameLen=%d ch=%d bits=%d", frameLength, numChannels, bitDepth);
    return (jlong)(intptr_t)dec;
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_adg_airtunemusic_airplay_AirPlayModule_nativeAlacDecode(
        JNIEnv *env, jobject /*thiz*/, jlong handle, jbyteArray input) {

    ALACDecoder *dec = (ALACDecoder *)(intptr_t)handle;
    if (!dec || !input) return nullptr;

    int input_len   = env->GetArrayLength(input);
    jbyte *in_data  = env->GetByteArrayElements(input, nullptr);

    BitBuffer bits;
    BitBufferInit(&bits, (uint8_t *)in_data, input_len);

    uint32_t numFrames   = dec->mConfig.frameLength;
    uint32_t numChannels = dec->mConfig.numChannels;
    uint32_t outBytes    = numFrames * numChannels * (dec->mConfig.bitDepth / 8);
    uint8_t *pcm         = (uint8_t *)calloc(outBytes, 1);

    if (!pcm) {
        env->ReleaseByteArrayElements(input, in_data, JNI_ABORT);
        return nullptr;
    }

    uint32_t outSamples = 0;
    int32_t  status     = dec->Decode(&bits, pcm, numFrames, numChannels, &outSamples);
    env->ReleaseByteArrayElements(input, in_data, JNI_ABORT);

    if (status != 0 || outSamples == 0) { free(pcm); return nullptr; }

    int pcm_bytes   = outSamples * numChannels * (dec->mConfig.bitDepth / 8);
    jbyteArray result = env->NewByteArray(pcm_bytes);
    env->SetByteArrayRegion(result, 0, pcm_bytes, (jbyte *)pcm);
    free(pcm);
    return result;
}

extern "C" JNIEXPORT void JNICALL
Java_com_adg_airtunemusic_airplay_AirPlayModule_nativeAlacDestroy(
        JNIEnv * /*env*/, jobject /*thiz*/, jlong handle) {
    delete (ALACDecoder *)(intptr_t)handle;
}
