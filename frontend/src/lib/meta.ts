import { useEffect } from "react";

const APP = (import.meta.env.VITE_APP_NAME as string | undefined) || "GRIEVANCE";
const DEFAULT_DESC = "GRIEVANCE — report civic problems in Hindi, Marathi or English and track them until they are fixed. Agentic, audited grievance redressal.";

function setMeta(selector: string, attr: "name" | "property", key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

/** Sets the document title and description (plus Open Graph equivalents) for a page. */
export function usePageMeta(title: string, description: string = DEFAULT_DESC, opts: { noindex?: boolean } = {}) {
  useEffect(() => {
    const full = title ? `${title} · ${APP}` : `${APP} — Agentic grievance redressal`;
    document.title = full;
    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[property="og:title"]', "property", "og:title", full);
    setMeta('meta[property="og:description"]', "property", "og:description", description);
    setMeta('meta[name="robots"]', "name", "robots", opts.noindex ? "noindex, nofollow" : "index, follow");
  }, [title, description, opts.noindex]);
}

export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || "";
