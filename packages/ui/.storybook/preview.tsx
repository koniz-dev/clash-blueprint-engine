import type { Preview } from "@storybook/react";
import "../src/styles.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "editor", values: [{ name: "editor", value: "#0f1419" }] },
  },
};

export default preview;
