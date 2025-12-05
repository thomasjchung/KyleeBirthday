// Three.js Museum Gallery for Kylee's Birthday
// Constants
const MUSEUM_WIDTH = 20;
const MUSEUM_HEIGHT = 12;
const PAINTING_HEIGHT = 6;
const PAINTING_WIDTH = 4.5;
const PAINTING_SPACING = 10;
const ENTRANCE_Z = 0;
const WALK_SPEED = 10; // Increased speed
const firstPaintingOffset = 8; // First painting offset from front wall

// Scene setup
let scene, camera, renderer;
let characterZ = ENTRANCE_Z - 5; // Start character outside
let characterX = 0;
let moveForward = false;
let moveBackward = false;
let euler = new THREE.Euler(0, 0, 0, 'YXZ');
let paintings = [];
let paintingGroups = [];
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let hoveredPainting = null;
let expandedNote = null; // Track if a note is expanded
let lastPaintingZ = 0; // Track last painting position for back wall

// Movement bounds
const MIN_Z = ENTRANCE_Z - 8;
let MAX_Z = ENTRANCE_Z - 5 + 200; // Allow movement far into museum (will be updated after paintings load)

// Initialize
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    scene.fog = new THREE.Fog(0xffffff, 50, 200);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, characterZ); // Eye level height
    euler.setFromQuaternion(camera.quaternion);

    // Create renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Create museum
        createMuseumInterior();
    createMuseumExterior();

    // Setup controls
    setupControls();
    
    // Setup note expansion
    setupNoteExpansion();

    // Load paintings
    loadPaintings();

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Start animation
    animate();
}

