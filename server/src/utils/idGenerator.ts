export function generateAccountID(): string {
    // Define the allowed characters for the account ID
    //const allowedChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const allowedChars = '0123456789';

    // Generate a random account ID
    let accountID = '';
    for (let i = 0; i < 8; i++) {
        accountID += allowedChars.charAt(Math.floor(Math.random() * allowedChars.length));
    }

    // Calculate validation characters
    const validationChars = calculateValidationChars(accountID);
    accountID += validationChars;
console.log('accountId==============', accountID, validateAccountID(accountID))
    return accountID;
}

// Function to calculate validation characters
function calculateValidationChars(accountID: string): string {
    const charCodes = accountID.split('').map(char => char.charCodeAt(0));
    const sum = charCodes.reduce((acc, curr) => acc + curr, 0);
    const validationChars = String.fromCharCode(sum % 26 + 65) + String.fromCharCode((sum * 7) % 26 + 65) + String.fromCharCode((sum * 13) % 26 + 65);
    return validationChars;
}

// Validation function
export function validateAccountID(accountID: string): boolean {
    const idLength = accountID.length;
    const validationChars = accountID.slice(idLength - 3, idLength);
    const idChars = accountID.slice(0, idLength - 3);

    const expectedValidationChars = calculateValidationChars(idChars);

    return validationChars === expectedValidationChars;
}

