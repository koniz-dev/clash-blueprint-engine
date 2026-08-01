import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { GESTURES, SHORTCUTS } from "./shortcuts";

const meta: Meta<typeof ShortcutsOverlay> = {
  title: "Editor/ShortcutsOverlay",
  component: ShortcutsOverlay,
};
export default meta;

type Story = StoryObj<typeof ShortcutsOverlay>;

function OverlayPreview({ isMac }: { isMac: boolean }): JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <div className="cbe-app" style={{ minHeight: 480 }}>
      <button className="cbe-btn" onClick={() => setOpen(true)}>
        ? Help
      </button>
      <ShortcutsOverlay
        open={open}
        onClose={() => setOpen(false)}
        shortcuts={SHORTCUTS}
        gestures={GESTURES}
        isMac={isMac}
      />
    </div>
  );
}

export const MacOS: Story = {
  name: "Open (⌘ / macOS)",
  render: () => <OverlayPreview isMac />,
};

export const WindowsLinux: Story = {
  name: "Open (Ctrl / Windows·Linux)",
  render: () => <OverlayPreview isMac={false} />,
};
