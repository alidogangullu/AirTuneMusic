/*
 * Implements raop_callbacks_t by forwarding to Java/Kotlin via JNI.
 * All callbacks fire from RAOP's internal pthreads, so we AttachCurrentThread.
 */

#include <stdlib.h>
#include <string.h>
#include <android/log.h>
#include "android_raop_callbacks.h"

#define TAG "AirPlayNative"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

static JNIEnv *_get_env(android_callback_ctx_t *ctx) {
    JNIEnv *env = NULL;
    int status = (*ctx->jvm)->GetEnv(ctx->jvm, (void **)&env, JNI_VERSION_1_6);
    if (status == JNI_EDETACHED) {
        (*ctx->jvm)->AttachCurrentThread(ctx->jvm, &env, NULL);
    }
    if (env && (*env)->ExceptionCheck(env)) {
        (*env)->ExceptionClear(env);
    }
    return env;
}

void android_callbacks_init(android_callback_ctx_t *ctx, JNIEnv *env, jobject callback_obj) {
    (*env)->GetJavaVM(env, &ctx->jvm);
    ctx->callback_obj = (*env)->NewGlobalRef(env, callback_obj);
    ctx->h265_enabled = 1;
    ctx->require_pin = 0;
    ctx->registered_count = 0;
    memset(ctx->registered_keys, 0, sizeof(ctx->registered_keys));

    jclass cls = (*env)->GetObjectClass(env, callback_obj);
    ctx->on_video_data    = (*env)->GetMethodID(env, cls, "onVideoData",    "([BJZ)V");
    ctx->on_audio_data    = (*env)->GetMethodID(env, cls, "onAudioData",    "([BIJI)V");
    ctx->on_audio_format  = (*env)->GetMethodID(env, cls, "onAudioFormat",  "(IIZ)V");
    ctx->on_video_size    = (*env)->GetMethodID(env, cls, "onVideoSize",    "(FFFF)V");
    ctx->on_volume_change = (*env)->GetMethodID(env, cls, "onVolumeChange", "(F)V");
    ctx->on_conn_init     = (*env)->GetMethodID(env, cls, "onConnectionInit",    "()V");
    ctx->on_conn_destroy  = (*env)->GetMethodID(env, cls, "onConnectionDestroy", "()V");
    ctx->on_conn_reset    = (*env)->GetMethodID(env, cls, "onConnectionReset",   "(I)V");
    ctx->on_display_pin   = (*env)->GetMethodID(env, cls, "onDisplayPin",   "(Ljava/lang/String;)V");
    ctx->on_metadata      = (*env)->GetMethodID(env, cls, "onMetadata",     "([B)V");
    ctx->on_coverart      = (*env)->GetMethodID(env, cls, "onCoverArt",     "([B)V");
    ctx->on_progress      = (*env)->GetMethodID(env, cls, "onProgress",     "(JJJ)V");
    ctx->on_dacp_id       = (*env)->GetMethodID(env, cls, "onDacpId",       "(Ljava/lang/String;Ljava/lang/String;)V");
    ctx->on_client_name   = (*env)->GetMethodID(env, cls, "onClientName",   "(Ljava/lang/String;)V");
    (*env)->DeleteLocalRef(env, cls);
}

void android_callbacks_destroy(android_callback_ctx_t *ctx, JNIEnv *env) {
    if (ctx->callback_obj) {
        (*env)->DeleteGlobalRef(env, ctx->callback_obj);
        ctx->callback_obj = NULL;
    }
    for (int i = 0; i < ctx->registered_count; i++) {
        free(ctx->registered_keys[i]);
        ctx->registered_keys[i] = NULL;
    }
    ctx->registered_count = 0;
}

/* --- RAOP callback implementations --- */

static void _audio_process(void *cls, raop_ntp_t *ntp, audio_decode_struct *data) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    JNIEnv *env = _get_env(ctx);
    if (!env || !data->data || data->data_len <= 0) return;

    jbyteArray arr = (*env)->NewByteArray(env, data->data_len);
    (*env)->SetByteArrayRegion(env, arr, 0, data->data_len, (jbyte *)data->data);
    (*env)->CallVoidMethod(env, ctx->callback_obj, ctx->on_audio_data,
                           arr, (jint)data->ct, (jlong)data->ntp_time_local, (jint)data->seqnum);
    (*env)->DeleteLocalRef(env, arr);
}

