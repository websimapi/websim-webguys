import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, webguy, pedestal, controls;
let bodyMaterial, gridHelper;
let isEditorMode = false;
const clock = new THREE.Clock();
const room = new WebsimSocket();

const blinkState = {
    isBlinking: false,
    isDoubleBlink: Math.random() < 1/8,
    doubleBlinkSecond: false,
    startTime: 0,
    duration: 0.15, // Blink lasts 150ms
    // Set initial blink time
    nextBlinkTime: 3 + Math.random() * 9,
};

async function main() {
    await room.initialize();

    // Update player UI with connected user's info
    const myInfo = room.peers[room.clientId];
    if (myInfo) {
        const playerAvatarElement = document.querySelector('.player-info .avatar');
        const playerNameElement = document.querySelector('.player-info span');
        playerNameElement.textContent = myInfo.username;
        if (playerAvatarElement) {
            playerAvatarElement.style.backgroundImage = `url(${myInfo.avatarUrl})`;
        }
    }

    init();
    initUI();
    animate();

    // Set initial color from presence or default
    const myPresence = room.presence[room.clientId] || {};
    const initialColor = myPresence.color || '#ff69b4';

    if (bodyMaterial) {
        bodyMaterial.color.set(initialColor);
    }
    document.querySelectorAll('.color-swatch.selected').forEach(s => s.classList.remove('selected'));
    const currentSwatch = document.querySelector(`.color-swatch[data-color="${initialColor}"]`);
    if (currentSwatch) {
        currentSwatch.classList.add('selected');
    }

    // Handle incoming presence updates (e.g. color changes) to sync state
    room.subscribePresence(presence => {
        const myNewPresence = presence[room.clientId];
        if (myNewPresence && myNewPresence.color) {
            // This will mainly handle updates from other devices for the same user
            if (bodyMaterial && bodyMaterial.color.getHexString() !== myNewPresence.color.substring(1)) {
                bodyMaterial.color.set(myNewPresence.color);
            
                document.querySelectorAll('.color-swatch.selected').forEach(s => s.classList.remove('selected'));
                const newSwatch = document.querySelector(`.color-swatch[data-color="${myNewPresence.color}"]`);
                if (newSwatch) {
                    newSwatch.classList.add('selected');
                }
            }
        }
    });
}

main();

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

function initUI() {
    const customizeBtn = document.getElementById('customize-btn');
    const backBtn = document.getElementById('back-btn');
    const mainMenu = document.getElementById('main-menu');
    const customizeScreen = document.getElementById('customize-screen');
    const colorSwatches = document.querySelectorAll('.color-swatch');

    customizeBtn.addEventListener('click', () => {
        mainMenu.classList.add('hidden');
        customizeScreen.classList.remove('hidden');
    });

    backBtn.addEventListener('click', () => {
        customizeScreen.classList.add('hidden');
        mainMenu.classList.remove('hidden');
    });

    colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            // Optimistic UI update for immediate feedback
            colorSwatches.forEach(s => s.classList.remove('selected'));
            swatch.classList.add('selected');

            // Change 3D model color
            const newColor = swatch.dataset.color;
            if (bodyMaterial) {
                bodyMaterial.color.set(newColor);
            }
            // Sync color with other players
            room.updatePresence({ color: newColor });
        });
    });

    // Level Editor UI Logic
    const levelEditorBtn = document.getElementById('level-editor-btn');
    const exitEditorBtn = document.getElementById('exit-editor-btn');
    
    levelEditorBtn.addEventListener('click', enterLevelEditor);
    exitEditorBtn.addEventListener('click', exitLevelEditor);
    
    const toolButtons = document.querySelectorAll('.tool-button');
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            toolButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            const tool = button.dataset.tool;
            console.log("Selected tool:", tool);
            // TODO: Add logic for tool change
        });
    });

    const paletteItems = document.querySelectorAll('.palette-item');
    paletteItems.forEach(item => {
        item.addEventListener('click', () => {
            paletteItems.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            const objectType = item.dataset.objectType;
            console.log("Selected object:", objectType);
            // TODO: Add logic for object selection
        });
    });
}

