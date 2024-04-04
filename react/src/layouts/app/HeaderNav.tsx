import {Button, Layout} from 'antd';
import React, { useRef } from 'react';
import {PATH_TEST} from "../../constants";
import {useNavigate} from "react-router-dom";

const { Header } = Layout;

type HeaderNavProps = {
  navFill?: boolean;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

const HeaderNav = ({ navFill, children, ...others}: HeaderNavProps) => {
  const nodeRef = useRef(null);
  const navigate = useNavigate()

  return <Header ref={nodeRef} {...others} > <Button style={{display:'none'}} onClick={()=>     navigate(PATH_TEST)}>Back</Button>{children}</Header>;
};

export default HeaderNav;
