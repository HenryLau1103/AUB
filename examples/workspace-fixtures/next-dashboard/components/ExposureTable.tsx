interface ExposureTableProps {
  title: string;
  rows: Array<{ name: string; owner: string; exposure: string }>;
}

export function ExposureTable({ title, rows }: ExposureTableProps) {
  return (
    <section className="exposure-table-card">
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Owner</th>
            <th>Exposure</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.owner}</td>
              <td>{row.exposure}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
