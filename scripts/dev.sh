#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${TODOS_TRAINING_STATE_DIR:-/tmp/todos-training}"

API_PORT="${API_PORT:-18080}"
WEB_PORT="${WEB_PORT:-15173}"
API_BASE_URL="${API_BASE_URL:-http://localhost:${API_PORT}}"

DETACH=0
RUN_BUILD=0
SKIP_INSTALL=0
TAKE_OVER_PORTS=1
RESET_DATABASE=0

STARTED_SERVICES=()
STARTED_PIDS=()
RUN_PID_FILES=()

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info() { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail() { echo -e "${RED}[FAIL]${NC}  $*"; }

usage() {
    cat <<USAGE
todos-training local development launcher

Usage:
  ./scripts/dev.sh [--detach] [--build] [--skip-install] [--no-takeover] [--reset] [--help]

Options:
  --detach        Start API and Web in the background, then exit after checks.
  --build         Run API/Web/CLI build checks before starting services.
  --skip-install  Do not run pnpm install automatically.
  --no-takeover   Do not stop existing processes on ports ${API_PORT}/${WEB_PORT}.
  --reset         Start with a clean in-memory H2 database.
  --help          Show this help message.

Default behavior:
  - Check Java 21+, Node.js 20+, pnpm, curl, and lsof.
  - Stop existing listeners on ports ${API_PORT}/${WEB_PORT} before starting.
  - Install web/cli dependencies when node_modules is missing or manifests changed.
  - Start services/api with Gradle bootRun.
  - Start apps/web with Vite on http://localhost:${WEB_PORT}.
  - Store logs and PID files under ${STATE_DIR}.
  - In foreground mode, Ctrl+C stops only services started by this script.
USAGE
}

parse_args() {
    while [ "$#" -gt 0 ]; do
        case "$1" in
            --detach)
                DETACH=1
                ;;
            --build)
                RUN_BUILD=1
                ;;
            --skip-install)
                SKIP_INSTALL=1
                ;;
            --no-takeover)
                TAKE_OVER_PORTS=0
                ;;
            --reset)
                RESET_DATABASE=1
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                fail "Unknown argument: $1"
                echo ""
                usage
                exit 1
                ;;
        esac
        shift
    done
}

print_header() {
    echo ""
    echo -e "${BOLD}========================================${NC}"
    echo -e "${BOLD}  todos-training one-click dev${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

check_cmd() {
    local label="$1"
    local cmd="$2"
    local hint="$3"

    if command_exists "$cmd"; then
        local version
        version="$("$cmd" --version 2>/dev/null | head -1 | tr '\n' ' ' || true)"
        if [ -z "$version" ]; then
            version="available"
        fi
        success "$label - $version"
        return 0
    fi

    fail "$label is missing - $hint"
    return 1
}

check_node_version() {
    if ! command_exists node; then
        return 0
    fi

    local node_major
    node_major="$(node -e 'console.log(process.versions.node.split(".")[0])')"
    if [ "$node_major" -lt 20 ]; then
        fail "Node.js major version is ${node_major}; expected >= 20"
        return 1
    fi

    success "Node.js major version: ${node_major} (>=20)"
}

check_java_version() {
    if ! command_exists java; then
        return 0
    fi

    local java_line java_version java_major
    java_line="$(java -version 2>&1 | head -1)"
    java_version="$(printf '%s' "$java_line" | sed -nE 's/.*version "([^"]+)".*/\1/p')"

    case "$java_version" in
        1.[0-9]*)
            java_major="$(printf '%s' "$java_version" | sed -nE 's/^1\.([0-9]+).*$/\1/p')"
            ;;
        [0-9]*)
            java_major="$(printf '%s' "$java_version" | sed -nE 's/^([0-9]+).*$/\1/p')"
            ;;
        *)
            java_major=""
            ;;
    esac

    if [ -z "$java_major" ]; then
        fail "Cannot parse Java version: ${java_line:-unknown}; expected >= 21"
        return 1
    fi

    if [ "$java_major" -lt 21 ]; then
        fail "Java version is ${java_version:-unknown}; expected >= 21"
        return 1
    fi

    success "Java major version: ${java_major} (>=21)"
}

