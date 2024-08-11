import ClientOnly from "@/components/ClientOnly";

import Header from "@/components/Header";
import Head from "next/head";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>


          <style>
          {`
            #app-body {
              display: none;
              width: 100%;
              padding: 4px;
            }

            #app-body.loaded {
              display: block;
            }
           
      .app-spinner {
      width: 50px;
      aspect-ratio: 1;
      border-radius: 50%;
      border: 8px solid;
      border-color: #000 #0000;
      animation: spin 1s infinite;
    }

      @keyframes spin {
      to {
      transform: rotate(0.5turn);
      }
      }
    

          `}
        </style>
        <link
          rel="stylesheet"
          href={`${process.env.BASE_PATH}/styles/style.css`}
        />
        <link
          rel="stylesheet"
          href={`${process.env.BASE_PATH}/styles/cm-viewer.css`}
        />
          <base href={`${process.env.BASE_URL}`} />
      </head>
      <body>
        <div id="app-body">
          <Header />
          <div id="page-content">
          {children}
          </div>
        </div>
        <ClientOnly />
      </body>
    </html>
  );
}
