#!/usr/bin/env bash
# Builds the Mega Wall mod into dist/megawall.jar.
#
# One jar works on a PC and on Android:
#   .class files  -> used by the desktop game
#   classes.dex   -> used by the Android game (Mindustry looks for it at the jar root)
#   mod.hjson, sprites, bundles
#
# Needs: JDK 17+ (javac, jar, java), curl, internet access to jitpack.io and dl.google.com.
set -euo pipefail

# Keep in sync with minGameVersion in src/main/resources/mod.hjson.
MINDUSTRY_VERSION="v160.7"                                   # jitpack tag of the game build
ARC_VERSION="7445105cd2"                                     # Arc revision used by that build (from its POM)
RHINO_VERSION="32395f942976a6d1d21ec9877664554cd5762306"     # from the same POM
LZ4_VERSION="1.10.2"                                         # from the same POM
R8_VERSION="8.9.35"                                          # the R8 jar also contains the D8 dexer

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD="$HERE/build"
LIBS="$BUILD/libs"
TOOLS="$BUILD/tools"

fetch() {  # fetch <url> <file>: download once; a failed download never leaves a partial file behind
  local url="$1" file="$2"
  if [ ! -s "$file" ]; then
    echo "download $(basename "$file")"
    # Maven hosts answer 429 (too many requests) now and then: retry slowly instead of failing.
    curl -fsSL --retry 6 --retry-all-errors --retry-delay 5 "$url" -o "$file.part"
    mv "$file.part" "$file"
  fi
}

mkdir -p "$LIBS" "$TOOLS"

# Mindustry itself, Arc (its engine) and the libraries Mindustry's POM depends on.
fetch "https://jitpack.io/com/github/Anuken/Mindustry/core/$MINDUSTRY_VERSION/core-$MINDUSTRY_VERSION.jar" "$LIBS/core.jar"
for module in arc-core flabel freetype g3d fx arcnet; do
  fetch "https://jitpack.io/com/github/Anuken/Arc/$module/$ARC_VERSION/$module-$ARC_VERSION.jar" "$LIBS/$module.jar"
done
fetch "https://jitpack.io/com/github/Anuken/rhino/$RHINO_VERSION/rhino-$RHINO_VERSION.jar" "$LIBS/rhino.jar"
fetch "https://repo1.maven.org/maven2/at/yawk/lz4/lz4-java/$LZ4_VERSION/lz4-java-$LZ4_VERSION.jar" "$LIBS/lz4-java.jar"
fetch "https://dl.google.com/dl/android/maven2/com/android/tools/r8/$R8_VERSION/r8-$R8_VERSION.jar" "$TOOLS/r8.jar"

CLASSPATH="$(ls "$LIBS"/*.jar | paste -sd: -)"

# 1. Compile. Java 8 bytecode runs on every desktop JVM and is accepted by D8.
rm -rf "$BUILD/classes" && mkdir -p "$BUILD/classes"
javac --release 8 -Xlint:-options -cp "$CLASSPATH" -d "$BUILD/classes" \
  $(find "$HERE/src/main/java" -name '*.java')

# 2. Pack the classes (also the input for D8) and the desktop jar with mod resources.
jar --create --file "$BUILD/megawall-classes.jar" -C "$BUILD/classes" .
jar --create --file "$BUILD/megawall.jar" -C "$BUILD/classes" . -C "$HERE/src/main/resources" .

# 3. Android: convert the classes to DEX and put classes.dex at the root of the same jar.
JDK_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"
DEX_CLASSPATH=()
for jar in "$LIBS"/*.jar; do DEX_CLASSPATH+=(--classpath "$jar"); done
rm -rf "$BUILD/dex" && mkdir -p "$BUILD/dex"
java -cp "$TOOLS/r8.jar" com.android.tools.r8.D8 --release --min-api 21 \
  --lib "$JDK_HOME" "${DEX_CLASSPATH[@]}" --output "$BUILD/dex" "$BUILD/megawall-classes.jar"
jar --update --file "$BUILD/megawall.jar" -C "$BUILD/dex" classes.dex

# 4. Publish.
mkdir -p "$HERE/dist"
cp "$BUILD/megawall.jar" "$HERE/dist/megawall.jar"
echo "built: $HERE/dist/megawall.jar"
unzip -l "$HERE/dist/megawall.jar" | grep -E 'classes\.dex|mod\.hjson|megawall/|sprites/|bundles/'