function createMuseumInterior() {
    const museumStartZ = ENTRANCE_Z - 5 - 8; // Push front wall 8 units further
    const museumEndZ = ENTRANCE_Z - 5 + 200;
    const actualMuseumLength = museumEndZ - museumStartZ;
    const museumCenterZ = (museumStartZ + museumEndZ) / 2;

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(MUSEUM_WIDTH, actualMuseumLength);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x8b774d,
        roughness: 0.8,
        metalness: 0.0
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = museumCenterZ;
    floor.receiveShadow = true;
    scene.add(floor);

    // Red carpet in the middle
    const carpetWidth = 4;
    const carpetY = 0.01;
    const redCarpetMaterial = new THREE.MeshStandardMaterial({
        color: 0xDC143C,
        roughness: 0.9,
        metalness: 0.0
    });
    const redCarpetGeometry = new THREE.PlaneGeometry(carpetWidth, actualMuseumLength);
    const redCarpet = new THREE.Mesh(redCarpetGeometry, redCarpetMaterial);
    redCarpet.rotation.x = -Math.PI / 2;
    redCarpet.position.y = carpetY;
    redCarpet.position.z = museumCenterZ;
    scene.add(redCarpet);

    // Yellow border on left side
    const yellowBorderWidth = 0.3;
    const yellowMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFD700,
        roughness: 0.9,
        metalness: 0.0
    });
    const yellowLeftGeometry = new THREE.PlaneGeometry(yellowBorderWidth, actualMuseumLength);
    const yellowLeft = new THREE.Mesh(yellowLeftGeometry, yellowMaterial);
    yellowLeft.rotation.x = -Math.PI / 2;
    yellowLeft.position.set(-carpetWidth / 2 - yellowBorderWidth / 2, carpetY, museumCenterZ);
    scene.add(yellowLeft);

    // Yellow border on right side
    const yellowRightGeometry = new THREE.PlaneGeometry(yellowBorderWidth, actualMuseumLength);
    const yellowRight = new THREE.Mesh(yellowRightGeometry, yellowMaterial);
    yellowRight.rotation.x = -Math.PI / 2;
    yellowRight.position.set(carpetWidth / 2 + yellowBorderWidth / 2, carpetY, museumCenterZ);
    scene.add(yellowRight);

    // Left wall
    const leftWallGeometry = new THREE.PlaneGeometry(actualMuseumLength, MUSEUM_HEIGHT);
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x3e6246,
        roughness: 0.7,
        metalness: 0.0
    });
    const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-MUSEUM_WIDTH / 2, MUSEUM_HEIGHT / 2, museumCenterZ);
    scene.add(leftWall);

    // Right wall
    const rightWallGeometry = new THREE.PlaneGeometry(actualMuseumLength, MUSEUM_HEIGHT);
    const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(MUSEUM_WIDTH / 2, MUSEUM_HEIGHT / 2, museumCenterZ);
    scene.add(rightWall);
    
    // Front wall (matches side wall color)
    const frontWallGeometry = new THREE.BoxGeometry(MUSEUM_WIDTH, MUSEUM_HEIGHT, 0.5);
    const frontWallMaterial = new THREE.MeshStandardMaterial({
        color: 0x3e6246,
        roughness: 0.7,
        metalness: 0.0
    });
    const frontWall = new THREE.Mesh(frontWallGeometry, frontWallMaterial);
    frontWall.position.set(0, MUSEUM_HEIGHT / 2, museumStartZ);
    scene.add(frontWall);
    
    // Back wall (matches side wall color) - will be repositioned after paintings load
    const backWallZ = museumEndZ;
    const backWallGeometry = new THREE.BoxGeometry(MUSEUM_WIDTH, MUSEUM_HEIGHT, 0.5);
    const backWallMaterial = new THREE.MeshStandardMaterial({
        color: 0x3e6246,
        roughness: 0.7,
        metalness: 0.0
    });
    const backWall = new THREE.Mesh(backWallGeometry, backWallMaterial);
    backWall.position.set(0, MUSEUM_HEIGHT / 2, backWallZ);
    scene.add(backWall);
    // Store reference to update position later
    scene.userData.backWall = backWall;
    
    // Ceiling
    const ceilingGeometry = new THREE.PlaneGeometry(MUSEUM_WIDTH, actualMuseumLength);
    const ceilingMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFFE4,
        roughness: 0.7,
        metalness: 0.0
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, MUSEUM_HEIGHT, museumCenterZ);
    scene.add(ceiling);

    // Crown molding (matches column color)
    const crownMoldingMaterial = new THREE.MeshStandardMaterial({
        color: 0x9a8b7a,
        roughness: 0.7,
        metalness: 0.0
    });
    const moldingLength = actualMuseumLength;
    const moldingWidth = MUSEUM_WIDTH;
    const moldingHeight = 0.4;
    const moldingDepth = 0.3;

    // Left wall crown molding
    const leftCrownGeometry = new THREE.BoxGeometry(moldingDepth, moldingHeight, moldingLength);
    const leftCrown = new THREE.Mesh(leftCrownGeometry, crownMoldingMaterial);
    leftCrown.position.set(-MUSEUM_WIDTH / 2 + moldingDepth / 2, MUSEUM_HEIGHT - moldingHeight / 2, museumCenterZ);
    scene.add(leftCrown);

    // Right wall crown molding
    const rightCrownGeometry = new THREE.BoxGeometry(moldingDepth, moldingHeight, moldingLength);
    const rightCrown = new THREE.Mesh(rightCrownGeometry, crownMoldingMaterial);
    rightCrown.position.set(MUSEUM_WIDTH / 2 - moldingDepth / 2, MUSEUM_HEIGHT - moldingHeight / 2, museumCenterZ);
    scene.add(rightCrown);

    // Front wall crown molding
    const frontCrownGeometry = new THREE.BoxGeometry(moldingWidth, moldingHeight, moldingDepth);
    const frontCrown = new THREE.Mesh(frontCrownGeometry, crownMoldingMaterial);
    frontCrown.position.set(0, MUSEUM_HEIGHT - moldingHeight / 2, museumStartZ + moldingDepth / 2);
    scene.add(frontCrown);

    // Back wall crown molding - will be repositioned after paintings load
    const backCrownGeometry = new THREE.BoxGeometry(moldingWidth, moldingHeight, moldingDepth);
    const backCrown = new THREE.Mesh(backCrownGeometry, crownMoldingMaterial);
    backCrown.position.set(0, MUSEUM_HEIGHT - moldingHeight / 2, backWallZ - moldingDepth / 2);
    scene.add(backCrown);
    // Store reference to update position later
    scene.userData.backCrown = backCrown;

    // Invisible boundary walls
    const boundaryExtension = 10;
    const boundaryHeight = MUSEUM_HEIGHT + 5;
    const boundaryMaterial = new THREE.MeshBasicMaterial({
        color: scene.background,
        transparent: true,
        opacity: 0
    });

    const leftBoundary = new THREE.Mesh(
        new THREE.PlaneGeometry(boundaryExtension, boundaryHeight),
        boundaryMaterial
    );
    leftBoundary.rotation.y = Math.PI / 2;
    leftBoundary.position.set(-MUSEUM_WIDTH / 2 - boundaryExtension / 2, boundaryHeight / 2, museumCenterZ);
    scene.add(leftBoundary);

    const rightBoundary = new THREE.Mesh(
        new THREE.PlaneGeometry(boundaryExtension, boundaryHeight),
        boundaryMaterial
    );
    rightBoundary.rotation.y = -Math.PI / 2;
    rightBoundary.position.set(MUSEUM_WIDTH / 2 + boundaryExtension / 2, boundaryHeight / 2, museumCenterZ);
    scene.add(rightBoundary);

    const frontBoundary = new THREE.Mesh(
        new THREE.PlaneGeometry(MUSEUM_WIDTH + boundaryExtension * 2, boundaryHeight),
        boundaryMaterial
    );
    frontBoundary.position.set(0, boundaryHeight / 2, museumStartZ - boundaryExtension / 2);
    scene.add(frontBoundary);

    // Back boundary - will be repositioned after paintings load
    const backBoundary = new THREE.Mesh(
        new THREE.PlaneGeometry(MUSEUM_WIDTH + boundaryExtension * 2, boundaryHeight),
        boundaryMaterial
    );
    backBoundary.position.set(0, boundaryHeight / 2, museumEndZ + boundaryExtension / 2);
    scene.add(backBoundary);
    // Store reference to update position later
    scene.userData.backBoundary = backBoundary;
}

