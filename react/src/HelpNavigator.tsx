import React, { useState } from 'react';
import 'style.css'
import {Button, Menu} from "antd";
import { MenuOutlined } from '@ant-design/icons';
const HelpNavigator: React.FC = () => {
    const [menuOpen, setMenuOpen] = useState<boolean>(false);

    const toggleMenu = (): void => {
        setMenuOpen(!menuOpen);
    };

    return (
        <div className="floating-menu">
            <Button onClick={toggleMenu} icon={<MenuOutlined />}/>
            {menuOpen && (
                <div className="menu-content">
                    {/* Scrollable menu content here */}
                    <Menu>
                        <Menu.Item key="1">Menu Item 1</Menu.Item>
                        <Menu.Item key="2">Menu Item 2</Menu.Item>
                        <Menu.Item key="3">Menu Item 3</Menu.Item>
                        <Menu.Item key="4">Menu Item 4</Menu.Item>
                        <Menu.Item key="5">Menu Item 5</Menu.Item>
                    </Menu>
                </div>
            )}
        </div>
    );
};

export default HelpNavigator;
