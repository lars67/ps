import { EventEmitter } from "events";

const eventEmitter = new EventEmitter();

export default eventEmitter;

export const sendEvent = async (eventName: string, data: object | string) => {
  eventEmitter.emit(eventName, data);
  return true;
};