static void _video_process(void *cls, raop_ntp_t *ntp, video_decode_struct *data) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    JNIEnv *env = _get_env(ctx);
    if (!env || !data->data || data->data_len <= 0) return;

    jbyteArray arr = (*env)->NewByteArray(env, data->data_len);
    (*env)->SetByteArrayRegion(env, arr, 0, data->data_len, (jbyte *)data->data);
    (*env)->CallVoidMethod(env, ctx->callback_obj, ctx->on_video_data,
                           arr, (jlong)data->ntp_time_local, (jboolean)data->is_h265);
    (*env)->DeleteLocalRef(env, arr);
}

static void _conn_init(void *cls) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    JNIEnv *env = _get_env(ctx);
    if (!env) return;
    (*env)->CallVoidMethod(env, ctx->callback_obj, ctx->on_conn_init);
}

static void _conn_destroy(void *cls) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    JNIEnv *env = _get_env(ctx);
    if (!env) return;
    (*env)->CallVoidMethod(env, ctx->callback_obj, ctx->on_conn_destroy);
}

static void _conn_reset(void *cls, int timeouts, bool reset_video) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    JNIEnv *env = _get_env(ctx);
    if (!env) return;
    (*env)->CallVoidMethod(env, ctx->callback_obj, ctx->on_conn_reset, (jint)timeouts);
}

static void _audio_set_volume(void *cls, float volume) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    JNIEnv *env = _get_env(ctx);
    if (!env) return;
    (*env)->CallVoidMethod(env, ctx->callback_obj, ctx->on_volume_change, (jfloat)volume);
}

static void _audio_get_format(void *cls, unsigned char *ct, unsigned short *spf,
                               bool *usingScreen, bool *isMedia, uint64_t *audioFormat) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    JNIEnv *env = _get_env(ctx);
    if (!env) return;
    (*env)->CallVoidMethod(env, ctx->callback_obj, ctx->on_audio_format,
                           (jint)*ct, (jint)*spf, (jboolean)*usingScreen);
}

static void _video_report_size(void *cls, float *w_src, float *h_src, float *w, float *h) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    JNIEnv *env = _get_env(ctx);
    if (!env) return;
    (*env)->CallVoidMethod(env, ctx->callback_obj, ctx->on_video_size,
                           (jfloat)*w_src, (jfloat)*h_src, (jfloat)*w, (jfloat)*h);
}

static void _display_pin(void *cls, char *pin) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    JNIEnv *env = _get_env(ctx);
    if (!env) return;
    jstring jpin = (*env)->NewStringUTF(env, pin ? pin : "");
    (*env)->CallVoidMethod(env, ctx->callback_obj, ctx->on_display_pin, jpin);
    (*env)->DeleteLocalRef(env, jpin);
}

static void _audio_set_metadata(void *cls, const void *buf, int len) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    JNIEnv *env = _get_env(ctx);
    if (!env || !buf || len <= 0) return;
    jbyteArray arr = (*env)->NewByteArray(env, len);
    (*env)->SetByteArrayRegion(env, arr, 0, len, (jbyte *)buf);
    (*env)->CallVoidMethod(env, ctx->callback_obj, ctx->on_metadata, arr);
    (*env)->DeleteLocalRef(env, arr);
}

static void _audio_set_coverart(void *cls, const void *buf, int len) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    JNIEnv *env = _get_env(ctx);
    if (!env || !buf || len <= 0) return;
    jbyteArray arr = (*env)->NewByteArray(env, len);
    (*env)->SetByteArrayRegion(env, arr, 0, len, (jbyte *)buf);
    (*env)->CallVoidMethod(env, ctx->callback_obj, ctx->on_coverart, arr);
    (*env)->DeleteLocalRef(env, arr);
}

