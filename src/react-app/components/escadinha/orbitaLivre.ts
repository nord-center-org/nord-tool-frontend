import * as THREE from "three";

/** Ajustes dos controles de órbita para navegar livre: zoom para onde o mouse aponta, arrastar com o botão direito. */
export const ORBITA_LIVRE = {
  enableDamping: true,
  dampingFactor: 0.12,
  zoomToCursor: true,
  screenSpacePanning: true,
  enablePan: true,
  maxPolarAngle: Math.PI * 0.98,
  mouseButtons: { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN },
} as const;
