import type { Meta, StoryObj } from "@storybook/react";
import { EditorApp } from "./EditorApp";
import { storyCatalog, storyRuleSet } from "./story-fixtures";

const meta: Meta<typeof EditorApp> = {
  title: "Editor/EditorApp",
  component: EditorApp,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof EditorApp>;

/** The full editor — toolbar, library, Konva canvas, panels and event log. */
export const FullEditor: Story = {
  args: { catalog: storyCatalog, ruleSet: storyRuleSet, gridSize: 44, tier: 8 },
};
