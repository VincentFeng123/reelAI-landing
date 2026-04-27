"use client";

import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { REEL_PHOTOS } from "@/lib/reelPhotos";
import { scrollState } from "@/lib/scrollState";

const COUNT = 38;
const RADIUS = 7;
const Z_START = 0.5; // start already pulled in toward the camera
const Z_END = 4.0; // end: closer to camera but not past it (limit unchanged)
const ZOOM_FINISH = 0.5; // zoom completes at this fraction of carouselProgress
const CARD_W = 0.95;
const CARD_H = 1.69;
const CARD_ASPECT = CARD_W / CARD_H;

function fitTextureToCard(texture: THREE.Texture) {
  const image = texture.image as HTMLImageElement | undefined;
  const imageAspect = image?.width && image?.height ? image.width / image.height : CARD_ASPECT;

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);

  if (imageAspect > CARD_ASPECT) {
    texture.repeat.x = CARD_ASPECT / imageAspect;
    texture.offset.x = (1 - texture.repeat.x) * 0.5;
  } else {
    texture.repeat.y = imageAspect / CARD_ASPECT;
    texture.offset.y = (1 - texture.repeat.y) * 0.5;
  }

  texture.needsUpdate = true;
}

export default function ReelRibbon({ reduced = false }: { reduced?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const opacityRef = useRef(0);
  const textures = useLoader(
    THREE.TextureLoader,
    REEL_PHOTOS.map((photo) => photo.src),
  );

  const cards = useMemo(() => {
    const arr: { phase: number; tilt: number; yOffset: number; zJitter: number }[] = [];
    for (let i = 0; i < COUNT; i++) {
      arr.push({
        phase: (i / COUNT) * Math.PI * 2,
        tilt: (Math.random() - 0.5) * 0.55,
        yOffset: (Math.random() - 0.5) * 3.8,
        zJitter: (Math.random() - 0.5) * 0.8,
      });
    }
    return arr;
  }, []);

  const cardGeometry = useMemo(
    () => new THREE.PlaneGeometry(CARD_W, CARD_H, 1, 1),
    [],
  );

  const cardMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x141414,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.5,
        metalness: 0,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const photoMaterials = useMemo(() => {
    textures.forEach(fitTextureToCard);
    return textures.map(
      (texture) =>
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
    );
  }, [textures]);

  const shadeMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  );

  const playBgMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  );

  const playIconMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  );

  const frameMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
      }),
    [],
  );

  const frameGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.PlaneGeometry(CARD_W, CARD_H)),
    [],
  );

  const playBgGeo = useMemo(() => new THREE.CircleGeometry(0.16, 36), []);

  const playIconGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.045, -0.075);
    shape.lineTo(-0.045, 0.075);
    shape.lineTo(0.085, 0);
    shape.lineTo(-0.045, -0.075);
    return new THREE.ShapeGeometry(shape);
  }, []);

  useEffect(() => {
    return () => {
      cardGeometry.dispose();
      cardMaterial.dispose();
      frameMaterial.dispose();
      frameGeo.dispose();
      shadeMaterial.dispose();
      playBgMaterial.dispose();
      playIconMaterial.dispose();
      playBgGeo.dispose();
      playIconGeo.dispose();
      for (const material of photoMaterials) material.dispose();
    };
  }, [
    cardGeometry,
    cardMaterial,
    frameMaterial,
    frameGeo,
    shadeMaterial,
    playBgMaterial,
    playIconMaterial,
    playBgGeo,
    playIconGeo,
    photoMaterials,
  ]);

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime * (reduced ? 0.04 : 0.085);

    // Fade carousel in/out based on visibility flag
    const target = scrollState.carouselVisible ? 1 : 0;
    opacityRef.current += (target - opacityRef.current) * 0.06;
    const o = opacityRef.current;
    cardMaterial.opacity = 0.42 * o;
    shadeMaterial.opacity = 0.18 * o;
    playBgMaterial.opacity = 0.52 * o;
    playIconMaterial.opacity = 0.94 * o;
    for (const material of photoMaterials) {
      material.opacity = 0.78 * o;
    }
    frameMaterial.opacity = 0.45 * o;

    // Zoom: orbit centre lerps from Z_START to Z_END over the first half
    // of carouselProgress, then *holds* at Z_END for the rest of Demo→Tech.
    const zoomP = Math.min(1, scrollState.carouselProgress / ZOOM_FINISH);
    g.position.z = Z_START + (Z_END - Z_START) * zoomP;

    g.rotation.y = t * 0.55;
    g.rotation.x = Math.sin(t * 0.35) * 0.1;
  });

  return (
    <group ref={groupRef}>
      {cards.map((c, i) => {
        const x = Math.cos(c.phase) * RADIUS;
        const z = Math.sin(c.phase) * RADIUS + c.zJitter;
        const y = c.yOffset;
        return (
          <group
            key={i}
            position={[x, y, z]}
            rotation={[0, -c.phase + Math.PI / 2, c.tilt]}
          >
            <mesh
              geometry={cardGeometry}
              material={cardMaterial}
              renderOrder={0}
            />
            <mesh
              geometry={cardGeometry}
              material={photoMaterials[i % photoMaterials.length]}
              position={[0, 0, 0.006]}
              renderOrder={1}
            />
            <mesh
              geometry={cardGeometry}
              material={shadeMaterial}
              position={[0, 0, 0.012]}
              renderOrder={2}
            />
            <group position={[0, 0, 0.03]}>
              <mesh
                geometry={playBgGeo}
                material={playBgMaterial}
                renderOrder={3}
              />
              <mesh
                geometry={playIconGeo}
                material={playIconMaterial}
                position={[0.018, 0, 0.006]}
                renderOrder={4}
              />
            </group>
            <lineSegments geometry={frameGeo} material={frameMaterial} />
          </group>
        );
      })}
    </group>
  );
}
