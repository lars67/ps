import React, { useState, useEffect } from "react";
import { Select, SelectProps } from "antd";
import styled from "styled-components";
interface AnimatedSelectProps extends SelectProps {
  // Add any additional props you need
}

const AnimatedSelectWrapper = styled.div<{ showAnimation: boolean }>`
  ${(props) =>
    props.showAnimation &&
    `
    animation: select-background-animation 2.5s ease-in-out;
    @keyframes select-background-animation {
      0% {
        background-color: transparent;
      }
      50% {
        background-color: #f0f0f0;
      }
      100% {
        background-color: transparent;
      }
    }
  `}
`;

const AnimatedSelect: React.FC<AnimatedSelectProps> = (props) => {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    setShowAnimation(true);
  }, []);

  return (
    <AnimatedSelectWrapper showAnimation={showAnimation}>
      <Select {...props} />
    </AnimatedSelectWrapper>
  );
};

export default AnimatedSelect;
