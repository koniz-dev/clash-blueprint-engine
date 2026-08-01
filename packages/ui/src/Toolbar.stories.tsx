import type { Meta, StoryObj } from "@storybook/react";
import { Toolbar } from "./Toolbar";
import { storyCatalog, storyRuleSet } from "./story-fixtures";
import { useEditor } from "./useEditor";

const meta: Meta<typeof Toolbar> = {
  title: "Editor/Toolbar",
  component: Toolbar,
};
export default meta;

type Story = StoryObj<typeof Toolbar>;

function ToolbarPreview(): JSX.Element {
  const controller = useEditor({ catalog: storyCatalog, ruleSet: storyRuleSet });
  return (
    <div className="cbe-app">
      <header className="cbe-header">
        <div className="cbe-brand">Clash Blueprint Engine</div>
        <Toolbar controller={controller} />
      </header>
    </div>
  );
}

export const Default: Story = {
  render: () => <ToolbarPreview />,
};
