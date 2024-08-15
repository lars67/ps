type RowItems = string | React.FC;
type TableProps = {
  columns: React.ReactNode[];
  rows: React.ReactNode[][];
};

export default function Table({ columns, rows }: TableProps) {
  const rnd = Date.now();
  return (
    <table>
        <thead><tr>
      {columns.map((c, i) => (
        <th key={`${rnd}-h-${i}`}>{c}</th>
      ))}
        </tr></thead>
        <tbody>
      {rows.map((row, i) => (

        <tr key={`${rnd}-${i}`}>
          {row.map((c, j) => (
            <td key={`${rnd}-${i}-${j}`}>{c}</td>
          ))}
        </tr>
      ))}
      </tbody>
    </table>
  );
}
