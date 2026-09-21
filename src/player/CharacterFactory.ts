import * as THREE from 'three';
import {
  getMaterial,
  type MaterialOptions,
  type PaletteKey,
  UNIT_CAPSULE,
  UNIT_CHUNKY_BOX,
  UNIT_CONE,
  UNIT_CYLINDER,
  UNIT_EMBLEM,
  UNIT_ROUNDED_BOX,
  UNIT_SKIRT,
  UNIT_SPHERE,
  UNIT_TORUS,
  UNIT_TRIANGLE
} from '../world/Materials';
import type { CharacterDefinition, CharacterPalette } from '../config/characters';
import type { CharacterRig } from './CharacterTypes';

const SHOULDER_Y = 0.83;
const SHOULDER_X = 0.24;
const HEAD_PIVOT_Y = 0.93;

function mesh(geometry: THREE.BufferGeometry, color: PaletteKey, options?: MaterialOptions): THREE.Mesh {
  const m = new THREE.Mesh(geometry, getMaterial(color, options));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const BOY_HIP_Y = 0.46;
const GIRL_HIP_Y = 0.4;

/** One leg (capsule + shoe + sole) hung from a hip pivot at the origin, so PlayerController can swing the whole leg for walk/run. */
function buildLeg(
  parent: THREE.Group,
  hipX: number,
  hipY: number,
  legColor: PaletteKey,
  shoeColor: PaletteKey,
  soleColor: PaletteKey,
  legScale: number,
  legLength: number,
  shoeScale: THREE.Vector3,
  soleScale: THREE.Vector3,
  frontZ: number
): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(hipX, hipY, 0);

  const leg = mesh(UNIT_CAPSULE, legColor, { roughness: 0.75 });
  leg.scale.set(legScale, legLength, legScale);
  leg.position.set(0, -legLength, 0);
  pivot.add(leg);

  const shoeY = -legLength * 2 - shoeScale.y * 0.4;
  const shoe = mesh(UNIT_CHUNKY_BOX, shoeColor, { roughness: 0.6 });
  shoe.scale.copy(shoeScale);
  shoe.position.set(0, shoeY, frontZ);
  pivot.add(shoe);

  const sole = mesh(UNIT_ROUNDED_BOX, soleColor, { roughness: 0.85 });
  sole.scale.copy(soleScale);
  sole.position.set(0, shoeY - shoeScale.y * 0.4, frontZ);
  pivot.add(sole);

  parent.add(pivot);
  return pivot;
}

function buildBoyLowerBody(parent: THREE.Group, palette: CharacterPalette): { leftLegPivot: THREE.Group; rightLegPivot: THREE.Group } {
  const [leftLegPivot, rightLegPivot] = [-1, 1].map((side) =>
    buildLeg(
      parent,
      side * 0.15,
      BOY_HIP_Y,
      palette.bottom,
      palette.shoe,
      palette.shoeSole,
      0.17,
      0.16,
      new THREE.Vector3(0.23, 0.18, 0.34),
      new THREE.Vector3(0.25, 0.055, 0.36),
      0.055
    )
  ) as [THREE.Group, THREE.Group];

  // Chest (wider, shoulder-bearing) and waist (narrower) blocks overlap at
  // the seam instead of one uniform box, so the torso reads as a body with a
  // shape rather than a crate.
  const waist = mesh(UNIT_CHUNKY_BOX, palette.bottom, { roughness: 0.78 });
  waist.scale.set(0.4, 0.18, 0.27);
  waist.position.set(0, 0.545, 0);
  parent.add(waist);

  const chest = mesh(UNIT_CHUNKY_BOX, palette.top, { roughness: 0.7 });
  chest.scale.set(0.48, 0.26, 0.29);
  chest.position.set(0, 0.72, 0);
  parent.add(chest);

  // A small collar ring at the neckline reads as a hoodie/jacket collar and
  // softens the hard edge where the torso meets the neck.
  const collar = mesh(UNIT_TORUS, palette.top, { roughness: 0.65 });
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(0.12, 0.12, 0.05);
  collar.position.set(0, 0.855, 0);
  parent.add(collar);

  return { leftLegPivot, rightLegPivot };
}

function buildGirlLowerBody(parent: THREE.Group, palette: CharacterPalette): { leftLegPivot: THREE.Group; rightLegPivot: THREE.Group } {
  const [leftLegPivot, rightLegPivot] = [-1, 1].map((side) =>
    buildLeg(
      parent,
      side * 0.12,
      GIRL_HIP_Y,
      palette.skin,
      palette.shoe,
      palette.shoeSole,
      0.13,
      0.14,
      new THREE.Vector3(0.21, 0.17, 0.31),
      new THREE.Vector3(0.23, 0.055, 0.33),
      0.045
    )
  ) as [THREE.Group, THREE.Group];

  // Frustum skirt (flat waist, flared hem) instead of a pointed cone, so the
  // waist can actually meet the waistband/bodice instead of tapering to a tip.
  const skirt = mesh(UNIT_SKIRT, palette.bottom, { roughness: 0.72 });
  skirt.scale.set(0.34, 0.26, 0.34);
  skirt.position.set(0, 0.5, 0);
  parent.add(skirt);

  const waistband = mesh(UNIT_CHUNKY_BOX, palette.bottom, { roughness: 0.75 });
  waistband.scale.set(0.32, 0.09, 0.24);
  waistband.position.set(0, 0.615, 0);
  parent.add(waistband);

  const bodice = mesh(UNIT_CHUNKY_BOX, palette.top, { roughness: 0.7 });
  bodice.scale.set(0.34, 0.22, 0.24);
  bodice.position.set(0, 0.75, 0);
  parent.add(bodice);

  const collar = mesh(UNIT_TORUS, palette.top, { roughness: 0.6 });
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(0.1, 0.1, 0.045);
  collar.position.set(0, 0.855, 0);
  parent.add(collar);

  return { leftLegPivot, rightLegPivot };
}

