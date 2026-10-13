import { SITE } from "@/lib/site-config";

export function Masthead() {
  return (
    <header className="masthead">
      <div className="container">
        <p className="masthead-kicker">{SITE.kicker}</p>
        <h1 className="masthead-title">{SITE.shortName}</h1>
        <p className="masthead-deck">{SITE.deck}</p>
      </div>
    </header>
  );
}
