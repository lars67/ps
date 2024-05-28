import {memo, useCallback, useEffect, useMemo, useRef, useState} from "react";

import {Button, message, Select, Switch, Tooltip,} from "antd";
import useWebSocket, {ReadyState} from "react-use-websocket";
import {useAppSelector} from "../../store/useAppSelector";

import CodeMirror, {EditorView,} from "@uiw/react-codemirror";
import {json} from "@codemirror/lang-json";
import "./style.css";
import {commandTypes} from "./helper";
import {Command} from "../../types/command";
import {JsonToTable} from "react-json-to-table";
import {LabelValue} from "../../types/LabelValue";
import UserCommand from "./UserCommand";
import Forms from "./forms";
import {historyCommands} from "./index";

import HistoryCommands from "../../components/HistoryCommands";
import OptionsPopup from "../../components/OptionsPopup";
import ButtonRemoveUserCommand from "../../components/ButtonRemoveUserCommand";
import CommandBar from "../../components/CommandBar";
import WindowExtend from "../../components/WindowExtend";
import themeCodeMirror from "./themeCodeMirror";
import UpDownBtn from "../../components/UpDownBtn";
import {processTestCommand, testCommands} from "../../testCommands";
import TestResults, {TestItem} from "../../components/TestResults";
import {getCommands, preprocessCommand} from "../../utils/command";
import {WSMsg} from "../../types/other";
import SocketConnectionIndicator from "../../SocketConnectionIndicator";


