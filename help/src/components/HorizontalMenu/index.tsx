"use client";

import React, { useState } from "react";
import styled from "styled-components";
import { items } from "./menuItems";
import Link from "next/link";

const MenuContainer = styled.ul`
  list-style: none;
  display: flex;
  background-color: var(--menu-bkg);
  color: var(--menu-color);
  padding: 1px 0;
  width: 100%;
`;

const MenuItem = styled.li`
  position: relative;
  cursor: pointer;
  padding: 10px;


  &:hover {
    background-color: var(--menu-color);
    color: var(--menu-bkg);
  }
`;

const DropdownContainer = styled.ul`
  list-style: none;
  position: absolute;
  top: 100%;
  left: 0;
  background-color: var(--menu-color);
  color: var(--menu-bkg);
  padding: 10px 0;
  display: none;

  ${MenuItem}:hover & {
    display: block;
  }
`;

const DropdownItem = styled.li`
  padding: 10px;
  white-space: nowrap;
  overflow: hidden; /* Hides overflow text */
  text-overflow: ellipsis;
  &:hover {
    background-color: #e9ecef;
  }
`;

const StyledA= styled(Link)`
  color: var(--menu-color);

  ${MenuItem}:hover & {
    color: var(--menu-bkg);
  }
`

interface ChildItemProps {
  label: string;
  href?: string;
}

interface MenuItemProps {
  label: string;
  items?: ChildItemProps[];
  href?: string;
}

const DropdownItemComponent: React.FC<MenuItemProps> = ({
                                                          label,
                                                          href,
                                                        }) => {
  const href2 =  process.env.NODE_ENV === 'production' ? `${href}.html` : href as string;

  return (
      <DropdownItem>{href ? <Link href={href2}>{label}</Link> : label}</DropdownItem>
  );
};

const MenuItemComponent: React.FC<MenuItemProps> = ({
  label,
  items,
  href,
}) => {

  const ext =  process.env.NODE_ENV === 'production' ? '.html' : '';
  return (
    <MenuItem>
      {href ? <StyledA href={`${href}${ext}`}>{label}</StyledA> : label}
      {items && <DropdownContainer>

        { items.map((child) => (
                <DropdownItemComponent
                    key={child.label}
                    label={child.label}
                    href={child.href}
                />
            ))}
      </DropdownContainer>}
    </MenuItem>
  );
};


interface MenuProps {

}

const HorizontalMenu: React.FC<MenuProps> = () => {
  return (
    <MenuContainer>
      {items.map((item) => (
        <MenuItemComponent key={item.label} label={item.label} href={item.href} items={item.items}/>

      ))}
    </MenuContainer>
  );
};

export default HorizontalMenu;
