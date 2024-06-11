import { Command } from "../types/command";
import {ErrorType} from "../types/other";

export * from "./is-mobile";
export * from "./remember-route";

export const isUserCommand = (c: Command) => c.commandType === "user";

export function isVarObject(value: any) {
  return typeof value === "object" && value !== null;
}

export function isSymbol(s: string) {
  return s.indexOf("TOTAL") !== 0;
}

export function extractAndRemoveSubArray0<T extends object>(
  array: T[],
  property: keyof T,
  value: T[Extract<keyof T, string[]>],
): [T[], T[]] {
  const subArray = array.filter((item) => item[property] === value);
  array = array.filter((item) => item[property] !== value);
  return [subArray, array];
}

export function extractAndRemoveSubArray<T extends object>(
  array: T[],
  property: keyof T,
  values: T[Extract<keyof T, string[]>][],
): [T[], T[]] {
  const subArray = array.filter((item) =>
    values.includes(item[property] as any),
  );
  array = array.filter((item) => !values.includes(item[property] as any));
  return [subArray, array];
}

export function insertBeforeIndex<T>(
  arr: T[],
  index: number,
  elementsToInsert: T[],
) {
  // Create a new array to avoid modifying the original
  const newArr = [...arr];

  // Insert the elements before the specified index
  newArr.splice(index, 0, ...elementsToInsert);

  return newArr;
}


export function isErrorType(obj: any): obj is ErrorType {
  return typeof obj === 'object' && obj !== null && 'error' in obj;
}




