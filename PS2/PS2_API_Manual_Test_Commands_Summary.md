## PS2 API Test Commands Summary

The `ps2.commands.json` file contains a collection of test commands that can be used to verify the functionality of the PS2 API. These commands are designed to simulate various user actions and system events, and to check that the API responds correctly.

Here's a summary of the different types of test commands available:

*   **`portfolios.add`**: Tests the creation of new portfolios. These tests check for required parameters, unique portfolio names, and correct data types.
*   **`portfolios.remove`**: Tests the removal of existing portfolios. These tests check for successful removal and error handling when attempting to remove non-existent portfolios.
*   **`portfolios.putCash`**: Tests the addition of cash to a portfolio. These tests check for correct cash balances and proper handling of different currencies.
*   **`portfolios.history`**: Tests the retrieval of portfolio history. These tests check for correct data formatting and accurate calculation of portfolio values over time.
*   **`trades.add`**: Tests the addition of trades to a portfolio. These tests check for correct trade execution and proper handling of different trade types and currencies.
*   **`trades.remove`**: Tests the removal of trades from a portfolio. These tests check for successful removal and proper handling of trade-related data.
*   **`portfolios.positions`**: Tests the retrieval of portfolio positions. These tests check for correct position calculations and proper handling of different asset types and market conditions.
*   **`tests.check`**: This command is used to assert that certain conditions are met. It can be used to check the values of variables, the contents of arrays, and the presence of errors.
*   **`tests.setVar`**: This command is used to set the value of a variable. Variables can be used to store data that is used in subsequent test commands.
*   **`tests.waitMsg`**: This command is used to wait for a message to be received from the PS2 API. This is useful for testing asynchronous operations.
*   **`prices.historical`**: This command is used to retrieve historical price data for a given symbol. This is useful for testing the accuracy of portfolio performance calculations.

By combining these test commands in different ways, you can create a wide variety of tests to verify the functionality and stability of your PS2 integrations.

For example, you could create a test that:

1.  Creates a new portfolio.
2.  Adds cash to the portfolio.
3.  Adds several trades to the portfolio.
4.  Retrieves the portfolio history.
5.  Checks that the portfolio history contains the correct data.

This would be a simple integration test that verifies that the basic trading functionality of the PS2 API is working correctly.

You can find more complex examples of test commands in the `ps2.commands.json` file. These examples can be used as a starting point for creating your own tests.