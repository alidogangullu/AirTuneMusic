cmake_minimum_required(VERSION 3.13)

# This is the entry-point CMake for the app.
# It builds libappmodules.so (required by React Native New Architecture)
# AND our custom libairtune_jni.so (UxPlay JNI bridge).

project(appmodules)

# ── React Native New Architecture setup ──────────────────────────────────────
# Mirrors default-app-setup/CMakeLists.txt — required for libappmodules.so
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# ── Our custom JNI library ────────────────────────────────────────────────────
# Delegate to the existing CMakeLists.txt in cpp/
add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../cpp airtune_cpp)
