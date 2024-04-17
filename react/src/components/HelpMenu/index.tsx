import React, { useState } from "react";
import "./style.css";
import {Button, Dropdown, Menu, MenuProps} from "antd";
import { MenuOutlined } from "@ant-design/icons";
import {useAppDispatch} from "../../store/useAppDispatch";
import {helpSlice} from "../../store/slices/help";

const menu = [
  { label: "Home", key: "home"  },

  { label: "Test Commands", key: 'commands/tests' },
  {
    label: "Commands",
    key: "m_commands",
    children: [
      { label: "Portfolios", key: "commands/portfolios" },
      { label: "Trades", key: "commands/trades" },
    ],
  },
];

const HelpMenu: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const dispatch = useAppDispatch();
  const toggleMenu = (): void => {
    setMenuOpen(!menuOpen);
  };

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    dispatch(helpSlice.actions.changeHelpPage({helpPage:e.key}));
    setMenuOpen(false)
  };

  return (
    <div className="floating-menu">
      <Menu onClick={handleMenuClick}  mode="horizontal" items={menu} style={{ backgroundColor: 'rgba(255, 255, 255, 0' }}/>
    </div>
  );
};

export default HelpMenu;
