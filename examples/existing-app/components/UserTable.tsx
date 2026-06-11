interface UserTableProps {
  title: string;
  users: Array<{
    name: string;
    role: string;
    status: string;
  }>;
}

export function UserTable({ title, users }: UserTableProps) {
  return (
    <section className="user-table-card">
      <div className="table-header">
        <h2>{title}</h2>
        <button type="button">Invite user</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.name}>
              <td>{user.name}</td>
              <td>{user.role}</td>
              <td>{user.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
