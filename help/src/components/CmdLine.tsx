export default function CmdLine({ cmd }: { cmd: string }) {
  return <div   className="cm-line" dangerouslySetInnerHTML={{ __html:  cmd  }} />;
}
