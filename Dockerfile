# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                     🐳  BASHCRAWL DOCKERFILE  🐳                        ║
# ║                                                                           ║
# ║  Multi-stage build for game, TUI, viewer, linting, and testing           ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
#
# Targets:
#   game    — Bash-only game environment (default)
#   tui     — Python Textual TUI (terminal-illness)
#   viewer  — Flask log/screenshot viewer
#   test    — Pytest test runner
#   lint    — ShellCheck + yamllint + markdownlint
#
# Build examples:
#   docker build -t bashcrawl .                          # default: game
#   docker build --target tui -t bashcrawl-tui .
#   docker build --target viewer -t bashcrawl-viewer .
#   docker build --target test -t bashcrawl-test .
#   docker build --target lint -t bashcrawl-lint .

# ============================================================================
# Stage: base — shared foundation for all targets
# ============================================================================
FROM ubuntu:24.04 AS base

LABEL maintainer="Bashcrawl Development Team <team@bashcrawl.org>"
LABEL org.opencontainers.image.source="https://github.com/bamr87/bashcrawl"
LABEL org.opencontainers.image.description="Bashcrawl — terminal adventure game"

ENV DEBIAN_FRONTEND=noninteractive
ENV BASHCRAWL_ROOT=/opt/bashcrawl

RUN apt-get update && apt-get install -y --no-install-recommends \
        bash \
        coreutils \
        grep \
        sed \
        gawk \
        findutils \
        less \
        file \
        tree \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR ${BASHCRAWL_ROOT}

# Copy game content and library scripts
COPY entrance/ entrance/
COPY lib/ lib/
COPY main.sh setup.sh help.sh test_json.sh ./
COPY src/help/ src/help/
COPY .shellcheckrc .env.example ./
COPY .ancient_codex_of_terminal_mastery ./

# Make game files executable
RUN bash setup.sh --quick 2>/dev/null || true
RUN chmod +x main.sh setup.sh help.sh

# ============================================================================
# Stage: game — lightweight bash-only game (default target)
# ============================================================================
FROM base AS game

# Logs volume for persistent session data
VOLUME ["/opt/bashcrawl/logs"]

ENTRYPOINT ["bash"]
CMD ["main.sh", "--interactive"]

# ============================================================================
# Stage: python-base — shared Python layer for TUI, viewer, and tests
# ============================================================================
FROM base AS python-base

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment to keep pip packages isolated
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv ${VIRTUAL_ENV}
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# ============================================================================
# Stage: tui — Python Textual terminal-illness TUI
# ============================================================================
FROM python-base AS tui

COPY src/terminal-illness/ src/terminal-illness/

RUN pip install --no-cache-dir -r src/terminal-illness/requirements.txt

ENV PYTHONPATH="${BASHCRAWL_ROOT}/src/terminal-illness"
ENV TERM=xterm-256color

VOLUME ["/opt/bashcrawl/logs"]

ENTRYPOINT ["python3", "-m", "ti"]
CMD ["--game-root", "/opt/bashcrawl"]

# ============================================================================
# Stage: viewer — Flask log/screenshot viewer
# ============================================================================
FROM python-base AS viewer

COPY src/viewer/ src/viewer/

RUN pip install --no-cache-dir -r src/viewer/requirements.txt

ENV PYTHONPATH="${BASHCRAWL_ROOT}/src"

VOLUME ["/opt/bashcrawl/logs"]

EXPOSE 5000

ENTRYPOINT ["python3", "-m", "viewer"]
CMD ["--host", "0.0.0.0", "--port", "5000", "--game-root", "/opt/bashcrawl"]

# ============================================================================
# Stage: test — pytest runner
# ============================================================================
FROM python-base AS test

# Additional test tooling
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
    && rm -rf /var/lib/apt/lists/*

COPY src/terminal-illness/ src/terminal-illness/
COPY src/viewer/ src/viewer/
COPY test/ test/

RUN pip install --no-cache-dir \
    -r src/terminal-illness/requirements.txt \
    -r src/viewer/requirements.txt \
    -r test/requirements.txt

ENV PYTHONPATH="${BASHCRAWL_ROOT}/src/terminal-illness"

WORKDIR ${BASHCRAWL_ROOT}/test

ENTRYPOINT ["pytest"]
CMD ["-m", "not ai and not demo", "--timeout=30", "-v"]

# ============================================================================
# Stage: lint — ShellCheck + yamllint + markdownlint
# ============================================================================
FROM base AS lint

RUN apt-get update && apt-get install -y --no-install-recommends \
        shellcheck \
        python3 \
        python3-pip \
        python3-venv \
        nodejs \
        npm \
    && rm -rf /var/lib/apt/lists/*

# Create venv for Python lint tools
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv ${VIRTUAL_ENV}
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"

RUN pip install --no-cache-dir yamllint
RUN npm install -g markdownlint-cli

# Copy config files needed for linting
COPY .yamllint.yml .markdownlint.json ./
COPY docs/ docs/
COPY .github/ .github/

ENTRYPOINT ["/bin/bash", "-c"]
CMD ["echo '=== ShellCheck ===' && shellcheck *.sh src/help/*.sh lib/*.sh && echo '=== yamllint ===' && yamllint -c .yamllint.yml .github/workflows/*.yml && echo '=== markdownlint ===' && markdownlint '**/*.md' --config .markdownlint.json && echo '✅ All lint checks passed'"]
