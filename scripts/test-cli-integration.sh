#!/bin/bash
set -e

TEST_PROJECT_DIR="wokwi-part-tests"
TEST_REPO="https://github.com/wokwi/wokwi-part-tests.git"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to root directory
cd "$ROOT_DIR"

# Clone test project if it doesn't exist
if [ ! -d "$TEST_PROJECT_DIR" ]; then
  echo "Cloning test project..."
  git clone "$TEST_REPO" "$TEST_PROJECT_DIR"
else
  echo "Test project already exists, skipping clone..."
fi

# Check if WOKWI_CLI_TOKEN is set
if [ -z "$WOKWI_CLI_TOKEN" ]; then
  echo "ERROR: WOKWI_CLI_TOKEN environment variable is not set."
  echo "Integration tests require a Wokwi API token to run."
  echo "Set WOKWI_CLI_TOKEN environment variable to run these tests."
  exit 1
fi

# Find the CLI executable
if [ -f "packages/wokwi-cli/dist/cli.cjs" ]; then
  WOKWI_CLI="node packages/wokwi-cli/dist/cli.cjs"
elif [ -f "packages/wokwi-cli/dist/bin/wokwi-cli" ]; then
  WOKWI_CLI="packages/wokwi-cli/dist/bin/wokwi-cli"
else
  WOKWI_CLI="pnpm run cli"
fi

# Setup PlatformIO
setup_platformio() {
  if command -v pio &> /dev/null; then
    return 0
  fi

  echo "Installing PlatformIO..."
  if [ ! -d ".venv" ]; then
    python3 -m venv .venv
  fi
  source .venv/bin/activate
  python3 -m pip install --upgrade pip --quiet
  pip install platformio --quiet
}

# Run PlatformIO command with venv if needed
run_pio() {
  local venv_path="$ROOT_DIR/.venv"
  if [ -d "$venv_path" ] && ! command -v pio &> /dev/null 2>&1; then
    source "$venv_path/bin/activate" && pio "$@"
  else
    pio "$@"
  fi
}

# Setup PlatformIO
setup_platformio

# Discover all test.yaml files
echo "Discovering test files..."
TESTS=()
while IFS= read -r -d '' test_file; do
  rel_path="${test_file#$TEST_PROJECT_DIR/}"
  test_path=$(dirname "$rel_path")
  scenario_file=$(basename "$test_file")
  test_name=$(basename "$test_path")
  TESTS+=("$test_name|$test_path|$scenario_file")
done < <(find "$TEST_PROJECT_DIR" -name "*test.yaml" -type f -print0 | sort -z)

if [ ${#TESTS[@]} -eq 0 ]; then
  echo "ERROR: No test.yaml files found in $TEST_PROJECT_DIR"
  exit 1
fi

echo "Found ${#TESTS[@]} test(s) to run"
echo ""

# Run tests
FAILED_TESTS=()
PASSED_TESTS=()

echo "Running CLI integration tests..."
echo "=================================="

for test_entry in "${TESTS[@]}"; do
  IFS='|' read -r test_name test_path scenario_file <<< "$test_entry"
  test_dir="$TEST_PROJECT_DIR/$test_path"
  
  echo ""
  echo "Testing: $test_name"
  echo "Path: $test_dir"
  echo "Scenario: $scenario_file"
  echo "---"
  
  # Check if test directory exists
  if [ ! -d "$test_dir" ]; then
    echo "ERROR: Test directory not found: $test_dir"
    FAILED_TESTS+=("$test_name (directory not found)")
    continue
  fi
  
  # Build with PlatformIO
  echo "Building with PlatformIO..."
  if ! (cd "$test_dir" && run_pio run); then
    echo "ERROR: PlatformIO build failed for $test_name"
    FAILED_TESTS+=("$test_name (build failed)")
    continue
  fi
  
  # Run wokwi-cli test
  echo "Running Wokwi CLI test..."
  serial_log="serial-${test_name}.log"
  
  if $WOKWI_CLI "$test_dir" --scenario "$scenario_file" --timeout 10000 --serial-log-file "$serial_log"; then
    echo "✓ PASSED: $test_name"
    PASSED_TESTS+=("$test_name")
  else
    echo "✗ FAILED: $test_name"
    FAILED_TESTS+=("$test_name")
    if [ -f "$serial_log" ]; then
      echo "Serial log for $test_name:"
      tail -n 50 "$serial_log"
    fi
  fi
done

# Print summary
echo ""
echo "=================================="
echo "Test Summary:"
echo "  Passed: ${#PASSED_TESTS[@]}"
echo "  Failed: ${#FAILED_TESTS[@]}"
echo ""

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
  echo "Failed tests:"
  for failed_test in "${FAILED_TESTS[@]}"; do
    echo "  - $failed_test"
  done
  exit 1
fi

echo "All CLI integration tests passed!"
