import {WSMsg} from "../types/other";
import useWebSocket, {ReadyState} from "react-use-websocket";
import {useCallback, useRef} from "react";


const useWSClient = (url: string, addToHistory?:(dir:string, v:string)=>void) => {
    const fragments = useRef<{ [key: string]: string[] }>({});
    const fragmentsMsg = useRef<{ [key: string]: string[] }>({});
    const canWork = useRef(false);
    const handlers = useRef<Record<string, (value: string) => void>>(
        {} as Record<string, (value: string) => void>,
    );
    const msgId = useRef(0);
    const onMessageCallback = (event: MessageEvent<string>) => {
        if (event.data !== "undefined") {
            const message = JSON.parse(event.data) as WSMsg;

            const {data, msgId = "", total, index} = message;
            if (!msgId) {
                console.log("Wrong command absent msgId");
                return "";
            }
            //  console.log(`msg > ${msgId}, ${total}, ${index}`);
            if (!fragments.current[msgId]) {
                fragments.current[msgId] = [];
            }
            fragments.current[msgId][index] = data;
            if (fragments.current[msgId].length === Number(total)) {
                //setLoading(false);
                const assembledMessage = fragments.current[msgId].join("");
                console.log(
                    "Received message msgId:",
                    msgId,
                    "len",
                    assembledMessage.length,
                );
                delete fragments.current[msgId];
                addToHistory && addToHistory("<", assembledMessage);

                console.log(
                    "call handler msgId",
                    msgId,
                    Boolean(handlers.current[msgId]),
                    handlers.current[msgId],
                );


                if (Boolean(handlers.current[msgId])) {
                    const resp = JSON.parse(assembledMessage);
                    handlers.current[msgId](resp);
                }
            }
        }
        //console.log("/onMessage");
    };

    const {sendJsonMessage, readyState, getWebSocket} = useWebSocket(url, {
        onMessage: onMessageCallback,
    }); //,  shouldConnect);
    canWork.current = readyState === ReadyState.OPEN;

    async function sendJsonMessageSync(o: object):Promise<string> {
        return new Promise((resolve, reject) => {
            const socket = getWebSocket();

            if (socket) {
                const handleMessageMsg = (event: MessageEvent) => {
                    const message = JSON.parse(event.data) as WSMsg;

                    const {data, msgId = "", total, index} = message;
                    if (!fragmentsMsg.current[msgId]) {
                        fragmentsMsg.current[msgId] = [];
                    }

                    fragmentsMsg.current[msgId][index] = data;
                    if (fragmentsMsg.current[msgId].length === Number(total)) {
                        const assembledMessage = fragmentsMsg.current[msgId].join("");
                        delete fragmentsMsg.current[msgId];
                        if (msgId === (o as { msgId: string }).msgId) {
                            resolve(assembledMessage);
                            // @ts-ignore
                            socket.removeEventListener("message", handleMessageMsg); // Remove the event listener
                        }
                    }
                };

                // @ts-ignore
                socket.addEventListener("message", handleMessageMsg);

                socket.onerror = (error: Event) => {
                    reject(error);
                };
                addToHistory && addToHistory(">", JSON.stringify(o));
                sendJsonMessage(o);
            } else {
                reject({error: "socket is closed"});
            }
        });
    }

    const sendMsg = async (cmd: object,  parse:boolean= false) => {
        msgId.current++;
        //console.log("SendMSG", { ...cmd, msgId: msgId.current });
        try {
            const rez= await sendJsonMessageSync({...cmd, msgId: msgId.current});
            return parse ? JSON.parse(rez) : rez;
        } catch (er) {
            console.log("SendMsg error", er);
        }
    };
    const clearMsgId = useCallback(() => msgId.current = 0, [])
    return {canWork, handlers, sendMsg, sendJsonMessageSync, readyState, getWebSocket, clearMsgId, msgId}
}


export default useWSClient;
