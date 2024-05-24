import React, {useState, useEffect, memo} from 'react';
import { Badge, BadgeProps } from 'antd';
import styled, { keyframes } from 'styled-components';

interface BlinkingBadgeProps extends BadgeProps {
    blink?: boolean;
}

interface StyledBadgeProps {
    blink: boolean;
    color?: string;
}

const BlinkAnimation = keyframes<StyledBadgeProps>`
  0% {
    transform: scale(1);
    background-color: ${({ color }) => color || '#52c41a'};
  }
  50% {
    transform: scale(1.2);
    background-color: ${({ color }) => color || '#52c41a'};
  }
  100% {
    transform: scale(1);
    background-color: ${({ color }) => color || '#52c41a'};
  }
`;

const StyledBadge = styled(Badge)<StyledBadgeProps>`
  .ant-badge-count {
    animation: ${({ blink }) => blink ? BlinkAnimation + ' 0.5s ease-in-out' : 'none'};
    background-color: ${({ color }) => color || '#52c41a'};
    color: #fff;
    padding: 0 6px;
    border-radius: 8px;
    font-size: 12px;
    line-height: 20px;
    min-width: 20px;
    height: 20px;
    display: inline-block;
  }
`;

const SubscriptionDataIndicator: React.FC<BlinkingBadgeProps> = ({ count, blink = false, ...props }) => {
    const [shouldBlink, setShouldBlink] = useState(blink);
    const [color, setColor] = useState<string>('#52c41a');

    useEffect(() => {
        if (blink) {
            setShouldBlink(true);
            const blinkTimer = setTimeout(() => {
                setShouldBlink(false);
            }, 500);

            return () => clearTimeout(blinkTimer);
        }
    }, [blink]);

    useEffect(() => {
        if (count !== 0) {
            setColor('#f5222d'); // red

        } else {
            setColor('#faad14'); // yellow
        }
    }, [count]);

    return (
        <StyledBadge count={count} blink={shouldBlink} color={color} {...props} />
    );
};


export default memo(SubscriptionDataIndicator)
