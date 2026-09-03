// character-ir.ts — shared intermediate-representation types for the
// three-rig-helpers pre-bundled library. Re-declared in the bundle
// (no external type imports) so the bundle is self-contained.
//
// Per the user's confirmed inference (no character-ir.ts was attached):
//   RigJoint = { id: string, parentId?: string,
//                restPosition: [number, number, number],
//                restRotation: [number, number, number, number] }
//   RigGraph = { joints: RigJoint[] }
//   Vec3     = [number, number, number]

export type Vec3 = [number, number, number];

export type Quat4 = [number, number, number, number];

export interface RigJoint {
  id: string;
  parentId?: string;
  restPosition: Vec3;
  restRotation: Quat4;
}

export interface RigGraph {
  joints: RigJoint[];
}
