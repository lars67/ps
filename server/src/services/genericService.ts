
import { Document, Model, FilterQuery, UpdateQuery } from 'mongoose';

// Define a generic function to list documents based on a filter
export async function list<T extends Document>(
    Model: Model<T>,
    filter: FilterQuery<T> = {}
): Promise<T[] | null> {
    try {
        return  await Model.find(filter).lean();
    } catch (err) {
        console.error('Error listing documents:', err);
        return null;
    }
}

// Define a generic function to add a document
export async function add<T extends Document>(
    Model: Model<T>,
    document: Partial<T>
): Promise<T | null> {
    try {
        const newDocument = new Model(document);
        const added = await newDocument.save();
        return added;
    } catch (err) {
        console.error('Error adding document:', err);
        return null;
    }
}

// Define a generic function to update a document
export async function update<T extends Document>(
    Model: Model<T>,
    query: FilterQuery<T>,
    update: UpdateQuery<T>
): Promise<T | null> {
    try {
        const updated = await Model.findOneAndUpdate(query, update, { new: true });
        return updated;
    } catch (err) {
        console.error('Error updating document:', err);
        return null;
    }
}

// Define a generic function to remove a document
export async function remove<T extends Document>(
    Model: Model<T>,
    query: FilterQuery<T>
): Promise<T | null> {
    try {
        const removed = await Model.findOneAndDelete(query);
        return removed;
    } catch (err) {
        console.error('Error removing document:', err);
        return null;
    }
}

