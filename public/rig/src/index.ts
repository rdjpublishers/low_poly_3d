// index.ts — single entry point for the three-rig-helpers bundle.
// esbuild --bundle will follow the imports from here. Re-exports
// the 5 public functions from PART 34 PLUS the 4 new public functions
// from PART 75 (buildGeodesicWeights, buildHeatDiffusionWeights,
// buildInverseDistanceWeights, buildSegmentationWeights) PLUS the
// 2 type re-exports for editor / .d.ts consumers.

export type { RigJoint, RigGraph, Vec3, Quat4 } from "./ir/character-ir.js";
export type { SkeletonBuildResult, WeightBuildResult, CompactWeightBuildResult } from "./skeleton.js";

export { buildSkeleton, resetSkeleton, jointWorldPosition, validateRigGraph, asVector } from "./skeleton.js";
export { buildSemanticWeights, buildRigidSemanticWeights, validateWeights } from "./weights.js";
// PART 75 — Multi-mode skin weight algorithms (v1.25 / v8.17).
export { buildGeodesicWeights, buildHeatDiffusionWeights, buildInverseDistanceWeights, buildSegmentationWeights } from "./weights.js";
