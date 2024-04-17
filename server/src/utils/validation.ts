export function validateJSONArrayString(jsonArrayString: string): boolean {
    try {
        const jsonArray: any[] = JSON.parse(jsonArrayString);

        // Ensure the parsed JSON is an array
        if (!Array.isArray(jsonArray)) {
            return false;
        }

        // Check if each element is an object with key-value pairs
        for (const obj of jsonArray) {
            if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) {
                return false;
            }
            // Optional: Validate the structure of each object (key-value pairs)
            for (const key in obj) {
                if (typeof key !== 'string' || typeof obj[key] === 'undefined') {
                    return false;
                }
            }
        }

        return true; // Valid JSON array of objects
    } catch (error) {
        return false; // Failed to parse JSON
    }
}
