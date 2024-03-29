import {message} from "antd";
import {Command} from "../types/command";

export * from "./is-mobile";
export * from "./remember-route";


const jsonRegex = /\{(?:[^{}]|{[^{}]*})*\}/g
export const getCommands = (text:string) => {

    const jsonMatches = text.match(jsonRegex);
    const jsonArray: any[] = [];

    jsonMatches?.forEach((jsonString) => {
        try {
            const jsonObject = JSON.parse(jsonString);
            console.log(jsonObject)
            if (jsonObject.command) {
                jsonArray.push(jsonObject);
            }
        } catch (error) {
            return []
        }
    });
console.log('jsonArray',jsonArray);
    return jsonArray;
}

export const isUserCommand = (c:Command) => c.commandType === 'user'
