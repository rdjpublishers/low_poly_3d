// skeleton.ts — rig compiler for three-rig-helpers (browser ESM).
// Translated 1:1 from the upstream skeleton.ts source attached in the
// spec, with the only changes being:
//   1. sibling relative path → relative path inside this bundle
//      ("../../ir/character-ir.js" → "./ir/character-ir.js")
//   2. dropping the "../skeleton/index.js" cross-import (the weights
//      file now imports SkeletonBuildResult from "./skeleton.js")
//
// The algorithm, validation logic, and THREE references are preserved
// exactly. The bundle's internal `import * as THREE from 'three'` is
// left as a bare specifier — the renderer's import map resolves it.

import * as THREE from "three";
import type { RigGraph, Vec3 } from "./ir/character-ir.js";

export interface SkeletonBuildResult {
  root: THREE.Bone;
  bones: Map<string, THREE.Bone>;
  skeleton: THREE.Skeleton;
  restWorldPositions: Map<string, THREE.Vector3>;
}

export function buildSkeleton(graph: RigGraph): SkeletonBuildResult {
  const bones = new Map<string, THREE.Bone>();
  const restWorldPositions = new Map<string, THREE.Vector3>();
  const pending = [...graph.joints];
  while (pending.length) {
    const joint = pending.shift()!;
    const parentId = joint.parentId;
    if (parentId && !bones.has(parentId)) {
      pending.push(joint);
      if (pending.every((candidate) => candidate.id !== parentId)) throw new Error(`rig joint ${joint.id} references missing parent ${parentId}`);
      continue;
    }
    const bone = new THREE.Bone();
    bone.name = joint.id;
    const parent = parentId ? bones.get(parentId) : undefined;
    if (parent && parentId) {
      const parentRest = restWorldPositions.get(parentId)!;
      bone.position.set(joint.restPosition[0] - parentRest.x, joint.restPosition[1] - parentRest.y, joint.restPosition[2] - parentRest.z);
      parent.add(bone);
    } else {
      bone.position.set(...joint.restPosition);
    }
    bone.quaternion.set(...joint.restRotation);
    bones.set(joint.id, bone);
    restWorldPositions.set(joint.id, new THREE.Vector3(...joint.restPosition));
  }
  const roots = graph.joints.filter((joint) => !joint.parentId).map((joint) => bones.get(joint.id)!);
  if (roots.length !== 1) throw new Error(`Character rig must have exactly one root, got ${roots.length}`);
  const skeleton = new THREE.Skeleton([...bones.values()]);
  // calculateInverses reads bone.matrixWorld. The hierarchy must be updated
  // first; otherwise every inverse is identity and vertices stretch from the
  // origin when SkinnedMesh applies the bind pose.
  roots[0].updateMatrixWorld(true);
  skeleton.calculateInverses();
  return { root: roots[0], bones, skeleton, restWorldPositions };
}

export function resetSkeleton(result: SkeletonBuildResult): void {
  for (const bone of result.bones.values()) {
    const joint = result.skeleton.bones.find((candidate) => candidate.name === bone.name);
    if (joint) joint.quaternion.identity();
  }
  result.root.updateMatrixWorld(true);
  result.skeleton.pose();
}

export function jointWorldPosition(result: SkeletonBuildResult, id: string): THREE.Vector3 {
  const bone = result.bones.get(id);
  if (!bone) throw new Error(`unknown rig joint: ${id}`);
  result.root.updateMatrixWorld(true);
  return bone.getWorldPosition(new THREE.Vector3());
}

export function validateRigGraph(graph: RigGraph): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const joint of graph.joints) {
    if (ids.has(joint.id)) errors.push(`duplicate joint: ${joint.id}`);
    ids.add(joint.id);
    if (joint.parentId === joint.id) errors.push(`joint is its own parent: ${joint.id}`);
    if (joint.restPosition.some((value) => !Number.isFinite(value))) errors.push(`joint ${joint.id} has invalid rest position`);
    if (joint.parentId && !graph.joints.some((candidate) => candidate.id === joint.parentId)) errors.push(`missing parent ${joint.parentId} for ${joint.id}`);
  }
  if (graph.joints.filter((joint) => !joint.parentId).length !== 1) errors.push("rig must have one root joint");
  return errors;
}

export function asVector(position: Vec3): THREE.Vector3 {
  return new THREE.Vector3(...position);
}