static void _audio_remote_control_id(void *cls, const char *dacp_id, const char *active_remote) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    JNIEnv *env = _get_env(ctx);
    if (!env) return;
    jstring jdacp   = (*env)->NewStringUTF(env, dacp_id       ? dacp_id       : "");
    jstring jremote = (*env)->NewStringUTF(env, active_remote ? active_remote : "");
    (*env)->CallVoidMethod(env, ctx->callback_obj, ctx->on_dacp_id, jdacp, jremote);
    (*env)->DeleteLocalRef(env, jdacp);
    (*env)->DeleteLocalRef(env, jremote);
}

static void _audio_set_progress(void *cls, unsigned int start, unsigned int curr, unsigned int end) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    JNIEnv *env = _get_env(ctx);
    if (!env) return;
    (*env)->CallVoidMethod(env, ctx->callback_obj, ctx->on_progress,
                           (jlong)start, (jlong)curr, (jlong)end);
}

static void _register_client(void *cls, const char *device_id, const char *pk_str, const char *name) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    (void)device_id; (void)name;
    if (ctx->registered_count >= 16) return;
    for (int i = 0; i < ctx->registered_count; i++) {
        if (ctx->registered_keys[i] && strcmp(ctx->registered_keys[i], pk_str) == 0) return;
    }
    ctx->registered_keys[ctx->registered_count++] = strdup(pk_str);
}

static bool _check_register(void *cls, const char *pk_str) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    for (int i = 0; i < ctx->registered_count; i++) {
        if (ctx->registered_keys[i] && strcmp(ctx->registered_keys[i], pk_str) == 0) return true;
    }
    return false;
}

static void _video_set_codec(void *cls, video_codec_t codec) {
    (void)cls; (void)codec;
}

/* Stubs */
static void _noop(void *cls) { (void)cls; }
static void _noop_teardown(void *cls, bool *a, bool *b) { (void)cls; (void)a; (void)b; }
static void _video_reset(void *cls) { (void)cls; }
static void _report_client(void *cls, char *did, char *model, char *name, bool *admit) {
    android_callback_ctx_t *ctx = (android_callback_ctx_t *)cls;
    (void)did; (void)model;
    if (admit) *admit = true;
    if (name && ctx->on_client_name) {
        JNIEnv *env = _get_env(ctx);
        if (env) {
            jstring jname = (*env)->NewStringUTF(env, name);
            (*env)->CallVoidMethod(env, ctx->callback_obj, ctx->on_client_name, jname);
            (*env)->DeleteLocalRef(env, jname);
        }
    }
}
static void _export_dacp(void *cls, const char *ar, const char *id) { (void)cls; (void)ar; (void)id; }

void android_callbacks_fill(raop_callbacks_t *cbs, android_callback_ctx_t *ctx) {
    memset(cbs, 0, sizeof(raop_callbacks_t));
    cbs->cls = ctx;

    cbs->audio_process         = _audio_process;
    cbs->video_process         = _video_process;
    cbs->conn_init             = _conn_init;
    cbs->conn_destroy          = _conn_destroy;
    cbs->conn_reset            = _conn_reset;
    cbs->conn_teardown         = _noop_teardown;
    cbs->video_pause           = _noop;
    cbs->video_resume          = _noop;
    cbs->video_reset           = _video_reset;
    cbs->video_flush           = _noop;
    cbs->video_report_size     = _video_report_size;
    cbs->audio_flush           = _noop;
    cbs->audio_set_volume      = _audio_set_volume;
    cbs->audio_get_format      = _audio_get_format;
    cbs->audio_set_metadata    = _audio_set_metadata;
    cbs->audio_set_coverart    = _audio_set_coverart;
    cbs->audio_remote_control_id = _audio_remote_control_id;
    cbs->audio_set_progress    = _audio_set_progress;
    cbs->display_pin           = _display_pin;
    cbs->video_set_codec       = _video_set_codec;
    cbs->report_client_request = _report_client;
    cbs->export_dacp           = _export_dacp;
    if (ctx->require_pin) {
        cbs->check_register  = _check_register;
        cbs->register_client = _register_client;
    }
}