function buildArm(parent: THREE.Group, side: -1 | 1, palette: CharacterPalette): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(side * SHOULDER_X, SHOULDER_Y, 0);

  // A shoulder cap sitting at the pivot origin overlaps into the torso,
  // bridging arm and body instead of leaving the capsule floating beside it.
  const shoulderCap = mesh(UNIT_SPHERE, palette.top, { roughness: 0.72 });
  shoulderCap.scale.setScalar(0.135);
  pivot.add(shoulderCap);

  const upperArm = mesh(UNIT_CAPSULE, palette.top, { roughness: 0.75 });
  upperArm.scale.set(0.1, 0.13, 0.1);
  upperArm.position.set(0, -0.16, 0);
  pivot.add(upperArm);

  const hand = mesh(UNIT_SPHERE, palette.skin, { roughness: 0.6 });
  hand.scale.setScalar(0.088);
  hand.position.set(0, -0.33, 0);
  pivot.add(hand);

  parent.add(pivot);
  return pivot;
}

function buildBackpack(parent: THREE.Group, palette: CharacterPalette): THREE.Group {
  const backpack = new THREE.Group();
  backpack.position.set(0, 0.71, -0.19);

  const body = mesh(UNIT_CHUNKY_BOX, palette.backpack, { roughness: 0.7 });
  body.scale.set(0.32, 0.34, 0.16);
  backpack.add(body);

  const flap = mesh(UNIT_CHUNKY_BOX, palette.backpackAccent, { roughness: 0.7 });
  flap.scale.set(0.28, 0.17, 0.07);
  flap.position.set(0, 0.14, -0.1);
  backpack.add(flap);

  const emblem = mesh(UNIT_EMBLEM, 'emblemGold', { roughness: 0.45, metalness: 0.1 });
  emblem.scale.setScalar(0.08);
  emblem.position.set(0, 0.14, -0.145);
  backpack.add(emblem);

  parent.add(backpack);
  return backpack;
}

function buildStraps(parent: THREE.Group, palette: CharacterPalette, torsoFrontZ: number): void {
  for (const side of [-1, 1]) {
    const strap = mesh(UNIT_CHUNKY_BOX, palette.backpackAccent, { roughness: 0.7 });
    strap.scale.set(0.07, 0.42, 0.05);
    strap.position.set(side * 0.13, 0.68, torsoFrontZ + 0.01);
    strap.rotation.x = 0.08;
    parent.add(strap);
  }
}

function buildFace(headGroup: THREE.Group, palette: CharacterPalette, browAngle: number): void {
  for (const side of [-1, 1]) {
    const eyeWhite = mesh(UNIT_SPHERE, 'cream', { roughness: 0.35 });
    eyeWhite.scale.set(0.062, 0.07, 0.022);
    eyeWhite.position.set(side * 0.095, 0.3, 0.235);
    headGroup.add(eyeWhite);

    const pupil = mesh(UNIT_SPHERE, 'eyeDark', { roughness: 0.3 });
    pupil.scale.set(0.034, 0.038, 0.015);
    pupil.position.set(side * 0.095, 0.298, 0.252);
    headGroup.add(pupil);

    // A thin skin-toned lid overlapping the eye's top edge — without it the
    // full round eye reads as permanently wide-open/startled.
    const lid = mesh(UNIT_SPHERE, palette.skin, { roughness: 0.55 });
    lid.scale.set(0.068, 0.032, 0.026);
    lid.position.set(side * 0.095, 0.328, 0.232);
    headGroup.add(lid);

    const brow = mesh(UNIT_CHUNKY_BOX, 'brownTrim', { roughness: 0.6 });
    brow.scale.set(0.078, 0.02, 0.016);
    brow.position.set(side * 0.095, 0.35, 0.245);
    brow.rotation.z = -side * browAngle;
    headGroup.add(brow);

    const cheek = mesh(UNIT_SPHERE, 'blush', { roughness: 0.7, transparent: true, opacity: 0.85 });
    cheek.scale.set(0.045, 0.038, 0.012);
    cheek.position.set(side * 0.145, 0.215, 0.212);
    headGroup.add(cheek);
  }

  const nose = mesh(UNIT_SPHERE, palette.skin, { roughness: 0.55 });
  nose.scale.setScalar(0.026);
  nose.position.set(0, 0.235, 0.255);
  headGroup.add(nose);

  const mouth = mesh(UNIT_CHUNKY_BOX, 'mouthBerry', { roughness: 0.6 });
  mouth.scale.set(0.066, 0.02, 0.018);
  mouth.position.set(0, 0.185, 0.245);
  headGroup.add(mouth);
}

