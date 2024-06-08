import {
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Flex,
  FloatButton,
  Input,
  Layout,
  MenuProps,
  message,
  theme,
  Tooltip,
} from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { ReactNode, useEffect, useRef, useState } from "react";
import {
  AppstoreOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  QuestionOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  CSSTransition,
  SwitchTransition,
  TransitionGroup,
} from "react-transition-group";
import { useMediaQuery } from "react-responsive";
import SideNav from "./SideNav";
import HeaderNav from "./HeaderNav";
import FooterNav from "./FooterNav";
import { Nprogress } from "../../components/Nprogress";

import HelpViewer from "../../components/HelpViewer";
import { PATH_LOGIN, PATH_PORTFOLIO } from "../../constants/routes";
import { useAppSelector } from "../../store/useAppSelector";
import styled from "styled-components";

const { Content } = Layout;

const NameHolder = styled.span`
  margin: 0 4px 0 16px;
  text-transform: uppercase;
`
type AppLayoutProps = {
  children: ReactNode;
};

const AppLayout = ({ children }: AppLayoutProps) => {
  const {
    token: { borderRadius },
  } = theme.useToken();
  const isMobile = useMediaQuery({ maxWidth: 769 });
  const [collapsed, setCollapsed] = useState(true);
  const [navFill, setNavFill] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const nodeRef = useRef(null);
  const floatBtnRef = useRef(null);
  const user = useAppSelector((state) => state.user);
  const items: MenuProps["items"] = [
    {
      key: "user-profile-link",
      label: "profile",
      icon: <UserOutlined />,
    },
    {
      key: "user-settings-link",
      label: "settings",
      icon: <SettingOutlined />,
    },
    /* {
      key: "user-help-link",
      label: "help center",
      icon: <QuestionOutlined />,
    },*/
    {
      type: "divider",
    },
    {
      key: "user-logout-link",
      label: "logout",
      icon: <LogoutOutlined />,
      danger: true,
      onClick: () => {
        message.open({
          type: "loading",
          content: "signing you out",
        });

        setTimeout(() => {
          navigate(PATH_LOGIN);
        }, 1000);
      },
    },
  ];

  useEffect(() => {
    setCollapsed(isMobile);
  }, [isMobile]);

  useEffect(() => {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 5) {
        setNavFill(true);
      } else {
        setNavFill(false);
      }
    });
  }, []);

  const [drawerVisible, setDrawerVisible] = useState(false);

  const showDrawer = () => {
    setDrawerVisible(true);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
  };

  return (
    <>
      <Nprogress isAnimating={isLoading} key={location.key} />
      <Layout
        style={{
          minHeight: "100vh",
          backgroundColor: "rgba(52, 152, 219, 0.1)",
          backgroundImage:
            "radial-gradient(at 47% 33%, hsl(197.95, 0%, 100%) 0, transparent 59%),\n" +
            "radial-gradient(at 82% 65%, hsl(204.07, 70%, 75%) 0, transparent 55%)",
        }}
      >
        <SideNav
          trigger={null}
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
          style={{
            overflow: "auto",
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            background: "none",
            border: "none",
            transition: "all .2s",
          }}
        />

        <Drawer
          size={"large"}
          title="Help"
          placement="right"
          closable={true}
          onClose={closeDrawer}
          mask={false}
          open={drawerVisible} // Use 'open' instead of 'visible'
          style={{ overflow: "hidden", padding: "4px" }}
          bodyStyle={{ padding: "0px" }}
          headerStyle={{ backgroundColor: "#DFD" }}
        >
          <HelpViewer />
        </Drawer>

        <Layout
          style={{
            background: "none",
          }}
        >
          <HeaderNav
            style={{
              marginLeft: 0, // collapsed ? 0 : '200px',
              padding: "0 12px 0 0",
              background: navFill ? "#0af5fc" : "none",
              backdropFilter: navFill ? "blur(8px)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              position: "sticky",
              top: 0,
              zIndex: 1,
              gap: 8,
              flexDirection: "row-reverse",
              transition: "all .25s",
            }}
          >
            <Flex align={'center'} >
                <Button type="link" onClick={showDrawer}>
                    Help
                </Button>
                <NameHolder>{user.name}</NameHolder>
                <Dropdown menu={{ items }} trigger={["click"]}>
                <Flex>
                  <Tooltip title={user.name}>
                    <Avatar
                      style={{ color: "#eff3fc", backgroundColor: "#112e96" }}
                    >
                      {user.name.toUpperCase().substring(0, 2)}
                    </Avatar>
                  </Tooltip>
                </Flex>
              </Dropdown>

            </Flex>


            {/*     <Flex align="center">
              <Tooltip title={`${collapsed ? 'Expand' : 'Collapse'} Sidebar`}>
                <Button
                  type="text"
                  icon={
                    collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
                  }
                  onClick={() => setCollapsed(!collapsed)}
                  style={{
                    fontSize: '16px',
                    width: 64,
                    height: 64,
                  }}
                />
              </Tooltip>
              <Input.Search
                placeholder="search"
                style={{
                  width: isMobile ? '100%' : '400px',
                  marginLeft: isMobile ? 0 : '.5rem',
                }}
                size="middle"
              />
            </Flex>
            <Flex align="center" gap="small">
              <Tooltip title="Apps">
                <Button icon={<AppstoreOutlined />} type="text" size="large" />
              </Tooltip>
              <Tooltip title="Messages">
                <Button icon={<MessageOutlined />} type="text" size="large" />
              </Tooltip>*/}
          </HeaderNav>
          <Content
            style={{
              margin: `0 0 0 0`, //${collapsed ? 0 : '200px'}`,
              background: "rgba(52, 152, 219, 0.35)",
              borderRadius: collapsed ? 0 : borderRadius,
              transition: "all .25s",
              padding: "4px",
              minHeight: 360,
            }}
          >
            <TransitionGroup>
              <SwitchTransition>
                <CSSTransition
                  key={`css-transition-${location.key}`}
                  nodeRef={nodeRef}
                  onEnter={() => {
                    setIsLoading(true);
                  }}
                  onEntered={() => {
                    setIsLoading(false);
                  }}
                  timeout={300}
                  classNames="bottom-to-top"
                  unmountOnExit
                >
                  {() => (
                    <div ref={nodeRef} style={{ background: "none" }}>
                      {children}
                    </div>
                  )}
                </CSSTransition>
              </SwitchTransition>
            </TransitionGroup>
            {/*<div ref={floatBtnRef}>
              <FloatButton.BackTop />
            </div>*/}
          </Content>
          <FooterNav
            style={{
              textAlign: "center",
              marginLeft: 0, //collapsed ? 0 : '200px',
              background: "none",
            }}
          />
        </Layout>
      </Layout>
    </>
  );
};

export default AppLayout;
