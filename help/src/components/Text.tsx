export default function Text({
  html,
}: {
  html: string;
}) {
  return (
        <div dangerouslySetInnerHTML={{ __html:  html  }} />
  );
}
