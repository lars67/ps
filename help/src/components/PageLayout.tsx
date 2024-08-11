import { Layout, Menu } from "antd";
import Link from "next/link";
import "antd/dist/reset.css";

import { Header, Content } from "antd/lib/layout/layout";

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function PageLayout({ children }: RootLayoutProps) {
  return <>{children}</>;
}
