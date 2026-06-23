import "./cm-viewer.css";
import "./style.css";
import React from "react";
import styled from "styled-components";
import {CloseOutlined} from "@ant-design/icons";

const CloseOutlinedStyled  = styled(CloseOutlined)`
  cursor: pointer;
  color: #f89a92;
  font-size: 24px;

  &:hover {
    color: red;
  }

  position: fixed;
  top: 16px;
  right: 36px;
  z-index: 100000;
`;

const HTMLViewer = ({closeDrawer}:{closeDrawer:()=> void}) => {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PS2 API Manual</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
        }
        h1, h2, h3 {
            color: #2c3e50;
        }
        h3 {
            margin-top: 20px;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 20px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #343a40;
            color: white;
            font-weight: bold;
        }
        tbody tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        pre {
            background-color: #282c34;
            color: #abb2bf;
            border: 1px solid #5c6370;
            border-radius: 5px;
            padding: 12px;
            overflow-x: auto;
            font-family: "Droid Sans Mono", monospace;
            font-size: 0.9em;
        }
        a {
            color: #007bff;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
            color: #0056b3;
        }
        ul, ol {
            margin-bottom: 15px;
        }
        li {
            margin-bottom: 8px;
        }
        dl {
            margin-bottom: 20px;
        }
        dt {
            font-weight: bold;
            margin-bottom: 5px;
        }
        dd {
            margin-left: 20px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <h1 style="color:#2c3e50">PS2 API Manual</h1>

    <div class="toc">
        <h2>Table of Contents</h2>
        <ul>
            <li><a href="#introduction">Introduction</a></li>
            <li><a href="#authentication">Authentication</a></li>
            <li><a href="#collections">Collections</a></li>
            <li><a href="#console">Console</a></li>
            <li><a href="#operations">Operations</a></li>
            <li><a href="#portfolios">Portfolios</a></li>
            <li><a href="#prices">Prices</a></li>
            <li><a href="#tests">Tests</a></li>
            <li><a href="#tools">Tools</a></li>
            <li><a href="#trades">Trades</a></li>
        </ul>
    </div>

    <h2 id="introduction">Introduction</h2>
    <p>This document provides a comprehensive guide to the PS2 API, its components, and operations.</p>

    <h2 id="authentication">Authentication</h2>

    <h3>Login</h3>
    <p>Authenticates a user and returns a token for subsequent API calls. This token is required for accessing protected resources and performing operations within the system.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{"cmd":"login","login":"username","password":"userpassword"}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>login</code></td>
                <td>The username of the user attempting to log in. This is a string value.</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td><code>password</code></td>
                <td>The password of the user attempting to log in. This is a string value and should be treated confidentially.</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Successful Response:</strong></p>
    <p>A successful login returns a JSON object containing the user's token, role, and user ID. The token is a JWT (JSON Web Token) that should be included in the <code>Authorization</code> header of subsequent API requests.</p>
    <pre><code>{
  "token": "eyJhbGciOiJIU...",
  "role": "member",
  "userId": "66450cb15e1f94688db59355"
}</code></pre>
    <p><strong>Error Response:</strong></p>
    <p>An unsuccessful login attempt returns a JSON object with an <code>error</code> key and a message indicating the reason for the failure. In this case, "Invalid credentials" indicates that either the username or password was incorrect.</p>
    <pre><code>{"error": "Invalid credentials"}</code></pre>

    <h4>Error Handling and Troubleshooting</h4>
    <p>When interacting with the Authentication API, you may encounter various errors. Here are some common errors and how to troubleshoot them:</p>
    <ul>
        <li><strong>Invalid credentials:</strong> This error indicates that the username or password provided is incorrect. Double-check your credentials and try again. If you have forgotten your password, use the password reset functionality.</li>
        <li><strong>Username already exists:</strong> This error indicates that the username you are trying to register is already taken. Choose a different username and try again.</li>
        <li><strong>Missing parameters:</strong> This error indicates that you are missing one or more required parameters in your request. Ensure that you have included all required parameters and that they are correctly formatted.</li>
        <li><strong>Invalid parameter values:</strong> This error indicates that one or more of the parameters you have provided has an invalid value. Ensure that your parameter values are valid and conform to the expected format.</li>
        <li><strong>Internal server error:</strong> This error indicates that there is a problem with the PS2 server. If you encounter this error, try again later. If the error persists, contact the PS2 support team.</li>
    </ul>

    <h2 id="collections">Collections</h2>
    <p>Collections represent groups of related data within the PS2 system. These collections can represent various entities such as portfolios, trades, user data, and more. Common operations on collections include listing, adding, updating, and removing items.</p>

    <h3>General Syntax</h3>
    <p>All collection operations follow a consistent syntax: <code>collection_name.method</code>. This syntax specifies the target collection and the action to be performed.</p>
    <p><strong>Example:</strong></p>
    <p>The following command retrieves a list of portfolios, using an empty filter to return all portfolios:</p>
    <pre><code>{"command": "portfolios.list", "filter": {}}</code></pre>

    <h3>List</h3>
    <p>Retrieves a list of items from the specified collection. This method allows you to retrieve multiple items from a collection, optionally filtering the results based on specific criteria.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{"command": "collection_name.list", "filter": {}}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>filter</code></td>
                <td>An object containing fields and values to filter the results. The filter object uses a MongoDB-like syntax to specify the filtering criteria. If no filter is provided, all items in the collection will be returned.</td>
                <td>No</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong></p>
    <p>Returns an array of JSON objects, where each object represents an item in the collection that matches the specified filter criteria. If no items match the filter, an empty array is returned.</p>

    <h3>Add</h3>
    <p>Adds a new item to the specified collection. This method allows you to create new items within a collection, such as creating a new portfolio or adding a new trade.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{"command": "collection_name.add", "field1": "value1", "field2": "value2"}</code></pre>
    <p><strong>Parameters:</strong></p>
    <p>The parameters for this method depend on the specific collection to which you are adding an item. Each collection has its own set of required and optional fields. Refer to the documentation for the specific collection to determine the required parameters.</p>
    <p><strong>Output:</strong></p>
    <p>Returns a JSON object representing the newly created item, including its unique identifier (<code>_id</code>) assigned by the database.</p>

    <h3>Update</h3>
    <p>Updates an existing item in the collection. This method allows you to modify the fields of an existing item within a collection, such as updating the description of a portfolio or modifying the quantity of a trade.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{"command": "collection_name.update", "_id": "record_id", "field1": "new_value"}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>_id</code></td>
                <td>The unique identifier (MongoDB key) of the item to update. This is a string value.</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td><code>field1, field2...</code></td>
                <td>One or more fields to update with their new values. The specific fields that can be updated depend on the collection.</td>
                <td>At least one</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong></p>
    <p>Returns a JSON object representing the updated item, with the modified fields reflecting the new values.</p>

    <h3>Remove</h3>
    <p>Removes an item from the collection. This method allows you to delete an item from a collection, such as removing a portfolio or deleting a trade. This operation is irreversible, so use it with caution.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{"command": "collection_name.remove", "_id": "record_id"}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>_id</code></td>
                <td>The unique identifier (MongoDB key) of the item to remove. This is a string value.</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong></p>
    <p>Returns a success message or the removed object. The exact output may vary depending on the implementation.</p>

    <h2 id="console">Console</h2>
    <p>The PS2Dox console provides a command-line interface for interacting with the system. It serves as a central point for executing commands, monitoring system status, and troubleshooting issues.</p>

    <h3>Features:</h3>
    <ul>
        <li><strong>Command execution:</strong> Allows users to execute various commands to interact with the PS2 system.</li>
        <li><strong>Output display:</strong> Displays the output of executed commands, providing real-time feedback on the status of operations.</li>
        <li><strong>Error reporting:</strong> Provides detailed error messages to help users identify and resolve issues.</li>
        <li><strong>System status monitoring:</strong> Allows users to monitor the status of various system components and operations.</li>
    </ul>

    <h2 id="operations">Operations</h2>
    <p>Operations in PS2Dox encompass various actions and processes within the system. These operations are categorized to provide a clear understanding of the system's functionalities.</p>

    <h3>Categories of operations:</h3>
    <ol>
        <li><strong>User Management:</strong>
            <ul>
                <li><strong>User registration:</strong> Creates a new user account in the system.</li>
                <li><strong>Authentication:</strong> Verifies the identity of a user and grants access to protected resources.</li>
                <li><strong>Profile management:</strong> Allows users to manage their personal information and settings.</li>
            </ul>
        </li>
        <li><strong>Portfolio Management:</strong>
            <ul>
                <li><strong>Portfolio creation:</strong> Creates a new portfolio to track financial instruments or assets.</li>
                <li><strong>Portfolio updates:</strong> Modifies an existing portfolio, such as adding or removing assets.</li>
                <li><strong>Portfolio deletion:</strong> Deletes a portfolio from the system.</li>
            </ul>
        </li>
        <li><strong>Trading:</strong>
            <ul>
                <li><strong>Order placement:</strong> Places a new order to buy or sell a financial instrument.</li>
                <li><strong>Order modification:</strong> Modifies an existing order, such as changing the quantity or price.</li>
                <li><strong>Order cancellation:</strong> Cancels an existing order.</li>
            </ul>
        </li>
        <li><strong>Data Retrieval:</strong>
            <ul>
                <li><strong>Market data fetching:</strong> Retrieves real-time or historical market data for financial instruments.</li>
                <li><strong>Performance metrics calculation:</strong> Calculates performance metrics for portfolios and trades.</li>
                <li><strong>Report generation:</strong> Generates reports based on portfolio data and performance metrics.</li>
            </ul>
        </li>
        <li><strong>System Administration:</strong>
            <ul>
                <li><strong>User account management:</strong> Manages user accounts, such as creating, deleting, or modifying user accounts.</li>
                <li><strong>System configuration:</strong> Configures system settings and parameters.</li>
                <li><strong>Performance monitoring:</strong> Monitors system performance and identifies potential issues.</li>
            </ul>
        </li>
    </ol>

    <h2 id="portfolios">Portfolios</h2>
    <p>Portfolios in PS2Dox represent collections of financial instruments or assets.</p>

    <h3>Create Portfolio</h3>
    <p>Creates a new portfolio with the specified details.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "portfolios.add",
  "name": "Growth Portfolio",
  "description": "High-risk, high-reward strategy",
  "currency": "USD",
  "baseInstrument": "SPY"
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>name</td>
                <td>Name of the portfolio</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>description</td>
                <td>Description of the portfolio strategy</td>
                <td>No</td>
            </tr>
            <tr>
                <td>currency</td>
                <td>Base currency for the portfolio</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>baseInstrument</td>
                <td>Benchmark instrument for performance comparison</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong> Returns the newly created portfolio object.</p>

    <h3>List Portfolios</h3>
    <p>Retrieves a list of portfolios.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "portfolios.list",
  "filter": {"currency": "USD"}
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>filter</td>
                <td>Object with portfolio fields to filter results</td>
                <td>No</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong> Returns an array of portfolio objects matching the filter criteria.</p>

    <h3>Update Portfolio</h3>
    <p>Modifies an existing portfolio.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "portfolios.update",
  "_id": "portfolio_id",
  "description": "Updated portfolio description"
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>_id</td>
                <td>ID of the portfolio to update</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>name, description, ...</td>
                <td>Fields to update</td>
                <td>At least one</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong> Returns the updated portfolio object.</p>

    <h3>Remove Portfolio</h3>
    <p>Deletes a portfolio from the system.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "portfolios.remove",
  "_id": "portfolio_id"
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>_id</td>
                <td>ID of the portfolio to remove</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong> Returns a success message or the removed portfolio object.</p>

    <h3>Get Portfolio Performance</h3>
    <p>Calculates and returns the performance metrics for a specified portfolio over a given date range.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "portfolios.getPerformance",
  "_id": "portfolio_id",
  "startDate": "2023-01-01",
  "endDate": "2023-12-31"
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>_id</td>
                <td>ID of the portfolio</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>startDate</td>
                <td>Start date for performance calculation (YYYY-MM-DD)</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>endDate</td>
                <td>End date for performance calculation (YYYY-MM-DD)</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong> Returns an object with performance metrics including returns, volatility, and comparison to the baseInstrument.</p>

    <h2 id="prices">Prices</h2>
    <p>The Prices module in PS2Dox handles asset pricing data.</p>

    <h3>Get Current Price</h3>
    <p>Retrieves the most recent price for a specified symbol.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "prices.getCurrent",
  "symbol": "AAPL",
  "exchange": "NASDAQ"
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>symbol</td>
                <td>Ticker symbol of the asset</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>exchange</td>
                <td>Exchange where the asset is traded</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong> Returns an object with the current price and timestamp.</p>

    <h3>Get Historical Prices</h3>
    <p>Fetches historical price data for a symbol over a specified date range.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "prices.getHistorical",
  "symbol": "GOOGL",
  "startDate": "2023-01-01",
  "endDate": "2023-12-31",
  "interval": "daily"
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>symbol</td>
                <td>Ticker symbol of the asset</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>startDate</td>
                <td>Start date for historical data (YYYY-MM-DD)</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>endDate</td>
                <td>End date for historical data (YYYY-MM-DD)</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>interval</td>
                <td>Data interval (daily, weekly, monthly)</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong> Returns an array of objects, each containing a date and corresponding price data.</p>

    <h3>Set Price Alert</h3>
    <p>Creates a price alert for a specific symbol.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "prices.setAlert",
  "symbol": "TSLA",
  "condition": "above",
  "price": 800.00
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>symbol</td>
                <td>Ticker symbol of the asset</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>condition</td>
                <td>Alert condition (above, below)</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>price</td>
                <td>Target price for the alert</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong> Returns a confirmation object with the alert details.</p>

    <h3>Manage Price Feed</h3>
    <p>Allows you to subscribe to or unsubscribe from real-time price feeds for specified symbols.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "prices.manageFeed",
  "action": "subscribe",
  "symbols": ["AAPL", "GOOGL", "MSFT"]
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>action</td>
                <td>Action to perform (subscribe, unsubscribe)</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td>symbols</td>
                <td>Array of ticker symbols</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong> Returns a confirmation object with the updated subscription status.</p>

    <h2 id="tests">Tests</h2>
    <p>The Tests module in PS2Dox ensures system reliability and performance by providing a suite of testing tools. This section provides guidance on how to use these tools to verify the functionality and stability of your PS2 integrations.</p>

    <h3>Run Unit Tests</h3>
    <p>Executes unit tests for a specific module. Unit tests are designed to test individual components of the system in isolation, ensuring that each component functions correctly.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "tests.runUnit",
  "module": "authentication"
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>module</code></td>
                <td>The name of the module to test. This should correspond to a specific component or module within the PS2 system, such as <code>authentication</code>, <code>portfolios</code>, or <code>trades</code>.</td>
                <td>Yes</td>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>scenario</code></td>
                <td>The name of the integration test scenario to run. This should correspond to a specific integration test scenario defined within the PS2 system, such as <code>full_trade_cycle</code>, which tests the entire process from creating a portfolio to executing trades and calculating performance.</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong></p>
    <p>Returns a detailed report of the unit test results. The report will indicate whether each test passed or failed, and will provide detailed information about any failures.</p>
    <p><strong>Example:</strong></p>
    <p>To run unit tests for the <code>authentication</code> module, you would use the following command:</p>
    <pre><code>{
  "command": "tests.runUnit",
  "module": "authentication"
}</code></pre>
    <p>This command will execute all unit tests associated with the <code>authentication</code> module and return a report indicating the results.</p>

    <h3>Run Integration Tests</h3>
    <p>Runs integration tests to ensure different parts of the system work correctly together. Integration tests are designed to test the interactions between multiple components of the system, ensuring that they function correctly as a whole.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "tests.runIntegration",
  "scenario": "full_trade_cycle"
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>scenario</code></td>
                <td>The name of the integration test scenario to run. This should correspond to a specific integration test scenario defined within the PS2 system, such as <code>full_trade_cycle</code>, which tests the entire process from creating a portfolio to executing trades and calculating performance.</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong></p>
    <p>Returns a comprehensive report of the integration test results. The report will indicate whether each test passed or failed, and will provide detailed information about any failures.</p>
    <p><strong>Example:</strong></p>
    <p>To run the <code>full_trade_cycle</code> integration test scenario, you would use the following command:</p>
    <pre><code>{
  "command": "tests.runIntegration",
  "scenario": "full_trade_cycle"
}</code></pre>
    <p>This command will execute the <code>full_trade_cycle</code> integration test scenario and return a report indicating the results.</p>

    <h3>Run Performance Tests</h3>
    <p>Executes performance tests to evaluate the system's behavior under various load conditions. Performance tests are designed to measure the system's performance under different load conditions, such as high volume trading or concurrent user access.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "tests.runPerformance",
  "testCase": "high_volume_trading"
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>testCase</code></td>
                <td>The name of the performance test case to run. This should correspond to a specific performance test case defined within the PS2 system, such as <code>high_volume_trading</code>, which simulates a high number of concurrent trades to stress-test the system.</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong></p>
    <p>Returns a detailed performance report including metrics like response times and throughput. The report will provide insights into the system's performance under the specified load conditions.</p>
    <p><strong>Example:</strong></p>
    <p>To run the <code>high_volume_trading</code> performance test case, you would use the following command:</p>
    <pre><code>{
  "command": "tests.runPerformance",
  "testCase": "high_volume_trading"
}</code></pre>
    <p>This command will execute the <code>high_volume_trading</code> performance test case and return a report indicating the results.</p>

    <h3>Run Automated Test Suite</h3>
    <p>Runs a predefined suite of tests, which may include a combination of unit, integration, and performance tests. Automated test suites are designed to provide a comprehensive assessment of the system's functionality and stability.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "tests.runSuite",
  "suite": "daily_regression"
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>suite</code></td>
                <td>The name of the test suite to run. This should correspond to a specific test suite defined within the PS2 system, such as <code>daily_regression</code>, which is typically used to ensure no regressions have been introduced by recent changes.</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong></p>
    <p>Returns a comprehensive report of all tests run in the suite, including unit, integration, and performance test results. The report will provide an overview of the system's overall health and stability.</p>
    <p><strong>Example:</strong></p>
    <p>To run the <code>daily_regression</code> test suite, you would use the following command:</p>
    <pre><code>{
  "command": "tests.runSuite",
  "suite": "daily_regression"
}</code></pre>
    <p>This command will execute the <code>daily_regression</code> test suite and return a report indicating the results.</p>

    <h3>Tutorial: Running Tests</h3>
    <p>This tutorial provides a step-by-step guide on how to run tests using the PS2 API.</p>
    <ol>
        <li><strong>Identify the test you want to run.</strong> Determine whether you want to run unit tests, integration tests, performance tests, or an automated test suite.</li>
        <li><strong>Construct the command.</strong> Create a JSON object with the <code>command</code> key set to the appropriate test command (e.g., <code>tests.runUnit</code>, <code>tests.runIntegration</code>, <code>tests.runPerformance</code>, or <code>tests.runSuite</code>).</li>
        <li><strong>Specify the parameters.</strong> Add the required parameters to the JSON object, such as the <code>module</code> for unit tests, the <code>scenario</code> for integration tests, the <code>testCase</code> for performance tests, or the <code>suite</code> for automated test suites.</li>
        <li><strong>Execute the command.</strong> Send the JSON object to the PS2 API.</li>
        <li><strong>Analyze the output.</strong> Review the test report to determine whether the tests passed or failed. If any tests failed, investigate the cause of the failures and take corrective action.</li>
    </ol>

    <h2 id="tools">Tools</h2>
    <p>Tools provide analytical utilities that operate on price series or portfolio history.</p>

    <h3>tools.statistic</h3>
    <p>Computes a comprehensive set of financial statistics for a time series. Use either a price symbol (<code>history</code>) or a portfolio (<code>portfolio</code>) as the data source — one must be provided.</p>
    <p>In portfolio mode the portfolio's benchmark instrument (<code>baseInstrument</code>, default <code>SPY</code>) is used automatically, and benchmark-relative metrics (Beta, Alpha, Correlation, etc.) are included in the response.</p>

    <p><strong>Example — symbol:</strong></p>
    <pre><code>{
  "command": "tools.statistic",
  "history": "STIIAM.CO",
  "from": "2024-01-01",
  "msgId": "stat-1"
}</code></pre>

    <p><strong>Example — portfolio:</strong></p>
    <pre><code>{
  "command": "tools.statistic",
  "portfolio": "portfolio_id_or_name",
  "msgId": "stat-2"
}</code></pre>

    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>history</td>
                <td>Price symbol to analyse (e.g. <code>STIIAM.CO</code>, <code>AAPL:XNAS</code>). Use this or <code>portfolio</code>.</td>
                <td>One of</td>
            </tr>
            <tr>
                <td>portfolio</td>
                <td>Portfolio ID or name. Use this or <code>history</code>.</td>
                <td>One of</td>
            </tr>
            <tr>
                <td>from</td>
                <td>Start date in YYYY-MM-DD format. Required when using <code>history</code>.</td>
                <td>Conditional</td>
            </tr>
            <tr>
                <td>till</td>
                <td>End date in YYYY-MM-DD format. Defaults to today.</td>
                <td>No</td>
            </tr>
        </tbody>
    </table>

    <p><strong>Output fields</strong> (all percentage values expressed as <code>xx.xx</code>, e.g. <code>17.39</code> = 17.39%):</p>

    <p><em>Returns</em></p>
    <table>
        <thead><tr><th>Field</th><th>Description</th></tr></thead>
        <tbody>
            <tr><td>total_return</td><td>Total return over the period</td></tr>
            <tr><td>cagr</td><td>Compound annual growth rate</td></tr>
            <tr><td>incep</td><td>Return since inception</td></tr>
            <tr><td>startDate</td><td>First date found in the series</td></tr>
            <tr><td>ytd</td><td>Year-to-date return</td></tr>
            <tr><td>one_year / three_year / five_year / ten_year</td><td>Trailing period returns / CAGRs</td></tr>
            <tr><td>mtd / three_month / six_month</td><td>Month-to-date and trailing period returns</td></tr>
        </tbody>
    </table>

    <p><em>Daily</em></p>
    <table>
        <thead><tr><th>Field</th><th>Description</th></tr></thead>
        <tbody>
            <tr><td>daily_mean / daily_vol</td><td>Annualised mean and volatility</td></tr>
            <tr><td>daily_sharpe / daily_sortino</td><td>Annualised Sharpe and Sortino (rf = 0)</td></tr>
            <tr><td>daily_skew / daily_kurt</td><td>Skewness and excess kurtosis</td></tr>
            <tr><td>best_day / worst_day</td><td>Best and worst single-day return</td></tr>
            <tr><td>pos_day_perc</td><td>Percentage of positive trading days</td></tr>
            <tr><td>rolling_vol_30d</td><td>Latest 30-day rolling annualised volatility</td></tr>
        </tbody>
    </table>

    <p><em>Monthly</em></p>
    <table>
        <thead><tr><th>Field</th><th>Description</th></tr></thead>
        <tbody>
            <tr><td>monthly_mean / monthly_vol</td><td>Annualised mean and volatility</td></tr>
            <tr><td>monthly_sharpe / monthly_sortino</td><td>Monthly Sharpe and Sortino</td></tr>
            <tr><td>avg_monthly_return</td><td>Simple (non-annualised) average monthly return</td></tr>
            <tr><td>best_month / worst_month</td><td>Best and worst single-month return</td></tr>
            <tr><td>winning_months_perc</td><td>Percentage of months with positive return</td></tr>
            <tr><td>avg_up_month / avg_down_month</td><td>Average return of up and down months</td></tr>
        </tbody>
    </table>

    <p><em>Drawdown &amp; Risk</em></p>
    <table>
        <thead><tr><th>Field</th><th>Description</th></tr></thead>
        <tbody>
            <tr><td>max_drawdown</td><td>Maximum peak-to-trough drawdown</td></tr>
            <tr><td>avg_drawdown / avg_drawdown_days</td><td>Average drawdown depth and duration</td></tr>
            <tr><td>max_drawdown_days</td><td>Duration of the longest drawdown period (days)</td></tr>
            <tr><td>calmar</td><td>CAGR / |max drawdown|</td></tr>
            <tr><td>ulcer_index</td><td>Depth + duration of drawdowns combined</td></tr>
            <tr><td>martin_ratio</td><td>CAGR / Ulcer Index</td></tr>
            <tr><td>gain_to_pain</td><td>Sum of positive returns / sum of absolute negative returns</td></tr>
            <tr><td>var_95 / cvar_95</td><td>Value at Risk and Conditional VaR at 95% confidence</td></tr>
        </tbody>
    </table>

    <p><em>Benchmark-relative (portfolio mode only)</em></p>
    <table>
        <thead><tr><th>Field</th><th>Description</th></tr></thead>
        <tbody>
            <tr><td>beta</td><td>Portfolio return per 1% benchmark move</td></tr>
            <tr><td>alpha</td><td>Annualised Jensen's Alpha — excess return above what beta predicts</td></tr>
            <tr><td>correlation</td><td>Pearson correlation with benchmark (-1 to 1)</td></tr>
            <tr><td>tracking_error</td><td>Annualised std of active returns (portfolio minus benchmark)</td></tr>
            <tr><td>information_ratio</td><td>Annualised active return divided by tracking error</td></tr>
            <tr><td>up_capture</td><td>Portfolio / benchmark mean return on up-benchmark days</td></tr>
            <tr><td>down_capture</td><td>Portfolio / benchmark mean return on down-benchmark days</td></tr>
        </tbody>
    </table>
    <p>A <code>down_capture</code> below 1.0 and <code>up_capture</code> above 1.0 is the ideal pattern.</p>

    <h2 id="trades">Trades</h2>
    <p>The Trades module manages all aspects of trading operations in PS2Dox. This includes placing new orders, modifying existing orders, canceling orders, retrieving trade history, and calculating trade performance.</p>

    <h3>Place Order</h3>
    <p>Places a new order for a specified symbol within a portfolio. This command allows you to buy or sell a financial instrument on behalf of a portfolio.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "trades.placeOrder",
  "portfolioId": "portfolio_id",
  "symbol": "AAPL",
  "type": "buy",
  "quantity": 100,
  "price": 150.00,
  "orderType": "limit"
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>portfolioId</code></td>
                <td>The unique identifier of the portfolio for which the trade is being placed.</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td><code>symbol</code></td>
                <td>The ticker symbol of the financial instrument to trade (e.g., AAPL for Apple Inc.).</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td><code>type</code></td>
                <td>The type of order, which can be either <code>buy</code> or <code>sell</code>.</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td><code>quantity</code></td>
                <td>The number of shares or contracts to trade.</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td><code>price</code></td>
                <td>The limit price for the order. This parameter is only required for limit orders.</td>
                <td>Yes for limit orders</td>
            </tr>
            <tr>
                <td><code>orderType</code></td>
                <td>The type of order, which can be either <code>market</code> or <code>limit</code>. A market order is executed immediately at the best available price, while a limit order is executed only when the price reaches the specified limit price.</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong></p>
    <p>Returns an order confirmation object with order details and status. The object will include information such as the order ID, the timestamp of the order, and the current status of the order (e.g., <code>pending</code>, <code>filled</code>, <code>cancelled</code>).</p>

    <h3>Modify Order</h3>
    <p>Modifies an existing, unfilled order. This command allows you to change the quantity or price of a pending order.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "trades.modifyOrder",
  "orderId": "order_id",
  "newQuantity": 150,
  "newPrice": 155.00
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>orderId</code></td>
                <td>The unique identifier of the order to modify.</td>
                <td>Yes</td>
            </tr>
            <tr>
                <td><code>newQuantity</code></td>
                <td>The new quantity for the order. If this parameter is not specified, the quantity will not be changed.</td>
                <td>No</td>
            </tr>
            <tr>
                <td><code>newPrice</code></td>
                <td>The new price for the order (limit orders only). If this parameter is not specified, the price will not be changed.</td>
                <td>No</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong></p>
    <p>Returns the updated order object with the modified quantity or price.</p>

    <h3>Cancel Order</h3>
    <p>Cancels an unfilled order. This command allows you to cancel a pending order before it is executed.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "trades.cancelOrder",
  "orderId": "order_id"
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>orderId</code></td>
                <td>The unique identifier of the order to cancel.</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong></p>
    <p>Returns a confirmation of the cancellation. The confirmation will typically include the order ID and a message indicating that the order has been successfully cancelled.</p>

    <h3>Get Trade History</h3>
    <p>Retrieves the trading history for a specified portfolio over a given date range. This command allows you to retrieve a list of all trades executed for a particular portfolio within a specified time period.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "trades.getHistory",
  "_id": "portfolio_id",
  "from": "2023-01-01",
  "till": "2023-12-31",
  "sample": "day",
  "detail": 1
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Required</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>_id</code></td>
                <td>Portfolio selection, can be portfolio fields: _id or name</td>
                <td>Yes</td>
                <td>Identifies the portfolio for which to retrieve history</td>
            </tr>
            <tr>
                <td><code>from</code></td>
                <td>Date from which trades will be returned. Format YYYY-MM-DD</td>
                <td>No</td>
                <td>Start date of the history range</td>
            </tr>
            <tr>
                <td><code>till</code></td>
                <td>Date until which trades will be returned. Format YYYY-MM-DD</td>
                <td>No</td>
                <td>End date of the history range. If not provided, all trades from the 'from' date will be included</td>
            </tr>
            <tr>
                <td><code>sample</code></td>
                <td>Output date sampling:<br>not set or 0 - trade dates (default)<br>'day' or 1 - daily step<br>'week' or 2 - weekly step<br>'month' or 3 - monthly step</td>
                <td>No</td>
                <td>Determines the granularity of the output data</td>
            </tr>
            <tr>
                <td><code>detail</code></td>
                <td>0: show summary result only by trade dates<br>1: show summary and trades result</td>
                <td>No</td>
                <td>Determines the level of detail in the output</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output Format:</strong></p>
    <p>The output contains an array with date history results in the property 'days', and when detail=1, a property 'details' with symbol information. Each day contains:</p>
    <ul>
        <li><code>nav</code>: Net Asset Value</li>
        <li><code>cash</code>: Amount not invested in symbols</li>
        <li><code>invested</code>: Part invested via trade on this day</li>
        <li><code>investedWithoutTrades</code>: Part invested earlier, but without trade on this day (at current prices)</li>
    </ul>
    <p><strong>Note:</strong> nav = cash + invested + investedWithoutTrades</p>

    <h3>Calculate Trade Performance</h3>
    <p>Calculates the performance metrics for a specific trade, including profit/loss, return on investment, and impact on the overall portfolio performance.</p>
    <p><strong>Command:</strong></p>
    <pre><code>{
  "command": "trades.calculatePerformance",
  "tradeId": "trade_id"
}</code></pre>
    <p><strong>Parameters:</strong></p>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Description</th>
                <th>Required</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>tradeId</code></td>
                <td>The unique identifier of the trade to analyze.</td>
                <td>Yes</td>
            </tr>
        </tbody>
    </table>
    <p><strong>Output:</strong></p>
    <p>Returns a performance metrics object for the specified trade. The object will include metrics such as profit/loss, return on investment, and impact on the overall portfolio performance.</p>
</body>
</html>`;
  return (
    <>
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "auto",
          padding: "20px"
        }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
      <CloseOutlinedStyled onClick={closeDrawer} />
    </>
  );
};

export default HTMLViewer;