function createMuseumExterior() {
    // Create two doors on the exterior of the front wall
    const museumStartZ = ENTRANCE_Z - 5 - 8; // Match front wall position
    const doorWidth = 1.6;
    const doorHeight = 4;
    const doorDepth = 0.2;
    const doorSpacing = 0;

    const doorFrameMaterial = new THREE.MeshStandardMaterial({
        color: 0x654321,
        roughness: 0.8,
        metalness: 0.0
    });

    const doorPanelMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513,
        roughness: 0.7,
        metalness: 0.0
    });
    
    const doorknobMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFD700,
        roughness: 0.3,
        metalness: 0.8
    });

    function createDoor(xPosition, doorknobOnRight = false) {
        const doorGroup = new THREE.Group();

        // Door frame
        const frameDepth = 0.1;
        const frameWidth = doorWidth + 0.2;
        const frameHeight = doorHeight + 0.2;
        const frameGeometry = new THREE.BoxGeometry(frameWidth, frameHeight, frameDepth);
        const frame = new THREE.Mesh(frameGeometry, doorFrameMaterial);
        frame.position.z = -doorDepth / 2 - frameDepth / 2;
        doorGroup.add(frame);

        // Door panel
        const panelGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, doorDepth);
        const panel = new THREE.Mesh(panelGeometry, doorPanelMaterial);
        doorGroup.add(panel);

        // Recessed panels (decorative)
        const panelWidth = doorWidth * 0.6;
        const panelHeight = doorHeight * 0.3;
        const panelDepth = 0.05;
        const topPanelGeometry = new THREE.BoxGeometry(panelWidth, panelHeight, panelDepth);
        const topPanel = new THREE.Mesh(topPanelGeometry, doorPanelMaterial);
        topPanel.position.set(0, doorHeight * 0.25, doorDepth / 2 - panelDepth / 2);
        doorGroup.add(topPanel);

        const bottomPanelGeometry = new THREE.BoxGeometry(panelWidth, panelHeight, panelDepth);
        const bottomPanel = new THREE.Mesh(bottomPanelGeometry, doorPanelMaterial);
        bottomPanel.position.set(0, -doorHeight * 0.25, doorDepth / 2 - panelDepth / 2);
        doorGroup.add(bottomPanel);

        // Doorknob
        const doorknobRadius = 0.06;
        const doorknobHeight = 0.08;
        const doorknobOffset = 0.15;
        const doorknob = new THREE.Mesh(
            new THREE.CylinderGeometry(doorknobRadius, doorknobRadius, doorknobHeight, 16),
            doorknobMaterial
        );
        doorknob.rotation.z = Math.PI / 2;
        const doorknobX = doorknobOnRight
            ? (doorWidth / 2 - doorknobOffset)
            : (-doorWidth / 2 + doorknobOffset);
        doorknob.position.set(doorknobX, 0, -doorDepth / 2 - 0.04);
        doorGroup.add(doorknob);

        doorGroup.position.set(xPosition, doorHeight / 2, museumStartZ + 0.25 + doorDepth / 2);
        doorGroup.rotation.y = Math.PI;
        scene.add(doorGroup);
    }

    const leftDoorX = -doorWidth / 2;
    const rightDoorX = doorWidth / 2;

    createDoor(leftDoorX, true); // Left door, doorknob on right
    createDoor(rightDoorX, false); // Right door, doorknob on left
}

