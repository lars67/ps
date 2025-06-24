const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'PS2', 'ps2.commands.json');

// Helper function to find the matching closing brace for a given opening brace index
function findClosingBrace(str, openBraceIndex) {
    let braceCount = 0;
    for (let i = openBraceIndex; i < str.length; i++) {
        if (str[i] === '{') {
            braceCount++;
        } else if (str[i] === '}') {
            braceCount--;
        }
        if (braceCount === 0 && i > openBraceIndex) {
            return i;
        }
    }
    return -1; // No matching closing brace found
}

try {
    const data = fs.readFileSync(filePath, 'utf8');
    const records = JSON.parse(data);
    const commandArguments = {}; // { 'commandName': Set<argumentName> }

    records.forEach(record => {
        const valueString = record.value;
        const commandRegex = /"command":"([a-zA-Z0-9\.]+)"/g;
        let match;

        while ((match = commandRegex.exec(valueString)) !== null) {
            const commandName = match[1];
            const commandIndicatorIndex = match.index;

            let openBraceIndex = valueString.lastIndexOf('{', commandIndicatorIndex);
            if (openBraceIndex === -1) continue;

            const closeBraceIndex = findClosingBrace(valueString, openBraceIndex);
            if (closeBraceIndex === -1) continue;

            const jsonCandidate = valueString.substring(openBraceIndex, closeBraceIndex + 1);

            try {
                const parsedCommand = JSON.parse(jsonCandidate);
                if (parsedCommand.command === commandName) {
                    if (!commandArguments[commandName]) {
                        commandArguments[commandName] = new Set();
                    }
                    for (const key in parsedCommand) {
                        if (key !== 'command' && key !== 'msgId' && key !== '_as' && key !== '__v' && key !== '_id' && key !== 'label' && key !== 'value' && key !== 'ownerId' && key !== 'access' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'description' && key !== 'v') {
                            commandArguments[commandName].add(key);
                        }
                    }
                }
            } catch (e) {
                // Silently skip if parsing fails for a segment.
            }
        }
    });

    // Generate Markdown content
    let markdownContent = '# PS2 Commands Overview\n\n';
    const sortedCommands = Object.keys(commandArguments).sort();

    sortedCommands.forEach(cmdName => {
        markdownContent += '## ' + cmdName + '\n\n';
        if (commandArguments[cmdName].size > 0) {
            const sortedArgs = Array.from(commandArguments[cmdName]).sort();
            sortedArgs.forEach(arg => {
                markdownContent += '- ' + arg + '\n';
            });
        } else {
            markdownContent += 'No specific arguments extracted from available examples for this command.\n';
        }
        markdownContent += '\n';
    });

    const outputFilePath = path.join(__dirname, 'commands_overview.md');
    fs.writeFileSync(outputFilePath, markdownContent, 'utf8');
    console.log('commands_overview.md created successfully.');

} catch (err) {
    console.error('Error reading, parsing, or writing file:', err);
}