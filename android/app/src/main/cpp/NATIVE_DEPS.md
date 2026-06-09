# Native Dependency Setup

Before building, the following prebuilt libraries must be placed here:

## 1. OpenSSL (required by UxPlay crypto.c)

Download prebuilt `.a` files from https://github.com/KDAB/android_openssl/releases
and place them as:

```
openssl/
  arm64-v8a/
    include/   (OpenSSL headers)
    lib/
      libssl.a
      libcrypto.a
  armeabi-v7a/
    include/
    lib/
      libssl.a
      libcrypto.a
```

## 2. libplist (required by UxPlay for BPLIST parsing)

Cross-compile from https://github.com/libimobiledevice/libplist using the
Android NDK toolchain:

```bash
export NDK=/path/to/android-ndk-r27
export TOOLCHAIN=$NDK/toolchains/llvm/prebuilt/darwin-x86_64

# arm64-v8a
./autogen.sh
./configure --host=aarch64-linux-android \
  CC=$TOOLCHAIN/bin/aarch64-linux-android24-clang \
  --disable-shared --enable-static \
  --without-cython
make -j4
```

Place as:
```
plist/
  arm64-v8a/
    include/plist/
    lib/libplist-2.0.a
  armeabi-v7a/
    include/plist/
    lib/libplist-2.0.a
```

## Build without prebuilts (stub mode)

If OpenSSL or libplist are missing, CMakeLists.txt emits a WARNING and
continues. The resulting `airpipe_jni.so` will fail to link but the RN
UI layer still works (AirPipeModule catches UnsatisfiedLinkError).
