import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, webguy, pedestal, controls;
const clock = new THREE.Clock();

init();
animate();

function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 10, 25);

    // Renderer setup
    const container = document.getElementById('scene-container');
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    
    // Camera setup
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 2.5, 7);

    // Add a ground plane to receive shadows
    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2.5);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(3, 10, 7);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 5;
    dirLight.shadow.camera.bottom = -5;
    dirLight.shadow.camera.left = -5;
    dirLight.shadow.camera.right = 5;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 40;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Create Pedestal
    createPedestal();

    // Create Webguy
    createWebguy();

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 12;
    controls.minPolarAngle = Math.PI / 4;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.target.set(0, 1.6, 0);

    window.addEventListener('resize', onWindowResize, false);
}

function createPedestal() {
    const pedestalMaterial = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5, metalness: 0.2 });
    const pedestalGeo = new THREE.CylinderGeometry(1.5, 1.7, 0.5, 32);
    pedestal = new THREE.Mesh(pedestalGeo, pedestalMaterial);
    pedestal.position.y = 0.25;
    pedestal.receiveShadow = true;
    pedestal.castShadow = true;
    scene.add(pedestal);
}

function createWebguy() {
    webguy = new THREE.Group();
    scene.add(webguy);

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff69b4, roughness: 0.7, metalness: 0.1 });

    // Body (using a capsule shape)
    const bodyRadius = 0.7;
    const bodyHeight = 1.0;
    const bodyGeo = new THREE.CapsuleGeometry(bodyRadius, bodyHeight, 4, 16);
    const body = new THREE.Mesh(bodyGeo, bodyMaterial);
    body.position.y = 1.6;
    body.castShadow = true;
    webguy.add(body);

    // Faceplate
    const faceMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.1 });
    const faceGeo = new THREE.PlaneGeometry(0.8, 0.45);
    const face = new THREE.Mesh(faceGeo, faceMaterial);
    face.position.set(0, 0.2, bodyRadius - 0.001);
    body.add(face);
    
    // Eyes
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2 });
    const eyeGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMaterial);
    leftEye.position.set(-0.2, 0.0, 0.05);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMaterial);
    rightEye.position.set(0.2, 0.0, 0.05);
    face.add(leftEye, rightEye);

    // Arms
    const armGeo = new THREE.CapsuleGeometry(0.15, 0.6, 4, 8);
    const leftArm = new THREE.Mesh(armGeo, bodyMaterial);
    leftArm.position.set(-(bodyRadius * 0.8), 0.1, 0);
    leftArm.rotation.z = Math.PI / 2.5;
    leftArm.castShadow = true;
    body.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeo, bodyMaterial);
    rightArm.position.set(bodyRadius * 0.8, 0.1, 0);
    rightArm.rotation.z = -Math.PI / 2.5;
    rightArm.castShadow = true;
    body.add(rightArm);

    // Legs
    const legGeo = new THREE.CapsuleGeometry(0.25, 0.4, 4, 8);
    const leftLeg = new THREE.Mesh(legGeo, bodyMaterial);
    leftLeg.position.set(-0.3, -(bodyHeight/2 + 0.2), 0);
    leftLeg.castShadow = true;
    body.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, bodyMaterial);
    rightLeg.position.set(0.3, -(bodyHeight/2 + 0.2), 0);
    rightLeg.castShadow = true;
    body.add(rightLeg);

    webguy.position.y = 0.5; // Place on top of the pedestal
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    if (webguy) {
        // Bobbing the whole character group
        webguy.position.y = 0.5 + Math.sin(elapsedTime * 3) * 0.07;
        
        // Rotating the body inside the group
        const body = webguy.children[0];
        if(body) {
           body.rotation.y = Math.sin(elapsedTime * 0.7) * 0.3;
        }
    }
    
    controls.update();
    renderer.render(scene, camera);
}

