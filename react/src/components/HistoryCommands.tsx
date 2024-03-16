import { Popover } from "antd";
import { historyCommands } from "../pages/console";
import { useState } from "react";
import { LabelValue } from "../types/LabelValue";

type Props = {
  onGetFromHistory: (lv: LabelValue) => void;
};

const HistoryCommands = ({ onGetFromHistory }: Props) => {
  const [visibleHistoryCommand, setVisibleHistoryCommand] = useState(false);
  const handleVisibleChange = (visible: boolean) => {
    setVisibleHistoryCommand(visible);
  };
  const handleClick = (lv: LabelValue) => {
    setVisibleHistoryCommand(false);
    onGetFromHistory(lv);
  };
  return (
    <Popover
      content={
        <div>
          <ul>
            {historyCommands.map((c, index) => (
              <li key={index} onClick={() => handleClick(c)}>
                {c.label}
              </li>
            ))}
          </ul>
        </div>
      }
      title="Command history"
      trigger="hover"
      open={visibleHistoryCommand}
      onOpenChange={handleVisibleChange}
    >
      <h4>Commands:</h4>
    </Popover>
  );
};

export default HistoryCommands;
