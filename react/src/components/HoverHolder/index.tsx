import React, {ReactNode, useState} from 'react';
import { Button } from 'antd';
import './style.css';

interface Props {
    children: ReactNode;
}
const HoverHolder = ({ children }:Props) => {
    const [isHovered, setIsHovered] = useState<boolean>(false);

    return (
        <div
            className={isHovered ? 'hovered' : ''}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {children}
            {isHovered && (
                <div className="hover-icons">
                    <Button icon="edit" />
                    <Button icon="delete" />
                    {/* Add more buttons for additional actions */}
                </div>
            )}
        </div>
    );
};

export default HoverHolder;