function createDoricColumn(zPos, isLeftWall = false) {
    const columnGroup = new THREE.Group();
    const columnMaterial = new THREE.MeshStandardMaterial({
        color: 0x9a8b7a,
        roughness: 0.7,
        metalness: 0.0
    });

    const columnRadius = 0.4;
    const columnHeight = MUSEUM_HEIGHT - 1;
    const baseTopRadius = 0.6;
    const baseBottomRadius = 0.8;
    const baseHeight = 0.5;

    // Bottom base (trapezoidal)
    const bottomBaseGeometry = new THREE.CylinderGeometry(
        baseTopRadius,
        baseBottomRadius,
        baseHeight,
        16
    );
    const bottomBase = new THREE.Mesh(bottomBaseGeometry, columnMaterial);
    bottomBase.position.y = baseHeight / 2;
    columnGroup.add(bottomBase);

    // Pillar (fluted cylinder)
    const pillarGeometry = new THREE.CylinderGeometry(columnRadius, columnRadius, columnHeight, 16);
    const pillar = new THREE.Mesh(pillarGeometry, columnMaterial);
    pillar.position.y = baseHeight + columnHeight / 2;
    columnGroup.add(pillar);

    // Top base (trapezoidal)
    const topBaseGeometry = new THREE.CylinderGeometry(
        baseBottomRadius,
        baseTopRadius,
        baseHeight,
        16
    );
    const topBase = new THREE.Mesh(topBaseGeometry, columnMaterial);
    topBase.position.y = baseHeight + columnHeight + baseHeight / 2;
    columnGroup.add(topBase);

    const wallX = isLeftWall ? -MUSEUM_WIDTH / 2 : MUSEUM_WIDTH / 2;
    const columnX = isLeftWall ? wallX + columnRadius / 2 : wallX - columnRadius / 2;
    columnGroup.position.set(columnX, 0, zPos);
    scene.add(columnGroup);
}

