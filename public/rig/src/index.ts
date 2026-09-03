// index.ts — single entry point for the three-rig-helpers bundle.
// esbuild --bundle will follow the imports from here. Re-exports
// exactly the 5 public functions that PART 34 documents, plus the
// two type re-exports for editor / .d.ts consumers.

export type { RigJoint, RigGraph, Vec3, Quat4 } from "./ir/character-ir.js";
export type { SkeletonBuildResult, WeightBuildResult, CompactWeightBuildResult } from "./skeleton.js";

export { buildSkeleton, resetSkeleton, jointWorldPosition, validateRigGraph, asVector } from "./skeleton.js";
export { buildSemanticWeights, buildRigidSemanticWeights, validateWeights } from "./weights.js";