check_environment() {
    info "Phase 1: checking environment..."

    local failures=0
    check_cmd "Node.js" "node" "install Node.js 20+" || failures=$((failures + 1))
    check_cmd "pnpm" "pnpm" "install pnpm" || failures=$((failures + 1))
    check_cmd "Java" "java" "install JDK 21" || failures=$((failures + 1))
    check_cmd "curl" "curl" "install curl" || failures=$((failures + 1))
    check_cmd "lsof" "lsof" "install lsof" || failures=$((failures + 1))

    check_node_version || failures=$((failures + 1))
    check_java_version || failures=$((failures + 1))

    if [ "$failures" -gt 0 ]; then
        echo ""
        fail "Found ${failures} environment issue(s). Fix them and rerun."
        exit 1
    fi
}

ensure_state_dir() {
    mkdir -p "$STATE_DIR"
}

rotate_log() {
    local log_file="$1"
    if [ -f "$log_file" ]; then
        mv "$log_file" "${log_file}.prev"
    fi
}

port_open() {
    local host="$1"
    local port="$2"

    if command_exists nc; then
        nc -z "$host" "$port" >/dev/null 2>&1
        return $?
    fi

    (echo >"/dev/tcp/${host}/${port}") >/dev/null 2>&1
}

wait_for_port() {
    local host="$1"
    local port="$2"
    local label="$3"
    local max_seconds="${4:-60}"
    local elapsed=0

    while [ "$elapsed" -lt "$max_seconds" ]; do
        if port_open "$host" "$port"; then
            success "${label} is ready (${host}:${port})"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done

    fail "${label} did not become ready in ${max_seconds}s (${host}:${port})"
    return 1
}

wait_for_http() {
    local url="$1"
    local label="$2"
    local max_seconds="${3:-90}"
    local elapsed=0

    while [ "$elapsed" -lt "$max_seconds" ]; do
        if curl -fsS "$url" >/dev/null 2>&1; then
            success "${label} is ready (${url})"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done

    fail "${label} did not become ready in ${max_seconds}s (${url})"
    return 1
}

force_take_over_port() {
    local port="$1"
    local label="$2"
    local pid_file="$3"

    if [ "$TAKE_OVER_PORTS" -eq 0 ]; then
        warn "Skipping port takeover for ${label} (${port})"
        return 0
    fi

    local pids
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN -P -n 2>/dev/null || true)"
    if [ -n "$pids" ]; then
        warn "Stopping existing listener(s) on port ${port} for ${label}: ${pids}"
        kill $pids >/dev/null 2>&1 || true
        sleep 1
        pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN -P -n 2>/dev/null || true)"
        if [ -n "$pids" ]; then
            warn "Force stopping listener(s) on port ${port}: ${pids}"
            kill -9 $pids >/dev/null 2>&1 || true
        fi
    fi

    if [ -f "$pid_file" ]; then
        rm -f "$pid_file"
    fi
}

reset_database() {
    if [ "$RESET_DATABASE" -eq 0 ]; then
        return 0
    fi

    info "API uses in-memory H2; a fresh API process starts with a clean database."
}

install_if_needed() {
    local app_dir="$1"
    local label="$2"

    if [ "$SKIP_INSTALL" -eq 1 ]; then
        warn "Skipping dependency install for ${label}"
        return 0
    fi

    local stamp="${app_dir}/node_modules/.todos-training-install.stamp"
    local needs_install=0

    if [ ! -d "${app_dir}/node_modules" ]; then
        needs_install=1
    elif [ ! -f "$stamp" ]; then
        needs_install=1
    elif [ "${app_dir}/package.json" -nt "$stamp" ]; then
        needs_install=1
    elif [ -f "${app_dir}/pnpm-lock.yaml" ] && [ "${app_dir}/pnpm-lock.yaml" -nt "$stamp" ]; then
        needs_install=1
    fi

    if [ "$needs_install" -eq 0 ]; then
        success "${label} dependencies are up to date"
        return 0
    fi

    info "Installing ${label} dependencies..."
    (
        cd "$app_dir"
        if [ -f pnpm-lock.yaml ]; then
            pnpm install --frozen-lockfile
        else
            pnpm install
        fi
        mkdir -p node_modules
        touch "$stamp"
    )
}

prepare_dependencies() {
    echo ""
    info "Phase 2: preparing dependencies..."
    install_if_needed "$ROOT/apps/web" "web"
    install_if_needed "$ROOT/apps/cli" "cli"
}

run_build_checks() {
    if [ "$RUN_BUILD" -eq 0 ]; then
        return 0
    fi

    echo ""
    info "Phase 3: running build checks..."
    (cd "$ROOT/services/api" && ./gradlew test)
    (cd "$ROOT/apps/web" && pnpm build)
    (cd "$ROOT/apps/cli" && pnpm build)
}

