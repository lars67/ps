import { EventEmitter } from "events";

const eventEmitter = new EventEmitter();

export default eventEmitter;

export const sendEvent = async (eventName: string, data: object | string) => {
  //console.log(`sendEvent EVENT >>>>> ${eventName} `);//${JSON.stringify(data)}`);
  eventEmitter.emit(eventName, data);
  return true;
};



