#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE="$ROOT_DIR/.env"
COMPOSE_FILE="$ROOT_DIR/docker-compose.local.yml"

cd "$ROOT_DIR"

say() {
  printf '\n%s\n' "$1"
}

warn() {
  printf 'Warning: %s\n' "$1" >&2
}

die() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

pause() {
  read -r -p "${1:-Press Enter to continue} " _reply
}

confirm() {
  local reply
  read -r -p "$1 [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

env_value() {
  [[ -f "$ENV_FILE" ]] || return 1
  local line
  line=$(grep -E "^${1}=" "$ENV_FILE" | tail -n 1) || return 1
  printf '%s' "${line#*=}"
}

write_env() {
  local key="$1" value="$2" temp
  temp=$(mktemp)
  if [[ -f "$ENV_FILE" ]]; then
    grep -vE "^${key}=" "$ENV_FILE" > "$temp" || true
  fi
  printf '%s=%s\n' "$key" "$value" >> "$temp"
  mv "$temp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

ask_value() {
  local key="$1" prompt="$2" secret="${3:-false}" current input
  current=$(env_value "$key" || true)
  if [[ -n "$current" ]]; then
    printf '%s [Enter keeps current] ' "$prompt"
  else
    printf '%s ' "$prompt"
  fi
  if [[ "$secret" == "true" ]]; then
    read -r -s input
    printf '\n'
  else
    read -r input
  fi
  [[ -z "$input" ]] && input="$current"
  [[ -n "$input" ]] || die "$key cannot be empty"
  write_env "$key" "$input"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required. See README.md#prerequisites."
}

check_prerequisites() {
  require_command node
  require_command pnpm
  require_command docker
  require_command openssl

  local node_major
  node_major=$(node -p 'Number(process.versions.node.split(".")[0])')
  (( node_major >= 24 )) || die "Node 24 or newer is required; found Node $node_major."
  docker info >/dev/null 2>&1 || die "Docker is installed but its daemon is not running."
  docker compose version >/dev/null 2>&1 || die "Docker Compose is required."
}

configure_env() {
  say "Environment"
  if [[ -f "$ENV_FILE" ]]; then
    printf '.env already exists. Press Enter at each prompt to keep its value.\n'
  else
    cp .env.example "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    printf 'Created .env from .env.example.\n'
  fi

  local database_url auth_secret base_url
  database_url=$(env_value DATABASE_URL || true)
  [[ -n "$database_url" ]] || write_env DATABASE_URL "postgres://genie:genie@localhost:5432/genie"
  ask_value DATABASE_URL "Local database URL:" true

  database_url=$(env_value DATABASE_URL)
  if [[ "$database_url" != *"@localhost:"* && "$database_url" != *"@127.0.0.1:"* ]]; then
    die "This wizard manages the local Docker database, but DATABASE_URL is not local."
  fi

  auth_secret=$(env_value BETTER_AUTH_SECRET || true)
  if (( ${#auth_secret} < 32 )); then
    auth_secret=$(openssl rand -base64 48 | tr -d '\n')
    write_env BETTER_AUTH_SECRET "$auth_secret"
    printf 'Generated BETTER_AUTH_SECRET.\n'
  else
    ask_value BETTER_AUTH_SECRET "Better Auth secret:" true
    auth_secret=$(env_value BETTER_AUTH_SECRET)
    (( ${#auth_secret} >= 32 )) || die "BETTER_AUTH_SECRET must be at least 32 characters."
  fi

  base_url=$(env_value PUBLIC_BASE_URL || true)
  [[ -n "$base_url" ]] || write_env PUBLIC_BASE_URL "http://localhost:3000"
  ask_value PUBLIC_BASE_URL "Browser-visible local URL:"

  if [[ -n "$(env_value RESEND_API_KEY || true)" ]]; then
    ask_value RESEND_API_KEY "Resend API key:" true
    ask_value RESEND_FROM_EMAIL "Verified Resend sender:"
  elif confirm "Configure real Resend email delivery now?"; then
    ask_value RESEND_API_KEY "Resend API key:" true
    ask_value RESEND_FROM_EMAIL "Verified Resend sender:"
  fi

  if [[ -n "$(env_value GENIE_CHAT_API_ALLOWED_ORIGINS || true)" ]]; then
    ask_value GENIE_CHAT_API_ALLOWED_ORIGINS "Allowed chat API origins:"
  elif confirm "Configure chat API origins now?"; then
    ask_value GENIE_CHAT_API_ALLOWED_ORIGINS "Comma-separated HTTPS origins:"
  fi
}

install_dependencies() {
  say "Dependencies"
  if [[ -d node_modules ]]; then
    printf 'node_modules already exists. pnpm will verify it against the lockfile.\n'
    pause
  fi
  pnpm install --frozen-lockfile
}

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

start_database() {
  say "Local PostgreSQL"
  if compose ps --status running --services | grep -qx db; then
    printf 'The database container is already running.\n'
  elif compose ps -a --services | grep -qx db; then
    printf 'The database container exists and will be restarted.\n'
    compose up -d --wait db
  else
    printf 'Creating the database container and persistent volume.\n'
    compose up -d --wait db
  fi
}

db_query() {
  local db_user db_name
  db_user=$(env_value POSTGRES_USER || true)
  db_name=$(env_value POSTGRES_DB || true)
  compose exec -T db psql -v ON_ERROR_STOP=1 -U "${db_user:-genie}" -d "${db_name:-genie}" -Atqc "$1"
}

local_migration_count() {
  find drizzle -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' '
}

applied_migration_count() {
  db_query 'SELECT COUNT(*) FROM drizzle.__drizzle_migrations;' 2>/dev/null || printf '0'
}

migrate_database() {
  say "Database migrations"
  local local_count applied_count
  local_count=$(local_migration_count)
  applied_count=$(applied_migration_count)

  if (( applied_count > local_count )); then
    die "The database has $applied_count migrations but this checkout has $local_count. Pull the newer code before continuing."
  elif (( applied_count == local_count )); then
    printf 'Migration history is current (%s/%s). Verifying idempotently.\n' "$applied_count" "$local_count"
  else
    printf '%s migration(s) need to be applied (%s/%s present).\n' "$((local_count - applied_count))" "$applied_count" "$local_count"
  fi

  pnpm db:migrate
  applied_count=$(applied_migration_count)
  [[ "$applied_count" == "$local_count" ]] || die "Migration count is still $applied_count/$local_count."
}

password_is_strong() {
  local password="$1" score=0
  (( ${#password} >= 8 )) && score=$((score + 1))
  [[ "$password" =~ [a-z] && "$password" =~ [A-Z] ]] && score=$((score + 1))
  [[ "$password" =~ [0-9] ]] && score=$((score + 1))
  [[ "$password" =~ [^a-zA-Z0-9] ]] && score=$((score + 1))
  (( score >= 3 ))
}

seed_admin_if_needed() {
  say "Database users"
  local user_count admin_count email password password_again
  user_count=$(db_query 'SELECT COUNT(*) FROM "user";')
  admin_count=$(db_query 'SELECT COUNT(*) FROM "user" WHERE role LIKE '\''%admin%'\'';')
  printf 'Found %s user(s), including %s administrator(s).\n' "$user_count" "$admin_count"

  if (( user_count > 0 && admin_count > 0 )); then
    printf 'Admin bootstrap is already complete.\n'
    return
  fi
  if (( user_count > 0 )); then
    die "Users exist but none is an administrator. Resolve that state manually or choose reset for disposable local data."
  fi

  printf 'The database is empty. Create the first administrator.\n'
  read -r -p "Administrator email: " email
  [[ "$email" == *@*.* ]] || die "Enter a valid administrator email."
  read -r -s -p "Temporary password: " password
  printf '\n'
  read -r -s -p "Repeat temporary password: " password_again
  printf '\n'
  [[ "$password" == "$password_again" ]] || die "Passwords do not match."
  password_is_strong "$password" || die "Use at least 8 characters and 3 of: length, mixed case, digit, symbol."

  if ! ADMIN_EMAIL="$email" ADMIN_PASSWORD="$password" compose --profile bootstrap up --build --wait bootstrap; then
    compose stop bootstrap >/dev/null 2>&1 || true
    compose rm -f bootstrap >/dev/null 2>&1 || true
    die "Admin bootstrap failed. Review the container output above."
  fi
  compose stop bootstrap >/dev/null
  compose rm -f bootstrap >/dev/null

  user_count=$(db_query 'SELECT COUNT(*) FROM "user";')
  admin_count=$(db_query 'SELECT COUNT(*) FROM "user" WHERE role LIKE '\''%admin%'\'';')
  (( user_count == 1 && admin_count == 1 )) || die "Expected one seeded administrator; found $user_count user(s) and $admin_count admin(s)."
  printf 'Created the first administrator. Sign in and change the temporary password.\n'
}

setup_flow() {
  check_prerequisites
  install_dependencies
  configure_env
  start_database
  migrate_database
  seed_admin_if_needed
  say "Ready"
  printf 'Run: pnpm dev\nOpen: http://localhost:3000\n'
}

migration_flow() {
  check_prerequisites
  install_dependencies
  configure_env
  start_database
  migrate_database
  seed_admin_if_needed
  say "Database is current"
}

reset_flow() {
  check_prerequisites
  warn "This deletes the local PostgreSQL volume, including every user, solution, group, and chat."
  local reply
  read -r -p "Type RESET to delete it and rebuild from scratch: " reply
  [[ "$reply" == "RESET" ]] || { printf 'Reset cancelled.\n'; return; }
  compose --profile bootstrap down -v --remove-orphans
  setup_flow
}

main() {
  [[ -t 0 ]] || die "Run this wizard in an interactive terminal."
  printf '\nGenie Ops Center local setup\n\n'
  printf '  1. Set up a new clone\n'
  printf '  2. Apply migrations and inspect database state\n'
  printf '  3. Reset local data and set up from scratch\n'
  printf '  q. Quit\n\n'
  read -r -p "Choose an option: " choice

  case "$choice" in
    1) setup_flow ;;
    2) migration_flow ;;
    3) reset_flow ;;
    q|Q) exit 0 ;;
    *) die "Choose 1, 2, 3, or q." ;;
  esac
}

main "$@"
