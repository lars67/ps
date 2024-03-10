import {memo, useCallback, useEffect, useMemo, useRef, useState} from "react";
import { Card, Loader, PageHeader } from "../../components";
import CountUp from "react-countup";
import {
  Alert, Badge,
  Button,
  Flex, message,
  Row, Select,
  Typography,
  Switch, Tooltip
} from "antd";
import useWebSocket, {ReadyState} from "react-use-websocket";
import {useAppSelector} from "../../store/useAppSelector";

import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import './style.css'
import {commandTypes} from "./helper";
import {Command} from "../../types/command";
import {JsonToTable} from "react-json-to-table";
import {LabelValue} from "../../types/LabelValue";
import UserCommand from "./UserCommand";
type WSMsg = {
  data: string,
  msgId?: string,
  total: string,
  index: number
}




const Console = () => {
  const [loading, setLoading]= useState(false);
  const token = useAppSelector((state) => state.user.token);
  const modif=useRef(Math.round(10000*Math.random()));
  const url = `${process.env.REACT_APP_WS}?${encodeURIComponent(token)}@${modif.current}`
  const fragments = useRef<string[]>([])
  const [newMsg, setNewMsg ] = useState('');
  const [result, setResult] = useState<string>('')
  const [actualCommands,setActualCommands] = useState<Command[]>([])
  const [commands,setCommands] = useState<Command[]>([])
  const [command,setCommand] = useState('')
  const [value, setValue] = useState("");
  const [commandTypeFilter, setCommandTypeFilter] = useState('')
  const [historyMsgId, setHistoryMsgId] = useState('')
  const needReconnect = useRef<boolean>(true);
  const msgId= useRef(0);
  const [openUserCommand, setOpenUserCommand] = useState(false)
  const onMessageCallback = (event: MessageEvent<string>) => {
    if (event.data !== 'undefined') {
      const message = JSON.parse(event.data) as WSMsg;

      const {data, msgId, total, index} = message;

      fragments.current[index] = data;
      if (fragments.current.length === Number(total)) {
        setLoading(false);
        const assembledMessage = fragments.current.join('');
        console.log('Received message:', assembledMessage);

        fragments.current = [];
        if (msgId === 'ws_commands') {
          setCommands(JSON.parse(assembledMessage).data)
          console.log('ws_commads')
          return;
        }
        setNewMsg(assembledMessage)

      }
    }
  };
  const { sendJsonMessage,  readyState, getWebSocket } = useWebSocket(url,
      {onMessage: onMessageCallback,
        retryOnError:true,
        shouldReconnect:  (event: WebSocketEventMap['close']) => {
          console.log('REEEEEEEEEEEEEEEEEEE22EEEEEEEEEECONNECT', needReconnect.current)
           return needReconnect.current
        },
        reconnectInterval: 5000,
        reconnectAttempts: 3});

  useEffect(() => {
    return () => {
      needReconnect.current = false;
      console.log('RECONNNECT TO FALS2222E')
    };
  }, []);

  useEffect(()=> {
    sendJsonMessage({command:'commands.list', msgId:'ws_commands'})
    msgId.current=0;
  }, [])

  const handleSend = useCallback(async ()=> {
    let parsedValue:any={};
    try {
      parsedValue = JSON.parse(value)
      if (!parsedValue.command) {
        message.open({
          type: 'error',
          content: 'command in message  is absent',
        });
        return;

      }
    } catch(err) {
      message.open({
        type: 'error',
        content: 'Command json is wrong',
      });
      return;
    }
      setLoading(true);
      fragments.current = [];
      setNewMsg('')
      msgId.current++;
      const cmd = {...parsedValue,msgId:msgId.current}
      sendJsonMessage(cmd)
     // const r = await sendJsonMessageSync({...cmd, msgId:msgId.current})



  }, [value])

  useEffect(() => {
    if (newMsg) {
      const s = JSON.stringify(JSON.parse(newMsg), null, 2)
        setResult(result=> result.concat(s+'\n\n'));

        setNewMsg('');
    }

  }, [newMsg]);





  const [connectionStatusText, connectionStatus]: [string, "processing" | "success" | "warning" | "default" | "error" | undefined] = useMemo(() => {
    const statusMap: { [key in ReadyState]?: [string, "processing" | "success" | "warning" | "default" | "error" | undefined] } = {
      [ReadyState.CONNECTING]: ['Connecting', 'processing'],
      [ReadyState.OPEN]: ['Open', 'success'],
      [ReadyState.CLOSING]: ['Closing', 'warning'],
      [ReadyState.CLOSED]: ['Closed', 'warning'],
      [ReadyState.UNINSTANTIATED]: ['Uninstantiated', 'warning']
    };
    return statusMap[readyState] || ['Unknown', undefined]; // Handle undefined case
  }, [readyState]);
  const canWork= connectionStatus === 'success'

  const onChange = useCallback((val:string) => {

    setValue(val);
  }, []);

  const handleClearResult = useCallback(()=> setResult(''), [])

  const handleClear = useCallback(()=> setValue(''), [])

  const handleChangeCommandType = useCallback((value:string)=> setCommandTypeFilter(value), [])
  const handleChangeCommand = useCallback((value:string)=> {
    setCommand(value)
    setValue(value);
  }, [])

  const [showTable, setShowTable] = useState(false);
  const handleShowTable= useCallback((b:boolean) => {
    setShowTable(b)
  }, [])

  useEffect(()=> {
    setActualCommands(commandTypeFilter ? commands.filter(c=> c.commandType === commandTypeFilter) : commands)
  }, [commandTypeFilter, commands])

  const [resultJson, history] = useMemo(()=> {
    if (result.length > 10) {
      try {
        const ar = result.split('\n\n').filter(s=>Boolean(s))
        const jsons: any[]=[];
        const history: LabelValue[] =[{label:'All',value:''}];
        ar.map(a => {
          const json = JSON.parse(a);
          jsons.push(json);
          history.push({label: json.command, value: json.msgId})
        })
        return [jsons, history]

      } catch (er) {
        console.log('ER', er)
      }
    }
    return [[],[]];
  }, [result]);

const handleChangeHistoryMsgId= useCallback((value:string) => {
  setHistoryMsgId(value)
}, [])


  async function sendJsonMessageSync(o: object ) {
     return new Promise((resolve, reject) => {
        const socket = getWebSocket();

       if (socket) {
         const handleMessage= (event: MessageEvent)  => {
           const response = event.data as string;
           resolve(JSON.parse(response));
           // @ts-ignore
           socket.removeEventListener('message', handleMessage); // Remove the event listener

         };

         // @ts-ignore
         socket.addEventListener('message', handleMessage);

         socket.onerror = (error: Event) => {
           reject(error);
         };
         sendJsonMessage(o)
       } else {
         reject({error: 'socket is closed'});
       }
      });
    }

  const sendMsg = useCallback(async (cmd: object ) => {
    fragments.current = [];
    msgId.current++;
    console.log('SendMSG', {...cmd, msgId:msgId.current})
    const r = await sendJsonMessageSync({...cmd, msgId:msgId.current})
    console.log('SYYYYYYYYYYYYYYNC', json);
    return r;
  }, []);

const handleSave = useCallback(async ()=> {
  let parsedValue:any={};
  try {
    parsedValue = JSON.parse(value)
    if (!parsedValue.command) {
      message.open({
        type: 'error',
        content: 'command is absent',
      });
      return;

    }
  } catch(err) {
    message.open({
      type: 'error',
      content: 'Command json is wrong',
    });
    return;
  }
  setOpenUserCommand(true);

}, [value])

  return (
      <div className="playground-container">
        <div className="cm-header">
          <h4>Commands:</h4>
          <Select
              value={commandTypeFilter}
              onChange={handleChangeCommandType}
              className="row-item"
              options={commandTypes}/>

          <Tooltip arrow title={"Commands group filter"}><Select
              value={command}
              onChange={handleChangeCommand}
              className="row-item"
              showSearch
              style={{ width: 200 }}
              placeholder="Search to Select"
              optionFilterProp="children"
              filterOption={(input, option) => (option?.label ?? '').includes(input)}
              filterSort={(optionA, optionB) =>
                  (optionA?.label ?? '').toLowerCase().localeCompare((optionB?.label ?? '').toLowerCase())
              }

              options={actualCommands}/></Tooltip>
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
               onClick={handleSave}

          >
            Save
          </Button>
          <div className="spacer" />
          Server:
          <Badge
              className="connection-badge"
              status={connectionStatus}
              text={connectionStatusText}
          />
          <Button
              type="default"
              size="middle"
              onClick={handleClear}
          >
            Clear
          </Button>
        </div>

        <div className="playground-panel">

          <CodeMirror
              className="cm-outer-container"
              value={value}  extensions={[json()]} onChange={onChange} />

        </div>
        <div className="cm-header">
          <h4>Results</h4>
          <Tooltip  title={'JSON/Table view'}>
          <Switch
              checked={showTable}
              className="row-item-mar"
              onChange={handleShowTable}
          /></Tooltip>
          Show result:
          <Select
              value={historyMsgId}
              onChange={handleChangeHistoryMsgId}
              className="row-item"
              options={history}/>
          <div className="spacer" />
          <Button
              type="default"
              size="middle"
              onClick={handleClearResult}
          >
            Clear
          </Button>
        </div>
        <div className="playground-panel2">

          {showTable ? <>{resultJson.filter(j=> historyMsgId ? j.msgId === historyMsgId : true).map((r: any, ind:number) => <JsonToTable key={`tbl-${ind}`} json={r}/>)}</> :
              <CodeMirror
              className="cm-outer-container"
              readOnly={true}
              value={historyMsgId ? JSON.stringify(resultJson.find(j=> j.msgId === historyMsgId), null, 2) :result}  extensions={[json()]}  />}

        </div>
        <UserCommand open={openUserCommand} onClose={()=> setOpenUserCommand(false)} value={value} sendMsg={sendMsg}/>

      </div>
  );


};

export default memo(Console);