const Console = ({ tabIndex }: { tabIndex: number }) => {
  const [loading, setLoading] = useState(false);
  const {userId, token} = useAppSelector((state) => state.user);
  const modif = useRef(Math.round(100000 * Math.random()));
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
  const { clearAlwaysResult, clearAlwaysCommand } = useAppSelector(
    (state) => state.options,
  );
  const [commandOption, setCommandOption] = useState<Command | Command[]>();
  const [commandBar, setCommandBar] = useState<Command>();
  const [showWindow, setShowWindow] = useState(false);
  const [displayPanes, setDisplayPanes] = useState<boolean[]>([true, true]);
  const editorRef = useRef<EditorView | null>(null);

  const variables = useRef<Record<string, any>>({});
  const ncom = useRef<number>(1);
  const [testResultPopup, setTestResultPopup] = useState<TestItem[] | null>(
    null,
  );
  const testObservers = useRef<Record<string, (value: string) => void>>(
    {} as Record<string, (value: string) => void>,
  );
  const [shouldConnect, setShouldConnect] = useState(true);
  //const [shouldReconnect, setShouldReconnect] = useState(false);
  const onMessageCallback = (event: MessageEvent<string>) => {
    if (event.data !== "undefined") {
      const message = JSON.parse(event.data) as WSMsg;

      const { data, msgId = "", total, index } = message;
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
        if (msgId === "ws_commands") {
          const commands = JSON.parse(assembledMessage).data;

          setCommands([...commands, ...testCommands]);

          console.log("ws_commads");
          return;
        }
        const s = JSON.stringify(JSON.parse(assembledMessage), null, 2);
        !variables.current?._mode?.hide &&
          setResult((result) => result.concat(s + "\n\n"));
        console.log(
          "OOOOOOOOOOOOOOOO",
          msgId,
          "observer",
          testObservers.current[msgId],
          "num",
          Object.keys(testObservers.current),
        );
        if (Boolean(testObservers.current[msgId]))
          testObservers.current[msgId](assembledMessage);
      }
      console.log("/onMessage");
    }
  };

  const { sendJsonMessage, readyState, getWebSocket} = useWebSocket(url, {
    onMessage: onMessageCallback,
   // shouldReconnect: (closeEvent) => shouldReconnect,

  })//,  shouldConnect);

  useEffect(() => {
    return () => {
      setShouldConnect(false);
      //needReconnect.current = false;
      //console.log("RECONNNECT TO FALS2222E");
    };
  }, []);

  useEffect(() => {
    sendJsonMessage({ command: "commands.list", msgId: "ws_commands" });
    msgId.current = 0;
  }, []);

  const handleSend = useCallback(async () => {
    let parsedValue: any = {};
    let answer;
    const testResults: TestItem[] = [];
    variables.current = {};
    try {
      const commands = getCommands(value, false);
      // console.log("VVV", value);
      if (commands.length <= 0) {
        message.open({
          type: "error",
          content: "Command json is wrong!!!!!",
        });
        return;
      }
      setLoading(true);
      console.log("commands.length=", commands.length);

      let ipr = 0;
      for (const notparsedValue of commands) {
        //
        const com: string = JSON.parse(notparsedValue).command;
        const preprocessed = preprocessCommand(notparsedValue, variables.current);
        console.log('consoleTAB preprocessed', preprocessed);
        const parsedValue = JSON.parse(
          preprocessed,
        );
        console.log(
          `---------------------${notparsedValue}-------------------------\n`,
          new Date().toISOString(),
          "ipr=",
          ++ipr,
          " commands.length=",
          commands.length,
        );

        if (parsedValue.command.startsWith("tests.")) {
          const resp = await processTestCommand(
            variables.current,
            parsedValue,
            (newVariables: Record<string, any>) => {
              Object.keys(newVariables).forEach(
                (p: string) => (variables.current[p] = newVariables[p]),
              );
            },
            {
              deleteTestObserver: (key: string) => {
                console.log("deleteTestObserver", key);
                delete testObservers.current[key];
              },
              setTestObserver: (
                msgId: string,
                observer: (data: string) => void,
              ) => {
                console.log("setTestObserver", msgId);
                testObservers.current[msgId] = observer;
              },
            },
            //testObservers:testObservers.current}
          );
          if (resp) {
            setResult((result) =>
              result.concat(JSON.stringify(resp, null, 2) + "\n\n"),
            );
            if (parsedValue.error) {
              setLoading(false);
              break;
            }

            if (parsedValue.command === "tests.check" || parsedValue.command === "tests.text") {
              testResults.push({
                description: parsedValue.description || parsedValue.label || resp.data,
                result: resp.data ,
              });
            }
            if ((resp.data as string) === "break") {
              setLoading(false);
              break;
            }
          }
        } else {
          //fragments.current = [];

          const useMsgId = parsedValue.msgId
            ? parsedValue.msgId
            : ++msgId.current;
          const cmd = { ...parsedValue, msgId: useMsgId };

          if (clearAlwaysResult) {
            setResult("");
          }
          const answer: string = (await sendJsonMessageSync(cmd)) as string;
          const parsedAnswer = JSON.parse(answer);
          if (parsedValue._as) {
            variables.current[parsedValue._as] = parsedAnswer.data || {
              error: parsedAnswer.error,
            };
          }
        }
      }
      setLoading(false);
      if (testResults.length > 0) setTestResultPopup(testResults);
      historyCommands.unshift({
        value,
        label: commandLabel || `Command #${tabIndex}-${ncom.current++}`,
      });
      if (historyCommands.length > 12) {
        historyCommands.pop();
      }
      setHistoryMsgId("");
    } catch (err) {
      console.log(err);
      message.open({
        type: "error",
        content: "Command json is wrong",
      });
      setLoading(false);
      return;
    }
  }, [value, commandLabel, clearAlwaysResult, setHistoryMsgId]);


  const canWork = readyState===ReadyState.OPEN && value !== "";

  const onChange = useCallback((val: string) => {
    setValue(val);
  }, []);

  const handleClearResult = useCallback(() => setResult(""), []);

  const handleClear = useCallback(() => setValue(""), []);

  const handleChangeCommandType = useCallback(
    (value: string) => {
      setCommandTypeFilter(value);
      setCommand("");
      clearAlwaysCommand && setValue("");
      setCommandOption(undefined);
    },
    [clearAlwaysCommand],
  );
  const handleChangeCommand = useCallback(
    (value: string, option: Command | Command[]) => {
      setCommand(value);
      setValue((oldValue) =>
        clearAlwaysCommand ? value : oldValue + "\n" + value,
      );
      setCommandOption(option);
      setCommandLabel((option as Command).label || "");
      //setShowHelpForm(true);
      if ((option as Command).extended) {
        setCommandBar(option as Command);
      }
    },
    [actualCommands, clearAlwaysCommand],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      //  console.log("Message received:", event);
      setValue((oldValue) => oldValue + "\n" + value);
      // alert(event.data)
    };

    // Add event listener when component mounts
    ///???? window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);
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
          /* console.log(
            ">>>>>>>>>",
            msgId,
            total,
            index,
            fragmentsMsg.current[msgId].length,
          );*/
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
    //console.log("SendMSG", { ...cmd, msgId: msgId.current });
    try {
      const r = await sendJsonMessageSync({ ...cmd, msgId: msgId.current });
      //console.log("SYYYYYYYYYYYYYYNC", r);
      return r;
    } catch (er) {
      console.log("SendMsg error", er);
    }
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

  const handleCloseUserCommand = useCallback(
    (cmd: Command | undefined, isAdd?: boolean) => {
      if (cmd) {
        if (isAdd) {
          // cmd.value= JSON.parse(cmd.value ?? '');
          setCommands((commands) => [...commands, cmd]);
        } else {
          const trg = commands.find((c) => c._id === cmd._id);
          console.log(cmd, trg);
          setCommands((commands) =>
            commands.map((c) => (c._id === cmd._id ? cmd : c)),
          );
        }
        //   setValueCommands((commands) => [...commands, c]);
      }
      setOpenUserCommand(false);
    },
    [commands],
  );

  const handleRemove = useCallback(
    async (cmd: Command) => {
      setCommands((commands) => commands.filter((c) => c._id !== cmd._id));
      const rez = await sendMsg({ command: "commands.remove", _id: cmd._id });
      setCommand("");
      setValue("");
      setCommandOption(undefined);
    },
    [commands],
  );

  const handleGetFromHistory = useCallback(
    ({ value = "", label = "" }: LabelValue) => {
      setValue(value);
      setCommandLabel(label);
    },
    [setValue],
  );

  /*
    ref={resultPaneScroll}
  const resultPaneScroll = useCallback((editor: ReactCodeMirrorRef) => {
    if (!editor || !editor.state?.doc) {
      console.log(`scrollDocToView return`)
      return
    }

    const lastLine = editor.state.doc.lines;
    const lastLineLength = editor.state.doc.line(lastLine).length;

    editor!!.view?.dispatch({
      selection: { anchor: editor.state.doc.line(lastLine).to },
      scrollIntoView: true,
    });

    editor!!.view?.focus();
    // ... calc selection


  }, [])*/

  const handleUpDown0 = useCallback(() => {
    if (displayPanes[0] && displayPanes[1]) {
      setDisplayPanes([true, false]);
    } else {
      setDisplayPanes([true, true]);
    }
  }, [displayPanes]);

  const handleUpDown1 = useCallback(() => {
    if (displayPanes[0] && displayPanes[1]) {
      setDisplayPanes([false, true]);
    } else {
      setDisplayPanes([true, true]);
    }
  }, [displayPanes]);

  const getCodeMirrorStyles = () => {
    const codeMirrorStyles = Array.from(document.styleSheets).reduce(
      (styles, styleSheet) => {
        if (styleSheet.href && styleSheet.href.includes("codemirror")) {
          const rules = Array.from(styleSheet.cssRules || []);
          rules.forEach((rule) => (styles += rule.cssText));
        }
        return styles;
      },
      "",
    );

    return codeMirrorStyles;
  };

  const getStyledHTML = (): string => {
    if (editorRef.current) {
      //const styledHTML = editorRef.current.state.doc.toString();
      const styledHTML = `
        <html>
          <head>
            <style>
              ${getCodeMirrorStyles()}
            </style>
          </head>
          <body>
            ${editorRef.current.dom.innerHTML}
          </body>
        </html>
      `;
      return styledHTML;
    }
    return "";
  };

  const saveStyledHTML = () => {
    const styledHTML = getStyledHTML();
    const blob = new Blob([styledHTML], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "styled-content.html";
    link.click();
    URL.revokeObjectURL(url);
  };


  const notOwnerCommand = (commandOption as Command)?.commandType === 'user' ?
      userId!=(commandOption as Command)?.ownerId : false
  return (
    <div className="playground-container">
      {displayPanes[0] && (
        <>
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
                 placeholder="Search to Select"
                optionFilterProp="label"
                filterOption={false}
              >
                {actualCommandsFiltered.map((option, index) => (
                  <Select.Option
                    key={`opt-${index}`}
                    value={option.value}
                    commandType={option.commandType}
                    description={option.description}
                    extended={option.extended}
                    _id={option._id}
                    label={option.label}
                    ownerId={option.ownerId}
                  >
                    <Tooltip title={option.description}>{userId === option.ownerId ? (<b>{option.label}</b>) : option.label}</Tooltip>
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
            <Button
              size="middle"
              disabled={!canWork || notOwnerCommand}
              onClick={handleSave}
              className="button-margin"
            >
              Save
            </Button>
            <ButtonRemoveUserCommand
              commandOption={commandOption as Command}
              onRemove={handleRemove}
              disabled={notOwnerCommand}
            />
            <OptionsPopup />
            <UpDownBtn
              downup={displayPanes}
              btnIndex={0}
              onClick={handleUpDown0}
            />
            {commandBar && <CommandBar commandbar={commandBar} />}

            <div className="spacer" />
           <SocketConnectionIndicator readyState={readyState}/>
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
              theme={themeCodeMirror}
              ref={(instance) => {
                if (instance?.view) {
                  editorRef.current = instance.view;
                }
              }}
            />
          </div>
        </>
      )}
      {displayPanes[1] && (
        <>
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
            <UpDownBtn
              downup={displayPanes}
              btnIndex={1}
              onClick={handleUpDown1}
            />
            <div className="spacer" />
            <Button type="default" size="middle" onClick={handleClearResult}>
              Clear
            </Button>
          </div>
          <div className="playground-panel2">
            {showTable ? (
              <>
                {resultJson
                  .filter((j) =>
                    historyMsgId ? j.msgId === historyMsgId : true,
                  )
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
                theme={themeCodeMirror}
              />
            )}
          </div>
        </>
      )}
      {openUserCommand && (
        <UserCommand
          open={openUserCommand}
          onClose={handleCloseUserCommand}
          value={value}
          commandOption={commandOption as Command}
          sendMsg={sendMsg}
        />
      )}
      {testResultPopup && (
        <TestResults
          items={testResultPopup}
          open={Boolean(testResultPopup)}
          onClose={() => setTestResultPopup(null)}
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
      {showWindow && (
        <WindowExtend
          visible={showWindow}
          title={"aaa"}
          onClose={() => setShowWindow(false)}
        >
          <h3>HI</h3>
        </WindowExtend>
      )}
      {/*  {showTestsForm &&   <Forms open={showTestsForm} onClose={h()=> setShowTestsForm(false)} sendMsg={sendMsg}/>} */}
    </div>
  );
};

export default memo(Console);
