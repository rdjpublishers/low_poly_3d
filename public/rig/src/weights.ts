// weights.ts — vertex-skin-weight builder for three-rig-helpers
// (browser ESM). Translated 1:1 from the upstream weights.ts source
// attached in the spec. The algorithm, validation logic, and THREE
// references are preserved exactly. The bundle's internal
// `import * as THREE from 'three'` is left as a bare specifier — the
// renderer's import map resolves it.

import * as THREE from "three";
import type { RigJoint } from "./ir/character-ir.js";
import type { SkeletonBuildResult } from "./skeleton.js";

export interface WeightBuildResult {
  indices: THREE.Uint16BufferAttribute;
  weights: THREE.Float32BufferAttribute;
  maxWeightError: number;
}

export interface CompactWeightBuildResult {
  indices: THREE.Uint8BufferAttribute;
  weights: THREE.Uint8BufferAttribute;
}

/**
 * Bind each vertex to one semantic joint using compact normalized bytes. This
 * is intended for reconstructed multipart surfaces where smoothing across an
 * unknown source seam would be less truthful than a rigid semantic region.
 */
export function buildRigidSemanticWeights(
  geometry: THREE.BufferGeometry,
  skeleton: SkeletonBuildResult,
  resolveJoint: (x: number, y: number, z: number, vertex: number) => string,
): CompactWeightBuildResult {
  const position = geometry.getAttribute("position");
  if (!position) throw new Error("cannot bind geometry without position attribute");
  if (skeleton.skeleton.bones.length > 255) throw new Error("compact semantic weights support at most 255 bones");
  const boneIndices = new Map(skeleton.skeleton.bones.map((bone, index) => [bone.name, index]));
  const indices = new Uint8Array(position.count * 4);
  const weights = new Uint8Array(position.count * 4);
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const joint = resolveJoint(position.getX(vertex), position.getY(vertex), position.getZ(vertex), vertex);
    const boneIndex = boneIndices.get(joint);
    if (boneIndex === undefined) throw new Error(`semantic weight resolver returned unknown joint: ${joint}`);
    indices[vertex * 4] = boneIndex;
    weights[vertex * 4] = 255;
  }
  geometry.setAttribute("skinIndex", new THREE.Uint8BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new THREE.Uint8BufferAttribute(weights, 4, true));
  return {
    indices: geometry.getAttribute("skinIndex") as THREE.Uint8BufferAttribute,
    weights: geometry.getAttribute("skinWeight") as THREE.Uint8BufferAttribute,
  };
}

export function buildSemanticWeights(geometry: THREE.BufferGeometry, skeleton: SkeletonBuildResult, joints: RigJoint[], maxInfluences = 4): WeightBuildResult {
  const position = geometry.getAttribute("position");
  if (!position) throw new Error("cannot bind geometry without position attribute");
  const rest = joints.map((joint) => ({ joint, point: skeleton.restWorldPositions.get(joint.id) ?? new THREE.Vector3() }));
  const indices = new Uint16Array(position.count * 4);
  const weights = new Float32Array(position.count * 4);
  let maxWeightError = 0;
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const point = new THREE.Vector3().fromBufferAttribute(position, vertex);
    const candidates = rest.map(({ joint, point: jointPoint }, index) => ({ index, distance: Math.max(0.0001, point.distanceTo(jointPoint)), joint })).sort((a, b) => a.distance - b.distance).slice(0, Math.min(maxInfluences, 4));
    const raw = candidates.map((candidate) => 1 / candidate.distance ** 2);
    const total = raw.reduce((sum, value) => sum + value, 0) || 1;
    for (let slot = 0; slot < 4; slot += 1) {
      const candidate = candidates[slot];
      indices[vertex * 4 + slot] = candidate ? candidate.index : 0;
      weights[vertex * 4 + slot] = candidate ? raw[slot] / total : 0;
    }
    const sum = weights[vertex * 4] + weights[vertex * 4 + 1] + weights[vertex * 4 + 2] + weights[vertex * 4 + 3];
    maxWeightError = Math.max(maxWeightError, Math.abs(1 - sum));
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  return { indices: geometry.getAttribute("skinIndex") as THREE.Uint16BufferAttribute, weights: geometry.getAttribute("skinWeight") as THREE.Float32BufferAttribute, maxWeightError };
}

export function validateWeights(geometry: THREE.BufferGeometry, tolerance = 0.001): string[] {
  const weights = geometry.getAttribute("skinWeight");
  const indices = geometry.getAttribute("skinIndex");
  const errors: string[] = [];
  if (!weights || weights.itemSize !== 4) errors.push("skinWeight attribute is missing or not vec4");
  if (!indices || indices.itemSize !== 4) errors.push("skinIndex attribute is missing or not vec4");
  if (weights) for (let index = 0; index < weights.count; index += 1) { const sum = weights.getX(index) + weights.getY(index) + weights.getZ(index) + weights.getW(index); if (Math.abs(sum - 1) > tolerance) errors.push(`skin weights do not sum to one at vertex ${index}: ${sum}`); }
  return errors;
}
