import React, { ReactNode } from "react";

import { items } from "./menuItems";
import Link from "next/link";

import styles from "./Menu.module.css";

type withChildren = {
  children?: ReactNode;
};
const MenuContainer: React.FC<withChildren> = ({ children }) => (
  <ul className={styles.menuContainer}>{children}</ul>
);

const MenuItem: React.FC<withChildren> = ({ children }) => (
  <li className={styles.menuItem}>{children}</li>
);

const DropdownContainer: React.FC<withChildren> = ({ children }) => (
  <ul className={styles.dropdownContainer}>{children}</ul>
);

const DropdownItem: React.FC<withChildren> = ({ children }) => (
  <li className={styles.dropdownItem}>{children}</li>
);

const StyledA: React.FC<withChildren & { href: string }> = ({
  href,
  children,
}) => (
  <Link href={href} className={styles.styledA}>
    {children}
  </Link>
);

interface ChildItemProps {
  label: string;
  href?: string;
}

interface MenuItemProps {
  label: string;
  items?: ChildItemProps[];
  href?: string;
}

const DropdownItemComponent: React.FC<MenuItemProps> = ({ label, href }) => {

  return (
    <DropdownItem>
      {href ? <Link href={href}>{label}</Link> : label}
    </DropdownItem>
  );
};

const MenuItemComponent: React.FC<MenuItemProps> = ({ label, items, href }) => {
   return (
    <MenuItem>
      {href ? <StyledA href={`${href}`}>{label}</StyledA> : label}
      {items && (
        <DropdownContainer>
          {items.map((child) => (
            <DropdownItemComponent
              key={child.label}
              label={child.label}
              href={child.href}
            />
          ))}
        </DropdownContainer>
      )}
    </MenuItem>
  );
};

interface MenuProps {}

const HorizontalMenu: React.FC<MenuProps> = () => {
  return (
    <MenuContainer>
      {items.map((item) => (
        <MenuItemComponent
          key={item.label}
          label={item.label}
          href={item.href}
          items={item.items}
        />
      ))}
    </MenuContainer>
  );
};

export default HorizontalMenu;
