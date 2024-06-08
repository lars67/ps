
export type CommandDescription = {
  [key: string]: { label?: string; value?: string, access?: string, extended?: object[]} | null;
};