function createPaintingAtZ(zPos, imagePath, notePath, isLeftWall, index) {
    const paintingGroup = new THREE.Group();
    const frameBorder = 0.3;

    const textureLoader = new THREE.TextureLoader();
    
    // Frame
    const frameGeometry = new THREE.BoxGeometry(
        PAINTING_WIDTH + frameBorder * 2,
        PAINTING_HEIGHT + frameBorder * 2,
        0.2
    );
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513,
        roughness: 0.6,
        metalness: 0.2
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    paintingGroup.add(frame);

    // Load texture first, then create canvas with texture
    textureLoader.load(
                    imagePath,
                    (texture) => {
                            texture.colorSpace = THREE.SRGBColorSpace;
            texture.flipY = false;
            // Optimize texture settings to reduce memory usage
                            texture.minFilter = THREE.LinearFilter;
                            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
            
            console.log(`[IMAGE] Successfully loaded ${imagePath}`);
            
            // Calculate aspect ratio and scale to maintain proportions
            const imageAspect = texture.image.width / texture.image.height;
            const baseHeight = PAINTING_HEIGHT * 1.5; // 1.5x bigger
            const actualWidth = baseHeight * imageAspect;
            const actualHeight = baseHeight;
            
            // Create canvas geometry with correct size
            const canvasGeometry = new THREE.PlaneGeometry(actualWidth, actualHeight);
            
            // Create material with texture (use BasicMaterial to reduce texture units and avoid lighting calculations)
            const paintingMaterial = new THREE.MeshBasicMaterial({
                map: texture,
            side: THREE.DoubleSide
        });
            
            const canvas = new THREE.Mesh(canvasGeometry, paintingMaterial);
            canvas.position.z = 0.11;
            canvas.rotation.z = Math.PI; // Rotate 180 degrees
            paintingGroup.add(canvas);
            
            // Update frame to match canvas size
            frame.geometry.dispose();
            frame.geometry = new THREE.BoxGeometry(
                actualWidth + frameBorder * 2,
                actualHeight + frameBorder * 2,
                0.2
            );
            
            // Store canvas reference
            paintingGroup.userData.canvas = canvas;
            
            // Load note if it exists
            if (notePath) {
                textureLoader.load(
                    notePath,
                    (noteTexture) => {
                        noteTexture.colorSpace = THREE.SRGBColorSpace;
                        noteTexture.flipY = false; // Don't flip Y, we'll rotate the mesh instead
                        noteTexture.minFilter = THREE.LinearFilter;
                        noteTexture.magFilter = THREE.LinearFilter;
                        noteTexture.generateMipmaps = false;
                        
                        // Get actual canvas dimensions
                        const canvasWidth = actualWidth;
                        const canvasHeight = actualHeight;
                        
                        // Calculate aspect ratio for note
                        const noteAspect = noteTexture.image.width / noteTexture.image.height;
                        const frameAspect = canvasWidth / canvasHeight;
                        
                        let noteWidth, noteHeight;
                        if (noteAspect > frameAspect) {
                            // Note is wider - fit to width
                            noteWidth = canvasWidth * 0.9;
                            noteHeight = noteWidth / noteAspect;
            } else {
                            // Note is taller - fit to height
                            noteHeight = canvasHeight * 0.9;
                            noteWidth = noteHeight * noteAspect;
                        }
                        
                        const noteGeometry = new THREE.PlaneGeometry(noteWidth, noteHeight);
                        // Mirror the note by flipping texture horizontally
                        noteTexture.wrapS = THREE.RepeatWrapping;
                        noteTexture.wrapT = THREE.RepeatWrapping;
                        noteTexture.repeat.x = -1; // Flip horizontally
                        noteTexture.offset.x = 1; // Offset to show the flipped texture
                        
                        const noteMaterial = new THREE.MeshBasicMaterial({
                            map: noteTexture,
                            side: THREE.DoubleSide
                        });
                        const noteMesh = new THREE.Mesh(noteGeometry, noteMaterial);
                        noteMesh.position.z = 0.11;
                        // Rotate note 180 degrees around Z axis
                        noteMesh.rotation.z = Math.PI;
                        noteMesh.visible = false; // Hidden initially
                        paintingGroup.add(noteMesh);
                        paintingGroup.userData.noteMesh = noteMesh;
                        paintingGroup.userData.notePath = notePath; // Store note path for expansion
                    },
                    undefined,
                    (error) => {
                        // Note not found, that's okay
                    }
                );
            }
            
            console.log(`[PAINTING] Loaded texture for ${imagePath}: ${texture.image.width}x${texture.image.height}`);
        },
        undefined,
        (error) => {
            console.error(`[PAINTING] Failed to load image: ${imagePath}`, error);
        }
    );

    // Position painting (centered on wall)
    const wallX = isLeftWall ? -MUSEUM_WIDTH / 2 : MUSEUM_WIDTH / 2;
    paintingGroup.position.set(wallX, MUSEUM_HEIGHT / 2, zPos);
    paintingGroup.rotation.y = isLeftWall ? Math.PI / 2 : -Math.PI / 2;

    // Store references (canvas will be set in texture callback)
    paintingGroup.userData = {
        index: index
    };

    scene.add(paintingGroup);
    paintings.push(paintingGroup);
    paintingGroups.push(paintingGroup);

    return paintingGroup;
}

function setupMuseumLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(0, MUSEUM_HEIGHT, 0);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Spotlights for each painting
    paintings.forEach((painting, index) => {
        const paintingZ = painting.position.z;
        const isLeftWall = painting.position.x < 0;
        const wallX = isLeftWall ? -MUSEUM_WIDTH / 2 : MUSEUM_WIDTH / 2;

        // Spotlight
        const spotLight = new THREE.SpotLight(0xFFF4D1, 2, 20, Math.PI / 6, 0.3, 2);
        spotLight.position.set(wallX, MUSEUM_HEIGHT - 1, paintingZ);
        spotLight.target.position.set(wallX, MUSEUM_HEIGHT / 2, paintingZ);
        spotLight.castShadow = true;
        scene.add(spotLight);
        scene.add(spotLight.target);

        // Visible light fixture (bulb)
        const bulbGeometry = new THREE.SphereGeometry(0.25, 12, 12);
        const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0xFFF4D1 });
        const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
        bulb.position.copy(spotLight.position);
        scene.add(bulb);

        // Lamp can (cylinder)
        const lampCanGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.5, 8);
        const lampCanMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const lampCan = new THREE.Mesh(lampCanGeometry, lampCanMaterial);
        lampCan.position.copy(spotLight.position);
        lampCan.position.y += 0.25 + 0.25;
        scene.add(lampCan);

        // Visible light rays (three faint cylinders)
        const from = spotLight.position.clone();
        const to = spotLight.target.position.clone();
        const dir = to.clone().sub(from);
        const length = dir.length();
        if (length > 0.0001) {
            dir.normalize();
            const rayRadius = 0.1;
            const raySpread = 1.5;

            for (let r = 0; r < 3; r++) {
                const rayGeometry = new THREE.CylinderGeometry(rayRadius, rayRadius, length, 8);
                const rayMaterial = new THREE.MeshBasicMaterial({
                    color: 0xFFF4D1,
                    transparent: true,
                    opacity: 0.05,
                    side: THREE.DoubleSide
                });
                const ray = new THREE.Mesh(rayGeometry, rayMaterial);
                ray.position.copy(from.clone().add(dir.clone().multiplyScalar(length / 2)));
                const up = new THREE.Vector3(0, 1, 0);
                const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
                ray.quaternion.copy(quat);
                const angleOffset = (r - 1) * (Math.PI / 12) * raySpread;
                ray.rotateY(angleOffset);
                scene.add(ray);
            }
        }
    });
}

function loadPaintings() {
    const imageNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    // Map of image numbers to their actual file extensions
    const imageExtensions = {
        1: 'jpeg', 2: 'jpeg', 3: 'jpeg', 4: 'jpg', 5: 'png',
        6: 'jpg', 7: 'jpeg', 8: 'jpeg', 9: 'png', 10: 'jpeg',
        11: 'jpeg', 12: 'jpeg', 13: 'jpeg', 14: 'png', 15: 'png'
    };
    // Map of note numbers to their actual file extensions (only for notes that exist)
    const noteExtensions = {
        1: 'jpg', 3: 'jpeg', 4: 'jpg', 5: 'png',
        6: 'jpg', 7: 'jpg', 8: 'jpg', 9: 'jpg',
        10: 'png', 11: 'jpeg', 12: 'jpg', 13: 'jpg',
        14: 'jpeg', 15: 'png'
    };

    setTimeout(() => {
        console.log('[SETUP] Creating paintings...');
        const frontSpace = 2;
        
        imageNumbers.forEach((num, index) => {
            const isLeftWall = index % 2 === 0;
            const paintingZ = ENTRANCE_Z - 10 - frontSpace + firstPaintingOffset + index * PAINTING_SPACING;
            
            // Track last painting position
            if (index === imageNumbers.length - 1) {
                lastPaintingZ = paintingZ;
            }
            
            // Use the correct extension for each image
            const imageExt = imageExtensions[num] || 'jpeg';
            let imagePath = `images/image${num}.${imageExt}`;
            
            // Get note path if note exists
            let notePath = null;
            if (noteExtensions[num]) {
                notePath = `notes/notes${num}.${noteExtensions[num]}`;
            }

            console.log(`[PAINTING] Creating painting ${index} at Z=${paintingZ.toFixed(2)}, image=${imagePath}, note=${notePath || 'none'}`);
            createPaintingAtZ(paintingZ, imagePath, notePath, isLeftWall, index);

            // Add columns between consecutive paintings on the same wall
            const nextIndex = index + 2;
            if (nextIndex < imageNumbers.length) {
                const nextIsLeftWall = nextIndex % 2 === 0;
                const isLeftWall = index % 2 === 0;
                if (nextIsLeftWall === isLeftWall) {
                    const nextZ = ENTRANCE_Z - 10 - frontSpace + firstPaintingOffset + nextIndex * PAINTING_SPACING;
                    const columnZ = (paintingZ + nextZ) / 2;
                    console.log(`[COLUMNS] Creating column between paintings ${index} and ${nextIndex} at Z=${columnZ.toFixed(2)}, side=${isLeftWall ? 'left' : 'right'}`);
                    createDoricColumn(columnZ, isLeftWall);
                }
            }
        });

        // Update back wall position to be just past the last painting
        if (scene.userData.backWall) {
            const backWallOffset = 5; // Space past last painting
            const newBackWallZ = lastPaintingZ + backWallOffset;
            scene.userData.backWall.position.z = newBackWallZ;
            console.log(`[SETUP] Back wall repositioned to Z=${newBackWallZ.toFixed(2)} (last painting at Z=${lastPaintingZ.toFixed(2)})`);
            
            // Update back crown molding position
            if (scene.userData.backCrown) {
                const moldingDepth = 0.3;
                scene.userData.backCrown.position.z = newBackWallZ - moldingDepth / 2;
            }
            
            // Update back boundary position (with buffer to prevent going through)
            if (scene.userData.backBoundary) {
                const boundaryExtension = 10;
                const boundaryBuffer = 2; // Extra buffer so user can't go halfway through
                scene.userData.backBoundary.position.z = newBackWallZ + boundaryExtension / 2 + boundaryBuffer;
            }
            
            // Update MAX_Z movement bound to prevent going through back wall
            const boundaryExtension = 10;
            const boundaryBuffer = 2;
            MAX_Z = newBackWallZ + boundaryExtension / 2 + boundaryBuffer - 1; // -1 for safety margin
            console.log(`[SETUP] Movement bound updated to MAX_Z=${MAX_Z.toFixed(2)}`);
        }

        // Setup lighting after paintings are created
        setupMuseumLighting();
        console.log('[SETUP] Museum setup complete!');
            }, 100);
}

