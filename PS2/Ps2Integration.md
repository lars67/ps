# PS2 Integration Guide

This guide explains how to integrate with the PS2 system for portfolio management.

## Overview

The integration allows you to:
1. Authenticate with PS2
2. Create users after successful questionnaire completion
3. Create portfolios for new users
4. Execute trades

## Key Components

- `auth.js`: Handles PS2 authentication
- `user.js`: Manages user creation
- `portfolio.js`: Handles portfolio creation and trade execution
- `PushPortfolio.js`: Orchestrates the entire process
- `questionnaire.js`: Handles the questionnaire process (new component)

## How to Use

1. **Setup**: Ensure all required files are in the `src/ps2/` directory.

2. **Authentication**:
   ```javascript
   const PS2Auth = require('./auth');
   const auth = new PS2Auth();
   await auth.connect();
   await auth.login('admin', 'password');
   ```

3. **Questionnaire Completion**:
   ```javascript
   const Questionnaire = require('./questionnaire');
   const questionnaire = new Questionnaire();
   const questionnaireResult = await questionnaire.complete(userResponses);
   if (questionnaireResult.success) {
     // Proceed to user creation
   } else {
     // Handle unsuccessful questionnaire completion
   }
   ```

4. **Create User**:
   ```javascript
   const PS2User = require('./user');
   const AktiaDB = require('./aktiaDB'); // New import for AktiaDB
   const user = new PS2User(auth);
   const aktiaDBUser = await AktiaDB.getUser(userEmail); // Fetch user from AktiaDB
   const userId = await user.createUser({
     username: aktiaDBUser.username,
     password: aktiaDBUser.password,
     email: aktiaDBUser.email,
     // ... other user details
   });
   ```

5. **Create Portfolio**:
   ```javascript
   const PS2Portfolio = require('./portfolio');
   const portfolio = new PS2Portfolio(auth);
   const portfolioId = await portfolio.createPortfolio(userId, {
     name: 'My Portfolio',
     description: 'A new portfolio',
     currency: 'DKK',
     baseInstrument: 'OMXC25'
   });
   ```

6. **Execute Trade**:
   ```javascript
   await portfolio.addTrade(portfolioId, {
     symbol: 'AAPL',
     quantity: 100,
     price: 150,
     currency: 'DKK',
     type: 'buy'
   });
   ```

## Testing

Use the `test_push_portfolio_to_ps2.js` script in the `src/Tests/` directory:

```
node src/Tests/test_push_portfolio_to_ps2.js <userEmail>
```

This script demonstrates the full integration flow, including questionnaire completion, user creation, and portfolio creation.

## Notes

- All operations require prior authentication.
- The `insertMoney` functionality is currently not available in PS2.
- Ensure proper error handling in your implementation.
- User creation in PS2 now depends on successful questionnaire completion and uses credentials from AktiaDB.

For detailed API documentation or support, contact the development team.
