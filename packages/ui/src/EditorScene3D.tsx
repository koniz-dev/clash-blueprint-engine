import { useMemo, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { build3DModel, type Box3D, type WallSegment3D } from "@clash/renderer";
import type { EditorController } from "./useEditor";

const SELECTED_EMISSIVE = "#ffd600";
const HOVER_EMISSIVE = "#ffffff";

function BuildingMesh({
  box,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  box: Box3D;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onHover: (id: string | null) => void;
}): JSX.Element {
  const emissive = selected ? SELECTED_EMISSIVE : hovered ? HOVER_EMISSIVE : "#000000";
  return (
    <mesh
      position={[box.center.x, box.center.y, box.center.z]}
      rotation={[0, (-box.rotationDeg * Math.PI) / 180, 0]}
      castShadow
      receiveShadow
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(box.id);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(box.id, e.nativeEvent.shiftKey);
      }}
    >
      <boxGeometry args={[box.size.width, box.size.height, box.size.depth]} />
      <meshStandardMaterial
        color={box.color}
        emissive={emissive}
        emissiveIntensity={selected ? 0.55 : hovered ? 0.3 : 0}
      />
    </mesh>
  );
}

function WallMesh({ segment }: { segment: WallSegment3D }): JSX.Element {
  return (
    <mesh
      position={[segment.center.x, segment.center.y, segment.center.z]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[segment.size.width, segment.size.height, segment.size.depth]} />
      <meshStandardMaterial color={segment.color} />
    </mesh>
  );
}

export interface EditorScene3DProps {
  readonly controller: EditorController;
}

/**
 * Interactive 3D view. A pure *view* over `controller.scene`: it maps the
 * framework-agnostic {@link build3DModel} descriptors to three.js meshes and
 * shares selection with the 2D canvas via the controller. All 3D/WebGL code is
 * confined to this component (and its deps), never the core packages.
 */
export function EditorScene3D({ controller }: EditorScene3DProps): JSX.Element {
  const { scene } = controller;
  const model = useMemo(
    () => build3DModel(scene, { coreCategory: controller.coreCategory }),
    [scene, controller.coreCategory],
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const gw = model.ground.width;
  const gh = model.ground.height;
  const maxDim = Math.max(gw, gh);
  const center: [number, number, number] = [gw / 2, 0, gh / 2];

  return (
    <div className="cbe-scene3d">
      <Canvas
        shadows
        camera={{
          position: [gw / 2 + maxDim * 0.75, maxDim * 0.95, gh / 2 + maxDim * 0.75],
          fov: 50,
        }}
        onPointerMissed={() => controller.setSelectedIds([])}
      >
        <color attach="background" args={["#0f1419"]} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#dfe7ef", "#20303c", 0.5]} />
        <directionalLight
          position={[gw, maxDim * 1.5, gh * 0.4]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-maxDim}
          shadow-camera-right={maxDim}
          shadow-camera-top={maxDim}
          shadow-camera-bottom={-maxDim}
          shadow-camera-near={0.5}
          shadow-camera-far={maxDim * 4}
        />

        {/* Ground plane + tile grid. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={center} receiveShadow>
          <planeGeometry args={[gw, gh]} />
          <meshStandardMaterial color="#26323c" />
        </mesh>
        <gridHelper
          args={[maxDim, maxDim, "#3a4a58", "#2b3742"]}
          position={[gw / 2, 0.02, gh / 2]}
        />

        {model.walls.map((segment, i) => (
          <WallMesh key={`w${i}`} segment={segment} />
        ))}
        {model.buildings.map((box) => (
          <BuildingMesh
            key={box.id}
            box={box}
            selected={controller.selectedIds.includes(box.id)}
            hovered={hoveredId === box.id}
            onSelect={controller.actions.selectBuilding}
            onHover={setHoveredId}
          />
        ))}

        <OrbitControls makeDefault target={center} enableDamping maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
    </div>
  );
}

export default EditorScene3D;
