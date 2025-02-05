# Path Problem Description

## Current Issue
We're trying to create a simple test script to connect to PS2, but running into persistent path resolution issues:

1. The test file exists in two locations:
   - server/test-ps2-connection.js
   - server/src/tests/test-ps2-connection.js

2. When trying to run from root (ps2) directory:
```bash
node ./src/tests/test-ps2-connection.js
# Error: Cannot find module 'C:\Users\zuri\Projects\ps2\src\tests\test-ps2-connection.js'
```

3. When trying to run from server directory:
```bash
node ./test-ps2-connection.js
# Error: Cannot find module 'C:\Users\zuri\Projects\ps2\test-ps2-connection.js'
```

## Problem Analysis
1. Node.js is not resolving the file paths correctly
2. The working directory seems to be incorrect when running the commands
3. Multiple copies of the test file in different locations is causing confusion
4. The error messages show Node.js is looking in the root ps2 directory even when we're in the server directory

## Next Steps Needed
1. Determine the correct working directory structure
2. Establish where test files should live
3. Fix the path resolution issues
4. Create a consistent way to run test files

The next model should focus on establishing a proper directory structure and fixing the path resolution before proceeding with the actual PS2 connection test.

## Important Note
The error messages suggest that even when we cd into the server directory, Node.js is still trying to resolve paths from the root ps2 directory. This might indicate an issue with how the working directory is being handled or how Node.js is being invoked.