#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-/workspace/jdk/jdk-21.0.12.1}"
export ANDROID_HOME="${ANDROID_HOME:-/workspace/android-sdk}"
export ANDROID_USER_HOME="${ANDROID_USER_HOME:-/workspace/android-user}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-/workspace/gradle-cache}"
mkdir -p "$ANDROID_USER_HOME" "$GRADLE_USER_HOME"
# Java does not read HTTPS_PROXY; route through the existing platform proxy.
if [[ -n "${HTTPS_PROXY:-}" ]]; then
  cricket_proxy_host=$(node -e 'process.stdout.write(new URL(process.env.HTTPS_PROXY).hostname)')
  cricket_proxy_port=$(node -e 'process.stdout.write(new URL(process.env.HTTPS_PROXY).port || "80")')
  export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} -Dhttps.proxyHost=$cricket_proxy_host -Dhttps.proxyPort=$cricket_proxy_port -Dhttp.proxyHost=$cricket_proxy_host -Dhttp.proxyPort=$cricket_proxy_port"
fi
# Reuse the machine's managed CA store, preserving TLS verification.
if [[ -f /etc/ssl/certs/java/cacerts ]]; then
  export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts"
fi
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} -Duser.home=$ANDROID_USER_HOME"
npm run android:sync
bash android/gradlew -p android assembleDebug --max-workers=2
