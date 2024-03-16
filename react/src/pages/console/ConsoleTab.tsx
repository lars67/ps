import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Flex,
  message,
  Row,
  Select,
  Typography,
  Switch,
  Tooltip,
  Popover,
} from "antd";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { useAppSelector } from "../../store/useAppSelector";

import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import "./style.css";
import { commandTypes } from "./helper";
import { Command } from "../../types/command";
import { JsonToTable } from "react-json-to-table";
import { LabelValue } from "../../types/LabelValue";
import UserCommand from "./UserCommand";
import Forms from "./forms";
import { getCommands } from "../../utils";
import { historyCommands } from "./index";

import HistoryCommands from "../../components/HistoryCommands";
import OptionsPopup from "../../components/OptionsPopup";

type WSMsg = {
  data: string;
  msgId?: string;
  total: string;
  index: number;
};

const Console = () => {
  const [loading, setLoading] = useState(false);
  const token = useAppSelector((state) => state.user.token);
  const modif = useRef(Math.round(10000 * Math.random()));
  const url = `${process.env.REACT_APP_WS}?${encodeURIComponent(token)}@${modif.current}`;
  const fragments = useRef<{ [key: string]: string[] }>({});
  const fragmentsMsg = useRef<{ [key: string]: string[] }>({});
  const [result, setResult] = useState<string>("");
  const [actualCommands, setActualCommands] = useState<Command[]>([]);
  const [commands, setCommands] = useState<Command[]>([]);
  const [command, setCommand] = useState("");
  const [value, setValue] = useState("");
  const [commandTypeFilter, setCommandTypeFilter] = useState("");
  const [historyMsgId, setHistoryMsgId] = useState("");
  const needReconnect = useRef<boolean>(true);
  const msgId = useRef(0);
  const [openUserCommand, setOpenUserCommand] = useState(false);
  const [showHelpForm, setShowHelpForm] = useState(false);
  const [commandLabel, setCommandLabel] = useState("");
  const [actualCommandsFiltered, setActualCommandsFiltered] = useState<
    Command[]
  >([]);
  const { clearAlwaysResult } = useAppSelector((state) => state.options);
  const [commandOption, setCommandOption] = useState<Command| Command[]>()
  const onMessageCallback = (event: MessageEvent<string>) => {
    if (event.data !== "undefined") {
      const message = JSON.parse(event.data) as WSMsg;

      const { data, msgId = "", total, index } = message;
      if (!msgId) {
        console.log("Wrong command absent msgId");
        return "";
      }
      console.log(`msg > ${msgId}, ${total}, ${index}`);
      if (!fragments.current[msgId]) {
        fragments.current[msgId] = [];
      }
      fragments.current[msgId][index] = data;
      if (fragments.current[msgId].length === Number(total)) {
        setLoading(false);
        const assembledMessage = fragments.current[msgId].join("");
        console.log("Received message:", assembledMessage.length);

        delete fragments.current[msgId];
        if (msgId === "ws_commands") {
          const commands = JSON.parse(assembledMessage).data;
          setCommands(commands);

          console.log("ws_commads");
          return;
        }
        const s = JSON.stringify(JSON.parse(assembledMessage), null, 2);
        setResult((result) => result.concat(s + "\n\n"));
      }
    }
  };

  const { sendJsonMessage, readyState, getWebSocket } = useWebSocket(url, {
    onMessage: onMessageCallback,
    retryOnError: true,
    shouldReconnect: (event: WebSocketEventMap["close"]) => {
      //console.log('REEEEEEEEEEEEEEEEEEE22EEEEEEEEEECONNECT', needReconnect.current)
      return false; //needReconnect.current
    },
    reconnectInterval: 5000,
    reconnectAttempts: 3,
  });

  useEffect(() => {
    return () => {
      needReconnect.current = false;
      console.log("RECONNNECT TO FALS2222E");
    };
  }, []);

  useEffect(() => {
    sendJsonMessage({ command: "commands.list", msgId: "ws_commands" });
    msgId.current = 0;
  }, []);

  const handleSend = useCallback(async () => {
    let parsedValue: any = {};
    try {
      const commands = getCommands(value);
      if (commands.length <= 0) {
        message.open({
          type: "error",
          content: "Command json is wrong",
        });
        return;
      }
      commands.map((parsedValue) => {
        setLoading(true);
        //fragments.current = [];

        msgId.current++;
        const cmd = { ...parsedValue, msgId: msgId.current };
        if (clearAlwaysResult){
          setResult("")
        }
        sendJsonMessage(cmd);
      });
      historyCommands.unshift({ value, label: commandLabel });
      if (historyCommands.length > 12) {
        historyCommands.pop();
      }
    } catch (err) {
      message.open({
        type: "error",
        content: "Command json is wrong",
      });
      setLoading(false);
      return;
    }
  }, [value, commandLabel, clearAlwaysResult]);
  /*
  useEffect(() => {
    if (newMsg) {
      const s = JSON.stringify(JSON.parse(newMsg), null, 2)
        setResult(result=> result.concat(s+'\n\n'));

        setNewMsg('');
    }

  }, [newMsg]);


*/

  const [connectionStatusText, connectionStatus]: [
    string,
    "processing" | "success" | "warning" | "default" | "error" | undefined,
  ] = useMemo(() => {
    const statusMap: {
      [key in ReadyState]?: [
        string,
        "processing" | "success" | "warning" | "default" | "error" | undefined,
      ];
    } = {
      [ReadyState.CONNECTING]: ["Connecting", "processing"],
      [ReadyState.OPEN]: ["Open", "success"],
      [ReadyState.CLOSING]: ["Closing", "warning"],
      [ReadyState.CLOSED]: ["Closed", "warning"],
      [ReadyState.UNINSTANTIATED]: ["Uninstantiated", "warning"],
    };
    return statusMap[readyState] || ["Unknown", undefined]; // Handle undefined case
  }, [readyState]);
  const canWork = connectionStatus === "success";

  const onChange = useCallback((val: string) => {
    setValue(val);
  }, []);

  const handleClearResult = useCallback(() => setResult(""), []);

  const handleClear = useCallback(() => setValue(""), []);

  const handleChangeCommandType = useCallback(
    (value: string) => setCommandTypeFilter(value),
    [],
  );
  const handleChangeCommand = useCallback(
    (value: string,option:Command| Command[]) => {
      setCommand(value);
      setValue(value);
      setCommandOption(option);
      setCommandLabel((option as Command).label || '');
      //setShowHelpForm(true);
    },
    [actualCommands],
  );

  const [showTable, setShowTable] = useState(false);
  const handleShowTable = useCallback((b: boolean) => {
    setShowTable(b);
  }, []);

  useEffect(() => {
    const c = commandTypeFilter
      ? commands.filter((c) => c.commandType === commandTypeFilter)
      : commands;

    setActualCommands(c);
    setActualCommandsFiltered(c);
  }, [commandTypeFilter, commands]);

  const [resultJson, history] = useMemo(() => {
    if (result.length > 10) {
      try {
        const ar = result.split("\n\n").filter((s) => Boolean(s));
        const jsons: any[] = [];
        const history: LabelValue[] = [{ label: "All", value: "" }];
        ar.map((a) => {
          const json = JSON.parse(a);
          jsons.push(json);
          history.push({ label: json.command, value: json.msgId });
        });
        return [jsons, history];
      } catch (er) {
        console.log("ER", er);
      }
    }
    return [[], []];
  }, [result]);

  const handleChangeHistoryMsgId = useCallback((value: string) => {
    setHistoryMsgId(value);
  }, []);

  async function sendJsonMessageSync(o: object) {
    return new Promise((resolve, reject) => {
      const socket = getWebSocket();

      if (socket) {
        const handleMessageMsg = (event: MessageEvent) => {
          const message = JSON.parse(event.data) as WSMsg;

          const { data, msgId = "", total, index } = message;
          if (!fragmentsMsg.current[msgId]) {
            fragmentsMsg.current[msgId] = [];
          }
          console.log(
            ">>>>>>>>>",
            msgId,
            total,
            index,
            fragmentsMsg.current[msgId].length,
          );
          fragmentsMsg.current[msgId][index] = data;
          if (fragmentsMsg.current[msgId].length === Number(total)) {
            const assembledMessage = fragmentsMsg.current[msgId].join("");
            delete fragmentsMsg.current[msgId];
            resolve(assembledMessage);
            // @ts-ignore
            socket.removeEventListener("message", handleMessageMsg); // Remove the event listener
          }
        };

        // @ts-ignore
        socket.addEventListener("message", handleMessageMsg);

        socket.onerror = (error: Event) => {
          reject(error);
        };
        sendJsonMessage(o);
      } else {
        reject({ error: "socket is closed" });
      }
    });
  }

  const sendMsg = useCallback(async (cmd: object) => {
    msgId.current++;
    console.log("SendMSG", { ...cmd, msgId: msgId.current });
    const r = await sendJsonMessageSync({ ...cmd, msgId: msgId.current });
    console.log("SYYYYYYYYYYYYYYNC", r);
    return r;
  }, []);

  const handleSave = useCallback(async () => {
    let parsedValue: any = {};
    try {
      const commands = getCommands(value);
      if (commands.length <= 0) {
        message.open({
          type: "error",
          content: "Absent commands",
        });
        return;
      }
    } catch (err) {
      message.open({
        type: "error",
        content: "Command json is wrong",
      });
      return;
    }
    setOpenUserCommand(true);
  }, [value]);

  const handleHelpForm = useCallback((value?: string) => {
    if (value) {
      setValue(value);
    }
    setShowHelpForm(false);
  }, []);

  const handleFilter = useCallback(
    (inputValue: string) => {
      setActualCommandsFiltered(
        actualCommands.filter((option) =>
          (option?.label as string)
            .toLowerCase()
            .includes(inputValue.toLowerCase()),
        ),
      );
    },
    [actualCommands],
  );

  const handleCloseUserCommand = useCallback((cmd: Command | undefined, isAdd?:boolean) => {
    if (cmd) {
      if (isAdd) {
       // cmd.value= JSON.parse(cmd.value ?? '');
        setCommands(commands=> [...commands, cmd]);
      } else {
        const trg = commands.find(c=> c._id === cmd._id)
        console.log(cmd, trg )
        setCommands(commands=> commands.map(c=> c._id=== cmd._id ? cmd : c));

      }
   //   setValueCommands((commands) => [...commands, c]);
    }
    setOpenUserCommand(false);
  }, [commands]);

  const handleGetFromHistory = useCallback(
    ({ value = "", label = "" }: LabelValue) => {
      setValue(value);
      setCommandLabel(label);
    },
    [setValue],
  );

  return (
    <div className="playground-container">
      <div className="cm-header">
        <HistoryCommands onGetFromHistory={handleGetFromHistory} />
        <Select
          value={commandTypeFilter}
          onChange={handleChangeCommandType}
          className="row-item"
        >
          {commandTypes.map((option, index) => (
            <Select.Option key={`cmdt-${index}`} value={option.value}>
              {option.label}
            </Select.Option>
          ))}
        </Select>
        <Tooltip arrow title={"Commands group filter"}>
          <Select
            value={command}
            onChange={handleChangeCommand}
            className="row-item"
            showSearch
            onSearch={handleFilter}
            style={{ width: 200 }}
            placeholder="Search to Select"
            optionFilterProp="label"
            filterOption={false}
          >
            {actualCommandsFiltered.map((option, index) => (
              <Select.Option key={`opt-${index}`} value={option.value}
                             commandType={option.commandType}
                             description={option.description}
                             _id={option._id}
                             label={option.label}>
                {option.label}
              </Select.Option>
            ))}
          </Select>
        </Tooltip>
        <Button
          type="primary"
          size="middle"
          loading={loading}
          onClick={handleSend}
          disabled={!canWork}
        >
          Send
        </Button>
        <Button size="middle" onClick={handleSave}>
          Save
        </Button>
        <OptionsPopup />
        <div className="spacer" />
        Server:
        <Badge
          className="connection-badge"
          status={connectionStatus}
          text={connectionStatusText}
        />
        <Button type="default" size="middle" onClick={handleClear}>
          Clear
        </Button>
      </div>

      <div className="playground-panel">
        <CodeMirror
          className="cm-outer-container"
          value={value}
          extensions={[json()]}
          onChange={onChange}
        />
      </div>
      <div className="cm-header">
        <h4>Results</h4>
        <Tooltip title={"JSON/Table view"}>
          <Switch
            checked={showTable}
            className="row-item-mar"
            onChange={handleShowTable}
          />
        </Tooltip>
        Show result:
        <Select
          value={historyMsgId}
          onChange={handleChangeHistoryMsgId}
          className="row-item"
        >
          {history.map((option, index) => (
            <Select.Option key={`hist-${index}`} value={option.value}>
              {option.label}
            </Select.Option>
          ))}
        </Select>
        <div className="spacer" />
        <Button type="default" size="middle" onClick={handleClearResult}>
          Clear
        </Button>
      </div>
      <div className="playground-panel2">
        {showTable ? (
          <>
            {resultJson
              .filter((j) => (historyMsgId ? j.msgId === historyMsgId : true))
              .map((r: any, ind: number) => (
                <JsonToTable key={`tbl-${modif}-${ind}`} json={r} />
              ))}
          </>
        ) : (
          <CodeMirror
            className="cm-outer-container"
            readOnly={true}
            value={
              historyMsgId
                ? JSON.stringify(
                    resultJson.find((j) => j.msgId === historyMsgId),
                    null,
                    2,
                  )
                : result
            }
            extensions={[json()]}
          />
        )}
      </div>
      {openUserCommand && commandOption && (
        <UserCommand
          open={openUserCommand}
          onClose={handleCloseUserCommand}
          value={value}
          commandOption={commandOption as Command}
          sendMsg={sendMsg}
        />
      )}
      {showHelpForm && (
        <Forms
          open={showHelpForm}
          onClose={handleHelpForm}
          value={value}
          label={commandLabel}
          sendMsg={sendMsg}
        />
      )}
      {/*  {showTestsForm &&   <Forms open={showTestsForm} onClose={h()=> setShowTestsForm(false)} sendMsg={sendMsg}/>} */}
    </div>
  );
};

export default memo(Console);
