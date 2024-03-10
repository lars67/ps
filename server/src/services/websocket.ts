import {WebSocketServer, WebSocket} from "ws";
import jwt, {JwtPayload} from "jsonwebtoken";
import {login} from "./auth";
import controller from "../controllers/websocket";
import logger from "../utils/logger";

const loginPort = 3001;
const mainServerPort = 3002;

const secretKey = "ps2-secret-key";

type  UserWebSocket = WebSocket & {userId: string}
interface ClientType {
    socket:WebSocket,
    token: string | JwtPayload | undefined//wtPayload//{userId: string, username: string}

}


export const initWS = () => {
    const loginServer = new WebSocketServer({port: loginPort});

    console.log("-------------------- SOCKET SERVER -------------");
    loginServer.on("connection", (socket) => {
        socket.on("message", async (data) => {
            const {username, password} = JSON.parse(data.toString());
             const user = await  login(username, password)
            if (user) {
                const token = jwt.sign(
                    {userId: user?._id, name: user?.name},
                    secretKey,
                );
                socket.send(JSON.stringify({token}));
            } else {
                socket.send(JSON.stringify({error: "Invalid username or password"}));
            }
        });
    });
//maxPayload {Number} The maximum allowed message size in bytes. Defaults to 100 MiB (104857600 bytes).
    const mainServer = new WebSocketServer({port: mainServerPort, maxPayload:204857600});

    let clients: ClientType[] = [];
    mainServer.on("connection", (socket, req) => {
        const fullQuery =  req.url?.split('?')[1] || ''; // Get query parameters from URL
        const [query, modif=''] =fullQuery.split('@')
        const token = req.headers["authorization"] || query
        let userId: string;
        console.log("client connected", token, modif);


        if (!token) {
            return socket.close(4001, "Authentication error: Token missing");
        }

        jwt.verify(token.toString(), secretKey, (err, decoded) => {
            if (err) {
                console.log('tokeb bad',err)
                return socket.close(4002, "Authentication error: Invalid token");
            }
            //? socket.decoded = decoded;
            console.log("decoded", decoded);
            (socket as UserWebSocket).userId = (decoded as JwtPayload)?.userId;
            userId  = (decoded as JwtPayload)?.userId;
            clients.push({socket, token: decoded})
            logger.log(`  connection open with token ${token}`);

        });
        socket.on("message", async (message) => {
            const msg = JSON.parse(message.toString());
            console.log(
                "Received message from client:",msg
            );
            logger.log(`> ${message}`);
           const response = await controller(msg, sendResponse(socket,msg), modif, userId )
           //sendFragmented(socket, JSON.stringify({ command: msg.command, msgId:msg.msgId, ...(response.error ? response.error : {data:response})}), msg.msgId)
        });

        socket.on('close', () => {
            logger.log(`  connection closed`);
            const position = clients.findIndex(client => client.socket === socket);
            position >= 0 && clients.splice(position, 1);
        })
    });
    console.log(`Login server running on port ${loginPort}`);
    console.log(`Main server running on port ${mainServerPort}`);
}


function chunkString(str:string, size:number) {
    const chunks = [];
    for (let i = 0; i < str.length; i += size) {
        chunks.push(str.slice(i, i + size));
    }
    return chunks;
}

const sendResponse = (socket:WebSocket,msg:any) => async (response: any) => {
   //console.log('sendResponse===>',msg, response);
    const cmd = JSON.stringify({ command: msg.command, msgId:msg.msgId, ...(response.error ? {error:response.error} : {data:response})})
    logger.log(`< ${cmd}`)
    sendFragmented(socket, cmd, msg.msgId)
}
function sendFragmented(socket:WebSocket, msg: string, msgId:string){

    const fragments = chunkString(msg, 1024);
    fragments.forEach((fragment, index) => {
        setTimeout(() => {
            socket.send(JSON.stringify({
                index,
                total: fragments.length,
                data: fragment,
                msgId
            }));
            console.log('sended', index, 'of', fragments.length);
        }, 0);
    });



}
