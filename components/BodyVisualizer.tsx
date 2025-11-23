import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { MeasurementResult, UserStats } from '../types';

interface Props {
  measurements: MeasurementResult;
  stats: UserStats;
}

export interface BodyVisualizerHandle {
  downloadObj: () => void;
  downloadPng: () => void;
  downloadUSDZ: () => void;
  downloadGLB: () => void;
  downloadSTL: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  getOBJBlob: () => Promise<Blob | null>;
  getUSDZBlob: () => Promise<Blob | null>;
  getGLBBlob: () => Promise<Blob | null>;
  getSTLBlob: () => Promise<Blob | null>;
}

export const BodyVisualizer = forwardRef<BodyVisualizerHandle, Props>(({ measurements, stats }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);

  // Helper to generate blobs
  const generateOBJ = async (): Promise<Blob | null> => {
    if (!groupRef.current) return null;
    const exporter = new OBJExporter();
    const result = exporter.parse(groupRef.current);
    return new Blob([result], { type: 'text/plain' });
  };

  const generateUSDZ = async (): Promise<Blob | null> => {
     if (!groupRef.current) return null;
     const exporter = new USDZExporter();
     const arraybuffer = await exporter.parse(groupRef.current);
     return new Blob([arraybuffer], { type: 'application/octet-stream' });
  };

  const generateGLB = async (): Promise<Blob | null> => {
    if (!groupRef.current) return null;
    const exporter = new GLTFExporter();
    return new Promise((resolve) => {
      exporter.parse(
        groupRef.current!,
        (result) => {
          if (result instanceof ArrayBuffer) {
             resolve(new Blob([result], { type: 'application/octet-stream' }));
          } else {
             // Handle JSON output if binary=false (shouldn't happen with defaults usually, but we want binary)
             const output = JSON.stringify(result, null, 2);
             resolve(new Blob([output], { type: 'text/plain' }));
          }
        },
        (error) => {
          console.error("GLTF Export Error:", error);
          resolve(null);
        },
        { binary: true } // Request .glb
      );
    });
  };

  const generateSTL = async (): Promise<Blob | null> => {
    if (!groupRef.current) return null;
    const exporter = new STLExporter();
    const result = exporter.parse(groupRef.current, { binary: true });
    return new Blob([result], { type: 'application/octet-stream' });
  };

  useImperativeHandle(ref, () => ({
    getCanvas: () => rendererRef.current?.domElement || null,
    getOBJBlob: generateOBJ,
    getUSDZBlob: generateUSDZ,
    getGLBBlob: generateGLB,
    getSTLBlob: generateSTL,
    downloadPng: () => {
      if (rendererRef.current && sceneRef.current) {
        // Render one last time to ensure latest state
        rendererRef.current.render(sceneRef.current, rendererRef.current.camera);
        const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'fit-twin-mannequin.png';
        link.href = dataUrl;
        link.click();
      }
    },
    downloadObj: async () => {
      const blob = await generateOBJ();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'fit-twin-model.obj';
        link.href = url;
        link.click();
      }
    },
    downloadUSDZ: async () => {
      const blob = await generateUSDZ();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'fit-twin-model.usdz';
        link.href = url;
        link.click();
      }
    },
    downloadGLB: async () => {
      const blob = await generateGLB();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'fit-twin-model.glb';
        link.href = url;
        link.click();
      }
    },
    downloadSTL: async () => {
      const blob = await generateSTL();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'fit-twin-model.stl';
        link.href = url;
        link.click();
      }
    }
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    // Setup
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff); // White background for clean export
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 100, 300);
    camera.lookAt(0, 90, 0);
    
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      preserveDrawingBuffer: true 
    });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    (renderer as any).camera = camera; 

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 200, 100);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // --- BUILD MANNEQUIN ---
    const mannequinGroup = new THREE.Group();
    groupRef.current = mannequinGroup;
    scene.add(mannequinGroup);

    // Material
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xe2e8f0, 
      transparent: true, 
      opacity: 0.9,
      shininess: 30,
      flatShading: false,
    });
    
    // Helper to create body part
    const createPart = (geometry: THREE.BufferGeometry, y: number, name: string) => {
      const mesh = new THREE.Mesh(geometry, bodyMaterial);
      mesh.position.y = y;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = name;
      mannequinGroup.add(mesh);
      return mesh;
    };

    // Scale factors (Convert cm to world units, roughly 1 unit = 1 cm)
    // Height reference
    const h = stats.height;
    
    // 1. HEAD
    const headRadius = 12;
    const headY = h - headRadius;
    createPart(new THREE.SphereGeometry(headRadius, 32, 32), headY, 'head');

    // 2. NECK
    const neckRadius = (measurements.neck || 38) / (2 * Math.PI);
    const neckHeight = 10;
    const neckY = headY - headRadius - (neckHeight/2) + 2;
    createPart(new THREE.CylinderGeometry(neckRadius, neckRadius, neckHeight, 32), neckY, 'neck');

    // 3. TORSO
    // Shoulder
    const shoulderWidth = measurements.shoulder || 45;
    const shoulderY = neckY - (neckHeight/2) - 2;
    const yokeGeo = new THREE.CylinderGeometry(6, 6, shoulderWidth, 32);
    const yoke = new THREE.Mesh(yokeGeo, bodyMaterial);
    yoke.rotation.z = Math.PI / 2;
    yoke.position.y = shoulderY;
    yoke.name = 'shoulder_yoke';
    mannequinGroup.add(yoke);
    
    // Chest
    const chestRadius = (measurements.chest || 100) / (2 * Math.PI);
    const chestHeight = 25;
    const chestY = shoulderY - 10;
    createPart(new THREE.CylinderGeometry(chestRadius * 1.1, chestRadius * 0.9, chestHeight, 32), chestY, 'chest');

    // Waist
    const waistRadius = (measurements.waist || 80) / (2 * Math.PI);
    const waistHeight = 15;
    const waistY = chestY - (chestHeight/2) - (waistHeight/2);
    createPart(new THREE.CylinderGeometry(chestRadius * 0.9, waistRadius, waistHeight, 32), waistY, 'waist');

    // Hips
    const hipRadius = (measurements.hips || 95) / (2 * Math.PI);
    const hipHeight = 20;
    const hipY = waistY - (waistHeight/2) - (hipHeight/2);
    createPart(new THREE.CylinderGeometry(waistRadius, hipRadius, hipHeight, 32), hipY, 'hips');

    // 4. LEGS (Using Inseam)
    const legRadius = (measurements.thigh || 55) / (2 * Math.PI);
    const calfRadius = (measurements.calf || 38) / (2 * Math.PI);
    const ankleRadius = (measurements.ankle || 25) / (2 * Math.PI);
    const legLength = measurements.inseam || 75;
    const legSpacing = hipRadius * 0.8;

    const createLeg = (xDir: number) => {
      // Thigh
      const thighLen = legLength * 0.5;
      const thighY = hipY - (hipHeight/2) - (thighLen/2);
      const thighGeo = new THREE.CylinderGeometry(legRadius, calfRadius * 1.1, thighLen, 24);
      const thigh = createPart(thighGeo, thighY, 'thigh');
      thigh.position.x = xDir * legSpacing;

      // Knee (Joint)
      const kneeY = thighY - (thighLen/2);
      const knee = new THREE.Mesh(new THREE.SphereGeometry(calfRadius * 1.1, 16, 16), bodyMaterial);
      knee.position.set(xDir * legSpacing, kneeY, 0);
      knee.name = 'knee';
      mannequinGroup.add(knee);

      // Calf/Shin
      const shinLen = legLength * 0.5;
      const shinY = kneeY - (shinLen/2);
      const shinGeo = new THREE.CylinderGeometry(calfRadius * 1.1, ankleRadius, shinLen, 24);
      const shin = createPart(shinGeo, shinY, 'shin');
      shin.position.x = xDir * legSpacing;
    };

    createLeg(1);  // Right Leg
    createLeg(-1); // Left Leg

    // 5. ARMS
    const armRadius = (measurements.bicep || 35) / (2 * Math.PI);
    const forearmRadius = (measurements.wrist || 17) / (2 * Math.PI) * 1.5;
    const armLength = measurements.sleeve || 60; 
    
    const createArm = (xDir: number) => {
      const startX = (xDir * shoulderWidth/2);
      const startY = shoulderY;
      
      // Upper Arm
      const upperLen = armLength * 0.45;
      const angle = 0.3 * xDir; // radians
      
      const upperGeo = new THREE.CylinderGeometry(armRadius, armRadius * 0.8, upperLen, 24);
      const upperArm = new THREE.Mesh(upperGeo, bodyMaterial);
      upperArm.position.y = -upperLen/2; 
      upperArm.name = 'upperArm';
      
      const upperGroup = new THREE.Group();
      upperGroup.position.set(startX, startY, 0);
      upperGroup.rotation.z = -angle;
      upperGroup.add(upperArm);
      mannequinGroup.add(upperGroup);

      // Forearm
      const lowerLen = armLength * 0.55;
      const elbowY = -upperLen;
      
      const lowerGeo = new THREE.CylinderGeometry(armRadius * 0.8, forearmRadius, lowerLen, 24);
      const lowerArm = new THREE.Mesh(lowerGeo, bodyMaterial);
      lowerArm.position.y = -lowerLen/2;
      lowerArm.name = 'lowerArm';
      
      const lowerGroup = new THREE.Group();
      lowerGroup.position.set(0, elbowY, 0);
      lowerGroup.rotation.z = -0.1 * xDir; 
      upperGroup.add(lowerGroup);
      lowerGroup.add(lowerArm);
    };

    createArm(1);
    createArm(-1);

    // Floor
    const gridHelper = new THREE.GridHelper(200, 20, 0xddd6fe, 0xf1f5f9);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Animation Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      mannequinGroup.rotation.y += 0.002; // Slow rotation
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      renderer.dispose();
    };
  }, [measurements, stats]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px] bg-white rounded-xl overflow-hidden cursor-move" />
  );
});

BodyVisualizer.displayName = "BodyVisualizer";