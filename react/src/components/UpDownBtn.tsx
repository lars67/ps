import { Button, ButtonProps, Tooltip } from "antd";
import { CaretDownOutlined, CaretUpOutlined } from "@ant-design/icons";
import {memo} from "react";

type Props = {
    downup: boolean[];
    btnIndex:number
} & ButtonProps;

const colorStyle = {color:'#888'}
const UpDownBtn = ({ downup, btnIndex, onClick, ...others }: Props) => {
    const down = btnIndex ===0 ? downup[1] ? true: false :
              downup[0] ? false: true

    return (
    <Tooltip title={'Resize pane'}>
      <Button
        icon={down ? <CaretDownOutlined /> : <CaretUpOutlined />}
        onClick={onClick}
        {...others}
        style={colorStyle}
      ></Button>
    </Tooltip>
  );
};

export default memo(UpDownBtn);
