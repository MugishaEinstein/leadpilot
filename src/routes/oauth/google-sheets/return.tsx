import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/oauth/google-sheets/return")({
  head: () => ({
    meta: [
      { title: "Connecting Google — LeadPilot" },
      { name: "description", content: "Finishing your Google Sheets connection for LeadPilot." },
      { property: "og:title", content: "Connecting Google — LeadPilot" },
      { property: "og:description", content: "Finishing your Google Sheets connection for LeadPilot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OAuthReturn,
});

function OAuthReturn() {
  const [message, setMessage] = useState("Finishing connection…");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed", code?: string) => {
      window.opener?.postMessage({ type, connectorId: "google_sheets", code: code ?? null }, window.location.origin);
      window.close();
    };
    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Google connection did not complete.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") return notify("appUserConnectorOAuthComplete");
      setMessage("Connection completed without a code.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    notify("appUserConnectorOAuthComplete", code);
  }, []);
  return <p className="p-8 text-center text-muted-foreground">{message}</p>;
}
