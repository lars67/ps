import { Layout } from "antd";
import React, { useRef } from "react";

const { Header } = Layout;

type HeaderNavProps = {
  navFill?: boolean;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

const HeaderNav = ({ navFill, children, ...others }: HeaderNavProps) => {
  const nodeRef = useRef(null);
  return (
    <Header ref={nodeRef} {...others}>
      {children}
    </Header>
  );
};

export default HeaderNav;
