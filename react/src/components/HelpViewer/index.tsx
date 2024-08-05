import axios from "axios";
import "./cm-viewer.css";
import "./style.css";
import React, { useContext, useEffect, useState } from "react";
import HoverHolder from "../HoverHolder";
import { useAppSelector } from "../../store/useAppSelector";
import HelpMenu from "../HelpMenu";
import DynamicIFrame from "./DynamicIFrame";
import IframeResizer from "iframe-resizer-react";
import styled from "styled-components";
import {CloseOutlined} from "@ant-design/icons";

const helpPath = process.env.REACT_APP_URL_DATA;

const CloseOutlinedStyled  = styled(CloseOutlined)`
  cursor: pointer;
  color: #f89a92;
  font-size: 24px;

  &:hover {
    color: red; // Change color on hover
  }

  position: fixed;
  top: 16px;
  right: 36px;
  z-index: 100000;
`;
const HTMLViewer = ({closeDrawer}:{closeDrawer:()=> void}) => {
  const [htmlContent, setHtmlContent] = useState("");
  const { helpPage } = useAppSelector((state) => state.help);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Check if the origin of the message is allowed
      // For security reasons, it's important to validate the event.origin
      // if your application expects messages from specific origins only

      // Check if the message is coming from the iframe
      // if (event.source === window.parent) {
      // Handle the incoming message
      //console.log("Message received:", event.data);
      //}
    };

    // Add event listener when component mounts
    window.addEventListener("message", handleMessage);

    return () => {
      // Clean up and remove event listener when component unmounts
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  /* useEffect(() => {
    const fetchHtmlContent = async () => {
      try {
        const response = await axios.get(
          `${helpPath}/help/${helpPage}/index.html`,
        );
        setHtmlContent(response.data);
      } catch (error) {
        console.error("Error fetching HTML content:", error);
      }
    };

    fetchHtmlContent();
  }, [helpPage]);*/
  const helpPagePrepared ='index.html';// `${helpPage.replace('home', '')}/index.html`;
  return (
    <>

        <iframe
          src={`${helpPath}/help/${helpPagePrepared}`}
          title="iframe"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            overflow: "auto",
          }}
        ></iframe>
        <CloseOutlinedStyled  onClick={closeDrawer} />
    </>
  );
};

export default HTMLViewer;
