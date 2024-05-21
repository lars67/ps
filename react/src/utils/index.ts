import {message} from "antd";
import {Command} from "../types/command";

export * from "./is-mobile";
export * from "./remember-route";





export const isUserCommand = (c:Command) => c.commandType === 'user'


export function isVarObject(value:any ) {
    return typeof value === 'object' && value !== null;
}



export function isSymbol(s:string) {
    return s.indexOf('TOTAL') !==0
}
