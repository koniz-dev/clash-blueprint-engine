import { useCallback, useRef, useState } from "react";

export interface LogEntry {
  readonly id: number;
  readonly kind: "info" | "error" | "event";
  readonly message: string;
}

export type PushLog = (kind: LogEntry["kind"], message: string) => void;

/** The event/error log shown in the bottom panel (most-recent first, capped). */
export function useLog(): { log: LogEntry[]; pushLog: PushLog } {
  const [log, setLog] = useState<LogEntry[]>([]);
  const logId = useRef(0);
  const pushLog = useCallback<PushLog>((kind, message) => {
    setLog((prev) => [{ id: ++logId.current, kind, message }, ...prev].slice(0, 100));
  }, []);
  return { log, pushLog };
}
