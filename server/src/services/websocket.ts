import { WebSocketServer, WebSocket } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import {login, signup} from "./auth";
import controller from "../controllers/websocket";
import logger from "../utils/logger";
import * as https from "https";
import {ErrorType} from "../types/other";
import cookie from 'cookie';


const secretKey = "ps2-secret-key";

export type UserWebSocket = WebSocket & { userId: string, waitNum:number};

export type UserData = {
  userId:string,
  name: string,
  role: string
}
interface ClientType {
  socket: WebSocket;
  token: string | JwtPayload | undefined; //wtPayload//{userId: string, username: string}
}

export const initWS = (serverLogin: https.Server, serverApp: https.Server) => {
  const loginServer = new WebSocketServer({ server:serverLogin });

  console.log("-------------------- SOCKET SERVER -------------");
  loginServer.on("connection", (socket, req) => {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.ps2token;

    console.log('TTTTTTTTTTTTTTTTTTTTTTTOKEN', token, Object.keys(cookies))

    socket.on("message", async (data) => {
      const { name, password, email='', cmd='login' } = JSON.parse(data.toString());
      if (cmd === 'signup') {
        const user = await signup(name, password, email);
        console.log('signup', user);
        socket.send(JSON.stringify(user));
      } else {
        const user = await login(name, password);
        if (user) {
          console.log('UUUUUUUUUUUUUUUUUUUU', user)
          const token = jwt.sign(
              { name: user?.name, role: user?.role,  userId: user?._id?.toString()},
              secretKey,
          );
          socket.send(JSON.stringify({token,role:user.role, userId: user?._id?.toString()}));
        } else {
          socket.send(JSON.stringify({error: "Invalid user name or password"}));
        }
      }
    });
  });
  //maxPayload {Number} The maximum allowed message size in bytes. Defaults to 100 MiB (104857600 bytes).
  const mainServer = new WebSocketServer({
    //port: mainServerPort,
  //  maxPayload: 204857600,
    server: serverApp
  });

  let clients: ClientType[] = [];
  mainServer.on("connection", (socket, req) => {
    const fullQuery = req.url?.split("?")[1] || ""; // Get query parameters from URL
    const [query, modif = ""] = fullQuery.split("@");
    const token = req.headers["authorization"] || query;
    let userData:UserData;
    console.log("client connected", token, modif);

    if (!token) {
      return socket.close(4001, "Authentication error: Token missing");
    }
  /*  req.headers.setHeader(
        'Set-Cookie',
        cookie.serialize('ps2token', 'your_token_value', cookieOptions)
    );*/

    jwt.verify(token.toString(), secretKey, (err, decoded) => {
      if (err) {
        console.log("tokeb bad", err);
        return socket.close(4002, "Authentication error: Invalid token");
      }
      //? socket.decoded = decoded;
      console.log("decoded", decoded);
      (socket as UserWebSocket).userId = (decoded as JwtPayload)?.userId;
      (socket as UserWebSocket).waitNum = 0
      userData = (decoded as UserData);
      console.log('decoded as UserData', userData);
      clients.push({ socket, token: decoded });
      logger.log(`  connection open with token ${token}`);
    });
    socket.on("message", async (message) => {
      const msg = JSON.parse(message.toString());
      logger.log(`> ${message}`);

      const response = await controller(
        msg,
        sendResponse(socket, msg),
        modif,
        userData,
        socket
      );
    });

    socket.on("close", () => {
      logger.log(`  connection closed`);
      const position = clients.findIndex((client) => client.socket === socket);
      position >= 0 && clients.splice(position, 1);
    });
  });
//  console.log(`Login server running on port ${loginPort}`);
//  console.log(`Main server running on port ${mainServerPort}`);
};

function chunkString(str: string, size: number) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

const sendResponse = (socket: WebSocket, msg: any) => async (response: any) => {
 console.log('sendResponse===> READYsTATE',socket.readyState,'WAITnUM', (socket as UserWebSocket).waitNum);



  if (response) {
    const cmd = JSON.stringify({
      command: msg.command,
      msgId: msg.msgId,
      ...(response.error ? {error: response.error} : {data: response}),
    });
    logger.log(`< ${cmd}`);
    sendFragmented(socket, cmd, msg.msgId);
  }
};
function sendFragmented(socket: WebSocket, msg: string, msgId: string) {
  const fragments = chunkString(msg, 1024);
  fragments.forEach((fragment, index) => {
    setTimeout(() => {
      socket.send(
        JSON.stringify({
          index,
          total: fragments.length,
          data: fragment,
          msgId,
        }),
      );
      //   console.log('sended', index, 'of', fragments.length);
    }, 0);
  });
}



