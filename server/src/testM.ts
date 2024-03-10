
import {dbConnection} from './db'
import { connect } from 'mongoose';
import {getObjectByCollectionName} from "./utils";

let mongoose: typeof import("mongoose")
const testM1 = async  () => {
    mongoose = await connect(dbConnection.url);
    const r = getObjectByCollectionName('Sector')
    console.log('r=',  r)
}

testM1();
