"use client";

import dynamic from "next/dynamic";

// The editor uses Konva (canvas), which must run only in the browser.
const EditorClient = dynamic(() => import("./EditorClient"), {
  ssr: false,
  loading: () => <div className="cbe-loading">Loading editor…</div>,
});

export default function Page(): JSX.Element {
  return <EditorClient />;
}
