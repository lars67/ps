#!/bin/bash

# Daily Portfolio Positions Collection Script
# This script runs the daily portfolio positions collector

# Set the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Change to the server directory
cd "$SCRIPT_DIR/.."

# Load environment variables
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Set Node environment
export NODE_ENV=${NODE_ENV:-production}

# Log file
LOG_FILE="$PROJECT_ROOT/logs/daily-portfolio-positions-$(date +%Y-%m-%d).log"

echo "$(date): Starting daily portfolio positions collection" >> "$LOG_FILE"

# Run the TypeScript script using ts-node
npx ts-node "$SCRIPT_DIR/daily-portfolio-positions.ts" >> "$LOG_FILE" 2>&1

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "$(date): Daily portfolio positions collection completed successfully" >> "$LOG_FILE"
else
    echo "$(date): Daily portfolio positions collection failed with exit code $EXIT_CODE" >> "$LOG_FILE"
fi

echo "$(date): Script execution finished" >> "$LOG_FILE"

exit $EXIT_CODE