import type { Meta, StoryObj } from "@storybook/react";
import { BuildingLibrary } from "./BuildingLibrary";
import { storyCatalog } from "./story-fixtures";
import { useEditor } from "./useEditor";

const meta: Meta<typeof BuildingLibrary> = {
  title: "Panels/BuildingLibrary",
  component: BuildingLibrary,
};
export default meta;

type Story = StoryObj<typeof BuildingLibrary>;

function LibraryPreview(): JSX.Element {
  const controller = useEditor({ catalog: storyCatalog });
  return (
    <div className="cbe-left" style={{ width: 240, height: "100vh" }}>
      <BuildingLibrary controller={controller} catalog={storyCatalog} />
    </div>
  );
}

export const Default: Story = {
  render: () => <LibraryPreview />,
};
