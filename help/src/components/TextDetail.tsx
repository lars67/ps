export default function TextDetail({
  summary,
  detail,
}: {
  summary: string;
  detail: string;
}) {
  return (
    <details>
      <summary>{summary}</summary>
      <pre>
        <div dangerouslySetInnerHTML={{ __html:  detail  }} />
      </pre>
    </details>
  );
}