function buildHead(parent: THREE.Group, palette: CharacterPalette, variant: 'boy' | 'girl'): THREE.Group {
  const headPivot = new THREE.Group();
  headPivot.position.set(0, HEAD_PIVOT_Y, 0);

  const neck = mesh(UNIT_CYLINDER, palette.skin, { roughness: 0.6 });
  neck.scale.set(0.12, 0.08, 0.12);
  neck.position.set(0, 0.02, 0);
  headPivot.add(neck);

  const head = mesh(UNIT_SPHERE, palette.skin, { roughness: 0.55 });
  head.scale.set(0.27, 0.25, 0.25);
  head.position.set(0, 0.29, 0);
  headPivot.add(head);

  buildFace(headPivot, palette, variant === 'girl' ? 0.16 : 0.09);

  if (variant === 'boy') {
    const cap = mesh(UNIT_SPHERE, palette.hair, { roughness: 0.6 });
    cap.scale.set(0.29, 0.24, 0.27);
    cap.position.set(0, 0.4, -0.02);
    headPivot.add(cap);

    // One designed hairstyle: two chunky, well-embedded tufts rather than
    // three thin separate cones scattered on top.
    const tuftPositions: Array<[number, number, number, number]> = [
      [-0.1, 0.52, 0.03, -0.5],
      [0.1, 0.52, 0.03, 0.5]
    ];
    for (const [x, y, z, tilt] of tuftPositions) {
      const tuft = mesh(UNIT_CONE, palette.hair, { roughness: 0.6 });
      tuft.scale.set(0.1, 0.16, 0.1);
      tuft.position.set(x, y, z);
      tuft.rotation.z = tilt;
      tuft.rotation.x = -0.25;
      headPivot.add(tuft);
    }
    const frontTuft = mesh(UNIT_CONE, palette.hair, { roughness: 0.6 });
    frontTuft.scale.set(0.09, 0.15, 0.09);
    frontTuft.position.set(0, 0.53, 0.1);
    frontTuft.rotation.x = 0.5;
    headPivot.add(frontTuft);
  } else {
    const cap = mesh(UNIT_SPHERE, palette.hair, { roughness: 0.55 });
    cap.scale.set(0.275, 0.225, 0.265);
    cap.position.set(0, 0.38, -0.02);
    headPivot.add(cap);

    const fringe = mesh(UNIT_CHUNKY_BOX, palette.hair, { roughness: 0.55 });
    fringe.scale.set(0.24, 0.1, 0.16);
    fringe.position.set(0, 0.4, 0.13);
    headPivot.add(fringe);

    for (const side of [-1, 1]) {
      const bun = mesh(UNIT_SPHERE, palette.hair, { roughness: 0.55 });
      bun.scale.setScalar(0.125);
      bun.position.set(side * 0.29, 0.31, -0.04);
      headPivot.add(bun);

      const ribbon = mesh(UNIT_TRIANGLE, palette.backpackAccent, { roughness: 0.7 });
      ribbon.scale.set(0.085, 0.075, 1);
      ribbon.position.set(side * 0.29, 0.38, -0.02);
      ribbon.rotation.z = side * 0.5;
      headPivot.add(ribbon);
    }
  }

  parent.add(headPivot);
  return headPivot;
}

/**
 * Builds one character's full procedural rig. Local space: feet at y = 0,
 * facing +Z. Everything below `bodyPivot` shares the character's palette;
 * the only thing that differs structurally between "boy" and "girl" is the
 * lower-body silhouette and the hairstyle — arms, backpack and face rig are
 * shared so the animation controller never has to special-case a variant.
 */
export function buildCharacterRig(definition: CharacterDefinition): CharacterRig {
  const root = new THREE.Group();
  root.name = `Character_${definition.id}`;

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const isGirl = definition.id === 'girl';
  const { leftLegPivot, rightLegPivot } = isGirl
    ? buildGirlLowerBody(bodyPivot, definition.palette)
    : buildBoyLowerBody(bodyPivot, definition.palette);
  buildStraps(bodyPivot, definition.palette, isGirl ? 0.12 : 0.145);

  const leftArmPivot = buildArm(bodyPivot, -1, definition.palette);
  const rightArmPivot = buildArm(bodyPivot, 1, definition.palette);
  const backpack = buildBackpack(bodyPivot, definition.palette);
  const carryAnchor = new THREE.Group();
  carryAnchor.position.set(0, 0.58, 0.38);
  bodyPivot.add(carryAnchor);
  const headPivot = buildHead(bodyPivot, definition.palette, isGirl ? 'girl' : 'boy');

  return { root, bodyPivot, headPivot, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot, backpack, carryAnchor };
}
