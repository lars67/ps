import {WebSocket} from "ws";
import {sendFragmented} from "../services/websocket";
import {getGuestAccessAlowedCommands} from "../services/command";

export function guestAccessAllowed( socket:WebSocket, { command, msgId }: {command:string, msgId: string} ) {
    const allowed = getGuestAccessAlowedCommands().includes(command)
    console.log('guestAccessAllowed>>>>',command, allowed, getGuestAccessAlowedCommands());
    if (!allowed) {
        sendFragmented(socket, `{"error": "command '${command}' is not allowed for anonymous"}`, msgId)
    }
    return allowed;
}
