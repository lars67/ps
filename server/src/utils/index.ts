import mongoose, {Document, Model, Schema, model, models, connect} from 'mongoose';
import {dbConnection} from "@/db";

export function createDefaultObject<T>(type: new () => T): T {
    return new type();
}

export function getTypeJSON<T>(type: new () => T, values:Partial<T>): string {
    return JSON.stringify(type);
}



// Define a function to create a model instance based on the collection name
export const getModelByCollectionName = (collectionName: string): Model<Document> | null => {
    // Check if the model for the given collection name already exists
    const existingModel = models[collectionName];
    if (existingModel) {
        return existingModel;
    } else {
        // If the model doesn't exist, return null
        return null;
    }
};




export const getObjectByCollectionName = (collectionName: string): object | null => {
    // Check if the model for the given collection name already exists
    const existingModel = models[collectionName];
    console.log('&$existingModel-', collectionName,models)
    if (existingModel) {
        console.log('&$existingModel')
        // Retrieve the schema from the model
        const schema = existingModel.schema;
        console.log('&$existingModel.schema', existingModel.schema, schema.paths)
        // Initialize an empty object to store the default values
        const defaultValues = {};
        // Iterate through the schema paths
        for (const key in schema.paths) {
            if (Object.prototype.hasOwnProperty.call(schema.paths, key)) {
                // Check if the field has a default value defined
                const defaultValue = schema.paths[key].default;
                console.log(key, defaultValue)
                // If a default value is defined, add it to the object
                if (defaultValue !== undefined) {
                    // @ts-ignore
                    defaultValues[key] = defaultValue;
                }
            }
        }
        return defaultValues;
    } else {
        // If the model doesn't exist, return null
        return null;
    }
};


type mapsCollectionName = {
    [key: string]: {list:object, add:object, update:object, remove:object}
}


export const collectionNameToComPar = (mongoose: typeof import("mongoose")) => {
        const maps:mapsCollectionName = {};
        for (const Model of Object.values(mongoose.models)) {
           // console.log(Model.collection.name)
            const list =  {filter:{}}
            const add =      Object.keys(Model.schema.paths).filter(k=>k!=='__v' && k!=='_id').reduce((o,fld,i) => {
                // @ts-ignore
                return {...o, [fld]:Model.schema.paths[fld].defaultValue || ''}
            }, {})
            const update =      Object.keys(Model.schema.paths).filter(k=>k!=='__v' && k!=='_id').reduce((o,fld,i) => {
                // @ts-ignore
                return {...o, [fld]:Model.schema.paths[fld].defaultValue || ''}
            }, {_id:'?'})

            const remove= {_id:'?'}

            //console.log(list, add, update, remove)
            maps[Model.collection.name] = {list, add, update, remove}
        }
        return maps;
}