start_service() {
    local name="$1"
    local dir="$2"
    local log_file="$3"
    local pid_file="$4"
    shift 4

    rotate_log "$log_file"

    info "Starting ${name}..."
    (
        cd "$dir"
        exec "$@"
    ) >"$log_file" 2>&1 &

    local pid=$!
    printf '%s\n' "$pid" >"$pid_file"
    STARTED_SERVICES+=("$name")
    STARTED_PIDS+=("$pid")
    RUN_PID_FILES+=("$pid_file")
    success "${name} started (pid ${pid}, log ${log_file})"
}

start_services() {
    echo ""
    info "Phase 4: starting services..."

    local api_pid_file="${STATE_DIR}/api.pid"
    local web_pid_file="${STATE_DIR}/web.pid"

    force_take_over_port "$API_PORT" "api" "$api_pid_file"
    force_take_over_port "$WEB_PORT" "web" "$web_pid_file"
    reset_database

    start_service \
        "api" \
        "$ROOT/services/api" \
        "${STATE_DIR}/api.log" \
        "$api_pid_file" \
        env SERVER_PORT="$API_PORT" CORS_ALLOWED_ORIGIN="http://localhost:${WEB_PORT}" ./gradlew bootRun

    wait_for_http "${API_BASE_URL}/api/todos" "api" 120

    start_service \
        "web" \
        "$ROOT/apps/web" \
        "${STATE_DIR}/web.log" \
        "$web_pid_file" \
        env VITE_API_BASE_URL="$API_BASE_URL" WEB_PORT="$WEB_PORT" pnpm dev

    wait_for_http "http://localhost:${WEB_PORT}" "web" 60
}

print_success_summary() {
    echo ""
    success "todos-training local development is ready"
    echo ""
    echo "Services:"
    echo "  API: ${API_BASE_URL}"
    echo "  Web: http://localhost:${WEB_PORT}"
    echo ""
    echo "Logs:"
    echo "  API: ${STATE_DIR}/api.log"
    echo "  Web: ${STATE_DIR}/web.log"
    echo ""
    echo "PID files:"
    for pid_file in "${RUN_PID_FILES[@]}"; do
        echo "  ${pid_file}"
    done
}

cleanup_started_services() {
    local count="${#STARTED_PIDS[@]}"
    if [ "$count" -eq 0 ]; then
        return 0
    fi

    echo ""
    info "Stopping services started by this run..."

    local i
    for ((i = count - 1; i >= 0; i--)); do
        local pid="${STARTED_PIDS[$i]}"
        local name="${STARTED_SERVICES[$i]}"
        if kill -0 "$pid" >/dev/null 2>&1; then
            info "Stopping ${name} (pid ${pid})"
            kill "$pid" >/dev/null 2>&1 || true
        fi
    done

    sleep 1

    for ((i = count - 1; i >= 0; i--)); do
        local pid="${STARTED_PIDS[$i]}"
        if kill -0 "$pid" >/dev/null 2>&1; then
            kill -9 "$pid" >/dev/null 2>&1 || true
        fi
    done

    for pid_file in "${RUN_PID_FILES[@]}"; do
        rm -f "$pid_file"
    done
}

on_interrupt() {
    cleanup_started_services
    exit 130
}

on_error() {
    fail "Startup failed. Check logs under ${STATE_DIR}."
    cleanup_started_services
}

supervise_foreground() {
    echo ""
    info "Foreground supervision is active. Press Ctrl+C to stop started services."

    while true; do
        local i
        for ((i = 0; i < ${#STARTED_PIDS[@]}; i++)); do
            local pid="${STARTED_PIDS[$i]}"
            local name="${STARTED_SERVICES[$i]}"
            if ! kill -0 "$pid" >/dev/null 2>&1; then
                fail "${name} exited. See ${STATE_DIR}/${name}.log"
                cleanup_started_services
                exit 1
            fi
        done
        sleep 2
    done
}

main() {
    parse_args "$@"
    print_header
    trap on_interrupt INT TERM
    trap on_error ERR

    ensure_state_dir
    check_environment
    prepare_dependencies
    run_build_checks
    start_services
    print_success_summary

    if [ "$DETACH" -eq 1 ]; then
        trap - INT TERM ERR
        exit 0
    fi

    supervise_foreground
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
