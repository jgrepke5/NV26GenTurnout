import { Masthead } from "./Masthead";

export function ErrorPage({ message }: { message: string }) {
  return (
    <>
      <Masthead />
      <main className="container">
        <div className="error-box">
          <h2>Unable to load turnout data</h2>
          <p>{message}</p>
          <p>
            Place the latest NVSOS VIVID extract zip in{" "}
            <strong>data/raw/</strong>, run <code>npm run sync</code>, then try
            again.
          </p>
        </div>
      </main>
    </>
  );
}