function setupControls() {
    const instructions = document.getElementById('instructions');
    let isMouseOverCanvas = false;

    // Hide instructions when mouse enters canvas
    renderer.domElement.addEventListener('mouseenter', () => {
        isMouseOverCanvas = true;
        instructions.classList.add('hidden');
    });

    renderer.domElement.addEventListener('mouseleave', () => {
        isMouseOverCanvas = false;
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
                moveForward = true;
        }
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
                moveBackward = true;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
                moveForward = false;
        }
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
                moveBackward = false;
        }
    });

    // Mouse look with pointer lock (FPS-style, like Call of Duty/Fortnite)
    let mouseSensitivity = 0.002; // Adjustable sensitivity
    
    // Click to lock pointer or expand note
    renderer.domElement.addEventListener('click', (e) => {
        // If pointer is already locked, check for note expansion
        if (document.pointerLockElement === renderer.domElement) {
            handleNoteClick();
        } else {
            // First click - request pointer lock
            renderer.domElement.requestPointerLock();
        }
    });
    
    // Handle pointer lock changes
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === renderer.domElement) {
            instructions.classList.add('hidden');
        } else {
            instructions.classList.remove('hidden');
        }
    });
    
    // Mouse look using pointer lock movement
    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === renderer.domElement) {
            const movementX = e.movementX || 0;
            const movementY = e.movementY || 0;

            euler.setFromQuaternion(camera.quaternion);
            euler.y -= movementX * mouseSensitivity;
            euler.x -= movementY * mouseSensitivity;
            euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
            camera.quaternion.setFromEuler(euler);
        }
    });

    // Mouse hover for paintings - check center of screen when pointer locked
    function checkHover() {
        // Use center of screen when pointer locked, otherwise use actual mouse position
        if (document.pointerLockElement === renderer.domElement) {
            mouse.x = 0; // Center of screen
            mouse.y = 0; // Center of screen
        } else {
            // This won't be called when pointer locked, but keep for when unlocked
            return;
        }
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(paintings, true);
        
        // Reset previous hover
        if (hoveredPainting && hoveredPainting !== (intersects[0]?.object.parent || null)) {
            const prevGroup = hoveredPainting;
            if (prevGroup.userData.canvas) prevGroup.userData.canvas.visible = true;
            if (prevGroup.userData.noteMesh) prevGroup.userData.noteMesh.visible = false;
        }

        // Set new hover - switch to note if hovering
        if (intersects.length > 0) {
            const paintingGroup = intersects[0].object.parent;
            hoveredPainting = paintingGroup;
            // Hide image, show note if it exists
            if (paintingGroup.userData.canvas) paintingGroup.userData.canvas.visible = false;
            if (paintingGroup.userData.noteMesh) paintingGroup.userData.noteMesh.visible = true;
        } else {
            // Not hovering - show image, hide note
            if (hoveredPainting) {
                if (hoveredPainting.userData.canvas) hoveredPainting.userData.canvas.visible = true;
                if (hoveredPainting.userData.noteMesh) hoveredPainting.userData.noteMesh.visible = false;
            }
            hoveredPainting = null;
        }
    }
    
    // Check hover continuously when pointer is locked (but not when note is expanded)
    setInterval(() => {
        if (document.pointerLockElement === renderer.domElement && !expandedNote) {
            checkHover();
        }
    }, 100); // Check every 100ms
    
    // Click handler for note expansion
    function handleNoteClick() {
        if (expandedNote) return; // Already expanded
        
        // Check if hovering over a note
        let checkMouse = mouse;
        if (document.pointerLockElement === renderer.domElement) {
            checkMouse = new THREE.Vector2(0, 0); // Center of screen
        }
        raycaster.setFromCamera(checkMouse, camera);
        const intersects = raycaster.intersectObjects(paintings, true);
        
        if (intersects.length > 0) {
            const paintingGroup = intersects[0].object.parent;
            if (paintingGroup.userData.noteMesh && paintingGroup.userData.noteMesh.visible && paintingGroup.userData.notePath) {
                // Expand the note
                expandNote(paintingGroup.userData.notePath);
            }
        }
    }
    
    // Also check hover when pointer is not locked (using actual mouse position)
    renderer.domElement.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement !== renderer.domElement) {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(paintings, true);
            
            // Reset previous hover
            if (hoveredPainting && hoveredPainting !== (intersects[0]?.object.parent || null)) {
                const prevGroup = hoveredPainting;
                if (prevGroup.userData.canvas) prevGroup.userData.canvas.visible = true;
                if (prevGroup.userData.noteMesh) prevGroup.userData.noteMesh.visible = false;
            }

            // Set new hover
            if (intersects.length > 0) {
                const paintingGroup = intersects[0].object.parent;
                hoveredPainting = paintingGroup;
                if (paintingGroup.userData.canvas) paintingGroup.userData.canvas.visible = false;
                if (paintingGroup.userData.noteMesh) paintingGroup.userData.noteMesh.visible = true;
            } else {
                if (hoveredPainting) {
                    if (hoveredPainting.userData.canvas) hoveredPainting.userData.canvas.visible = true;
                    if (hoveredPainting.userData.noteMesh) hoveredPainting.userData.noteMesh.visible = false;
                }
                hoveredPainting = null;
            }
        }
    });
}

