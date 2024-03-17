import {getMongoose} from "../app";


// Define an asynchronous function to manage the change stream

export async function runWatcher(collectionName: string) {
    console.log('WATCHER started', collectionName);
    const db = getMongoose().connection;
    // Define the pipeline to filter events for add, update, and remove operations

    const changeStream = db.collection(collectionName).watch();
/*
    for await (const change of changeStream) {

        console.log("Received change:\n", change);

    }*/
// Define the listener for change events
    changeStream.on('change',(changeEvent) => {
        console.log('Received change event:', changeEvent);
        console.log('Operation Type:', changeEvent.operationType);

    });


}

