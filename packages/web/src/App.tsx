import type { HealthResponse } from "@rocket/shared";

const greeting: HealthResponse = {
  status: "ok",
  message: "Hello from Rocket Web 🚀",
};

function App() {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>🚀 Rocket</h1>
      <p>{greeting.message}</p>
    </div>
  );
}

export default App;