function enterLevelEditor() {
    isEditorMode = true;
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('customize-screen').classList.add('hidden');
    document.getElementById('level-editor-screen').classList.remove('hidden');

    // Change scene appearance for editor
    scene.background.set(0x444444);
    scene.fog = null;

    // Hide main menu 3D objects
    if (webguy) webguy.visible = false;
    if (pedestal) pedestal.visible = false;
    
    // Show editor specific 3D objects
    if (!gridHelper) {
        gridHelper = new THREE.GridHelper(50, 50, 0xffffff, 0xaaaaaa);
        gridHelper.material.opacity = 0.2;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);
    }
    gridHelper.visible = true;

    // Adjust camera and controls for editing
    controls.enablePan = true;
    controls.minDistance = 2;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.target.set(0, 0, 0);
}

function exitLevelEditor() {
    isEditorMode = false;
    document.getElementById('level-editor-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');

    // Revert scene appearance
    scene.background.set(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 10, 25);

    // Show main menu 3D objects
    if (webguy) webguy.visible = true;
    if (pedestal) pedestal.visible = true;

    // Hide editor specific 3D objects
    if (gridHelper) gridHelper.visible = false;

    // Revert camera and controls
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.target.set(0, 1.6, 0);

    // Restart clock for animations
    clock.start();
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

    bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff69b4, roughness: 0.7, metalness: 0.1 });

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

    // Store eyes for animation
    webguy.userData.leftEye = leftEye;
    webguy.userData.rightEye = rightEye;

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

function startBlink(currentTime) {
    blinkState.isBlinking = true;
    blinkState.startTime = currentTime;
}

function updateBlinkAnimation(currentTime) {
    if (!webguy || !webguy.userData.leftEye) return;

    const leftEye = webguy.userData.leftEye;
    const rightEye = webguy.userData.rightEye;
    
    const blinkProgress = (currentTime - blinkState.startTime) / blinkState.duration;

    if (blinkProgress < 1) {
        // Blink down and up using a sinusoidal wave for smooth animation
        const scaleY = 1.0 - Math.sin(blinkProgress * Math.PI);
        leftEye.scale.y = Math.max(0.05, scaleY); // Prevent scale from being 0
        rightEye.scale.y = Math.max(0.05, scaleY);
    } else {
        // Blink finished, reset scale
        leftEye.scale.y = 1;
        rightEye.scale.y = 1;
        blinkState.isBlinking = false;
        
        if (blinkState.isDoubleBlink && !blinkState.doubleBlinkSecond) {
            // This was the first blink of a double blink. Schedule the second.
            blinkState.doubleBlinkSecond = true;
            blinkState.nextBlinkTime = currentTime + 0.2; // 200ms for second blink
        } else {
            // Not a double blink, or it was the second of a double blink. Schedule next random blink.
            blinkState.isDoubleBlink = Math.random() < 1/8; // 1/8 chance for next one to be a double
            blinkState.doubleBlinkSecond = false;
            blinkState.nextBlinkTime = currentTime + 3 + Math.random() * 9; // 3 to 12 seconds from now
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    if (!isEditorMode) {
        const elapsedTime = clock.getElapsedTime();

        if (webguy) {
            // Bobbing the whole character group
            webguy.position.y = 0.5 + Math.sin(elapsedTime * 3) * 0.07;
            
            // Rotating the body inside the group
            const body = webguy.children[0];
            if(body) {
            body.rotation.y = Math.sin(elapsedTime * 0.7) * 0.3;
            }

            // Handle blinking
            if (!blinkState.isBlinking && elapsedTime >= blinkState.nextBlinkTime) {
                startBlink(elapsedTime);
            }
            if (blinkState.isBlinking) {
                updateBlinkAnimation(elapsedTime);
            }
        }
    }
    
    controls.update();
    renderer.render(scene, camera);
}