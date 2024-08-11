"use client"
import HorizontalMenu from "@/components/HorizontalMenu";
import styled from "styled-components";
const Wrapper = styled.div`
  position: fixed;
  top:0px;
  width: 100%;

`
const Header = ({}) => {
    return (<Wrapper><HorizontalMenu/></Wrapper>)
}
export default Header;
