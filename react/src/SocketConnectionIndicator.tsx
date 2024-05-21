import {Badge, Tooltip} from "antd";
import {useCallback, useMemo} from "react";
import {ReadyState} from "react-use-websocket";

const SocketConnectionIndicator = ({readyState}:{readyState:ReadyState}) => {

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
    const handleBadgeClick = useCallback(
        (event: React.MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            if (connectionStatusText === "Open") {

                //disconnect()
            } else if (connectionStatusText === "Closed") {
                // reconnect()
                // reconnect()Remove
            }
        },
        [connectionStatusText],
    );
    return (<Tooltip title={connectionStatusText}>
        <>
            Server:
            <a href="#" onClick={handleBadgeClick}>
                <Badge
                    className="connection-badge"
                    status={connectionStatus}
                    text={""}
                />
            </a>
        </>
    </Tooltip>)
}

export default SocketConnectionIndicator
