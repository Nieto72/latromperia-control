import TopBar from "./components/TopBar";

export default function Home() {
  return (
    <>
      <TopBar title="La Trompería — Admin" />
      <div style={{ padding: 24 }}>
        <h1>Home</h1>
        <p>Si estás viendo esto, Next está corriendo bien.</p>
      </div>
    </>
  );
}
