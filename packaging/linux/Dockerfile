# Linux build (deb + AppImage) and headless e2e for PlayPets.
# From the repo root: npm run dist:linux. scripts/local.mjs mounts sources read-only,
# preserves the build cache and forwards BUNDLES when set on the host.
# bookworm is the oldest Debian with webkit2gtk-4.1. The released deb and AppImage are built by CI on
# Ubuntu 22.04 instead (an older glibc, so they run on more systems); this image is for local builds.
FROM rust:1-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
      libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libssl-dev libdbus-1-dev \
      build-essential file patchelf xdg-utils rsync \
      xvfb xauth dbus-x11 \
    && rm -rf /var/lib/apt/lists/*
# Node.js comes from the official image, so the Docker build uses the same Node major as .node-version.
COPY --from=node:26-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:26-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
COPY build.sh /usr/local/bin/linux-build.sh
CMD ["bash", "/usr/local/bin/linux-build.sh"]