// Note expansion functions
function expandNote(notePath) {
    if (expandedNote) return; // Already expanded
    
    expandedNote = notePath;
    const expandedNoteDiv = document.getElementById('expanded-note');
    const expandedNoteImage = document.getElementById('expanded-note-image');
    
    if (expandedNoteDiv && expandedNoteImage) {
        expandedNoteImage.src = notePath;
        expandedNoteDiv.classList.add('active');
        
        // Exit pointer lock when expanding
        if (document.pointerLockElement === renderer.domElement) {
            document.exitPointerLock();
        }
    }
}

function closeNote() {
    if (!expandedNote) return;
    
    expandedNote = null;
    const expandedNoteDiv = document.getElementById('expanded-note');
    const expandedNoteImage = document.getElementById('expanded-note-image');
    
    if (expandedNoteDiv && expandedNoteImage) {
        expandedNoteDiv.classList.remove('active');
        expandedNoteImage.src = '';
    }
    
    // Automatically re-enter pointer lock to continue simulation
    if (renderer && renderer.domElement) {
        // Small delay to ensure the note is fully closed
        setTimeout(() => {
            renderer.domElement.requestPointerLock();
        }, 100);
    }
}

// Setup close button handler (works even if DOM is already loaded)
function setupNoteExpansion() {
    const closeButton = document.getElementById('close-note-button');
    if (closeButton) {
        closeButton.addEventListener('click', closeNote);
    }
    
    // Also close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && expandedNote) {
            closeNote();
        }
    });
}

// Setup when DOM is ready or immediately if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupNoteExpansion);
} else {
    setupNoteExpansion();
}

function animate() {
    requestAnimationFrame(animate);

    // Don't update movement or render when note is expanded
    if (expandedNote) {
        return;
    }

    // Movement
    const moveSpeed = WALK_SPEED * 0.02;
    if (moveForward) {
        characterZ += moveSpeed;
    }
    if (moveBackward) {
        characterZ -= moveSpeed;
    }

    // Clamp movement
    characterZ = Math.max(MIN_Z, Math.min(MAX_Z, characterZ));

    // Update camera position
    camera.position.z = characterZ;
    camera.position.x = characterX;
    camera.position.y = 5;

        renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start the application
    init();
