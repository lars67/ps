import {message} from "antd";
import {Command} from "../types/command";

export * from "./is-mobile";
export * from "./remember-route";





export const isUserCommand = (c:Command) => c.commandType === 'user'


