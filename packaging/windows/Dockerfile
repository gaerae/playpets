# Windows x64 cross build (MinGW) from Linux — no MSVC SDK license step.
# Makes the NSIS installer, the portable zip and an MSIX package signed with a test certificate.
# trixie: NSIS 3.10 ships Win\RestartManager.nsh, which the Tauri installer template needs.
# (appindicator is only there because the Tauri CLI probes the host for it even for Windows targets.)
# From the repo root: npm run dist:windows, which runs
#   docker build -t playpets-windows packaging/windows
#   docker run --rm -v "$PWD":/src:ro -v playpets-cargo-win:/usr/local/cargo/registry -v playpets-target-win:/work/src-tauri/target -v "$PWD/release/windows":/out playpets-windows
FROM rust:1-trixie
RUN apt-get update && apt-get install -y --no-install-recommends mingw-w64 nsis rsync zip libayatana-appindicator3-dev \
      osslsigncode openssl cmake clang git zlib1g-dev libicu-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/* \
    && rustup target add x86_64-pc-windows-gnu
# makemsix, Microsoft's own packer, built from a pinned commit. Its C++14 setting is raised to 17,
# which the system's ICU headers need.
RUN git clone https://github.com/microsoft/msix-packaging.git /opt/msix-packaging \
    && cd /opt/msix-packaging && git checkout -q 25a65f5c1690930813bcc10cdf1d59fa865f2bb1 \
    && sed -i 's/CMAKE_CXX_STANDARD 14/CMAKE_CXX_STANDARD 17/' CMakeLists.txt lib/xerces/CMakeLists.txt \
    && ./makelinux.sh --pack >/dev/null \
    && install -m 755 .vs/bin/makemsix /usr/local/bin/makemsix \
    && find .vs -name 'libmsix.so*' -exec install -m 644 {} /usr/local/lib/ \; && ldconfig \
    && rm -rf /opt/msix-packaging
# Node.js comes from the official image, so the Docker build uses the same Node major as .node-version.
COPY --from=node:26-trixie-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:26-trixie-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
COPY build.sh /usr/local/bin/windows-build.sh
COPY msix /usr/local/share/playpets-msix
CMD ["bash", "/usr/local/bin/windows-build.sh"]
