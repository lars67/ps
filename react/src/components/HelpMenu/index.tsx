import React, { useState } from "react";
import "./style.css";
import {Button, Dropdown, Menu, MenuProps} from "antd";
import { MenuOutlined } from "@ant-design/icons";
import {useAppDispatch} from "../../store/useAppDispatch";
import {helpSlice} from "../../store/slices/help";
import styled from "styled-components";
import { CloseOutlined } from '@ant-design/icons'

const menu = [
  { label: "Home", key: "home"  },


  {
    label: "Commands",
    key: "m_commands",
    children: [
      { label: "Portfolios", key: "commands/portfolios" },
      { label: "Trades", key: "commands/trades" },
      { label: "Tools", key: "commands/tools" },
    ],
  },
  { label: "Test Commands", key: 'commands/tests' },
  { label: "Operations", key: 'operations' },

];

const CloseOutlinedStyled  = styled(CloseOutlined)`
    cursor: pointer;
    color: black;
    font-size: 24px;
    
    &:hover {
        color: red; // Change color on hover
    }
  position: fixed;
  top: 0;
  right:0;
  z-index: 100000;
`;

const HelpMenu: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const dispatch = useAppDispatch();
  const toggleMenu = (): void => {
    setMenuOpen(!menuOpen);
  };

  const handleMenuClick = () => {
    //dispatch(helpSlice.actions.changeHelpPage({helpPage:'main'}));
    //setMenuOpen(false)
  };

  /*return (
    <div className="floating-menu">
      <Menu onClick={handleMenuClick}  mode="horizontal" items={menu} style={{ backgroundColor: 'rgba(255, 255, 255, 0' }}/>
    </div>
  );*/
  return        <CloseOutlinedStyled  onClick={handleMenuClick} />

};

export default HelpMenu;
