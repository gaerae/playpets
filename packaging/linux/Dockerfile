# Linux build (deb + AppImage) and headless e2e for PlayPets.
# From the repo root: npm run dist:linux, which runs
#   docker build -t playpets-linux packaging/linux
#   docker run --rm -v "$PWD":/src:ro -v playpets-cargo:/usr/local/cargo/registry -v playpets-target:/work/src-tauri/target -v "$PWD/release/linux":/out playpets-linux
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
