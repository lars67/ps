import { CommandDescription } from "@/types/custom";

const features: { [key: string]: NodeJS.Timeout } = {};

const createFeature = async (
  { symbols }: { symbols: string[] | string },
  sendResponse: (data: any) => void,
) => {
  console.log("createFeature symbols", symbols);
  let nch = 0;
  const symbolsAr = typeof symbols === "string" ? symbols.split(",") : symbols;
  let data = symbolsAr.map((symbol: string) => {
    const bid = Math.round(1000 * Math.random());
    return { symbol, bid, ask: bid + Math.round(10 * Math.random()) };
  });
  const timerId = setInterval(() => {
    data = data.map((d) => {
      const newBid = d.bid + Math.round(5 * Math.random() - 2);
      return { ...d, bid: newBid, ask: newBid + 0.5 };
    });
    sendResponse(data);
  }, 3000);
  return { timerId, data };
};

function getFKey(msgId: string, userModif: string): string {
  return `${userModif}-${msgId}`;
}
export const subscribe = async (
  par: any,
  sendResponse: (data: object) => void,
  msgId: string,
  userModif: string,
  userId: string,
) => {
  const fKey = getFKey(msgId, userModif);

  const { timerId, data } = await createFeature(par, sendResponse);
  features[fKey] = timerId;
  console.log("SUBSCRIBE ", userModif, msgId, "=>", fKey, ":", timerId);
  return data;
};
export const unsubscribe = async (
  par: any,
  sendResponse: (data: object) => void,
  msgId: string,
  userModif: string,
  userId: string,
) => {
  const { subscribeMsgId } = par;
  const fKey = getFKey(subscribeMsgId, userModif);
  console.log(
    "subscribeMsgId",
    subscribeMsgId,
    "fKey",
    fKey,
    Object.keys(features),
  );

  if (features[fKey]) {
    clearInterval(features[fKey]);
    console.log(
      "UNSUBSCRIBE////////////////////// ",
      { subscribeMsgId },
      "fKey",
      fKey,
    );
  }
  return { subscribeMsgId };
};

export const description: CommandDescription = {
  subscribe: {
    label: "Subscribe to symbol",
    value: JSON.stringify({ command: "symbols.subscribe", symbols: "A,B,C" }),
  },
  unsubscribe: {
    label: "UnSubscribe to symbol",
    value: JSON.stringify({
      command: "symbols.unsubscribe",
      subscribeMsgId: "?",
    }),
  },
};
