import Link from "next/link";

export default function DashboardPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>Dashboard — Admin</h1>
      <p style={{ opacity: 0.8, marginBottom: 20 }}>Panel principal del negocio</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/dashboard/users" style={cardStyle}>
          <h3 style={{ margin: 0 }}>Usuarios</h3>
          <p style={{ margin: "8px 0 0", opacity: 0.8 }}>
            Activar / desactivar cajera, roles
          </p>
        </Link>

        <Link href="/dashboard/inventory" style={cardStyle}>
          <h3 style={{ margin: 0 }}>Inventario</h3>
          <p style={{ margin: "8px 0 0", opacity: 0.8 }}>
            Entradas, salidas, conteos
          </p>
        </Link>

        <Link href="/dashboard/products" style={cardStyle}>
          <h3 style={{ margin: 0 }}>Productos & costos</h3>
          <p style={{ margin: "8px 0 0", opacity: 0.8 }}>
            Márgenes por producto
          </p>
        </Link>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: "block",
  width: 280,
  padding: 16,
  borderRadius: 18,
  border: "1px solid #2a2a2a",
  textDecoration: "none",
};