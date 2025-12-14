// Three.js Museum Gallery for Kylee's Birthday
// Constants
const MUSEUM_WIDTH = 20;
const MUSEUM_HEIGHT = 12;
const PAINTING_HEIGHT = 6;
const PAINTING_WIDTH = 4.5;
const PAINTING_SPACING = 10;
const ENTRANCE_Z = 0;
const WALK_SPEED = 15;
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
let currentRoom = 1; // Track which room we're in (1 = paintings 1-10, 2 = 11-20, etc.)
let doorGroup = null; // Reference to the back wall door group for hover detection
let frontDoorGroup = null; // Reference to the front wall door group for hover detection
let hoveredDoor = false; // Track if door is being hovered
let hoveredFrontDoor = false; // Track if front door is being hovered

// Movement bounds
const MIN_Z = ENTRANCE_Z - 8;
let MAX_Z = ENTRANCE_Z - 5 + 200; // Allow movement far into museum (will be updated after paintings load)

function removeAllLightingElements() {
    if (!scene) return;
    
    // Remove all rays, bulbs, spotlights, and lamp cans from the scene
    const objectsToRemove = [];
    
    // More aggressive cleanup - check all objects in scene
    scene.traverse((object) => {
        // Skip cameras, renderers, and painting groups
        if (object.type === 'PerspectiveCamera' || object.type === 'OrthographicCamera' || 
            object.isGroup && paintings.includes(object)) {
            return;
        }
        
        // Check if it's a ray (any geometry with yellow/cream transparent material)
        if (object.isMesh && object.material) {
            const material = Array.isArray(object.material) ? object.material[0] : object.material;
            if (material && material.color) {
                const colorHex = material.color.getHex();
                // Yellow/cream color (0xFFF4D1) - rays and bulbs
                if (colorHex === 0xFFF4D1 || colorHex === 0xfff4d1) {
                    objectsToRemove.push(object);
                }
                // Dark gray/black (0x333333) - lamp cans
                if (colorHex === 0x333333) {
                    objectsToRemove.push(object);
                }
            }
        }
        
        // Check if it's a spotlight or any light type
        if (object.type === 'SpotLight' || object.type === 'PointLight' || 
            object.type === 'DirectionalLight' || object.type === 'AmbientLight') {
            // Don't remove ambient or directional lights (general lighting)
            if (object.type === 'SpotLight' || object.type === 'PointLight') {
                objectsToRemove.push(object);
                // Also remove the target if it exists
                if (object.target) {
                    objectsToRemove.push(object.target);
                }
            }
        }
        
        // Check for Object3D targets (spotlight targets)
        if (object.type === 'Object3D' && object.parent && 
            object.parent.type === 'SpotLight') {
            objectsToRemove.push(object);
        }
    });
    
    // Remove all identified objects
    objectsToRemove.forEach(obj => {
        try {
            if (obj.parent) {
                obj.parent.remove(obj);
            } else {
                scene.remove(obj);
            }
            // Dispose of geometry and material if they exist
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(mat => {
                        if (mat.dispose) mat.dispose();
                    });
                } else {
                    if (obj.material.dispose) obj.material.dispose();
                }
            }
            if (obj.dispose) obj.dispose();
        } catch (e) {
            console.warn('Error removing lighting element:', e);
        }
    });
    
    // Also clean up any rays stored in painting userData
    paintings.forEach(painting => {
        if (painting.userData && painting.userData.rays) {
            painting.userData.rays.forEach(ray => {
                try {
                    if (ray.parent) {
                        ray.parent.remove(ray);
                    } else {
                        scene.remove(ray);
                    }
                    if (ray.geometry) ray.geometry.dispose();
                    if (ray.material) {
                        if (Array.isArray(ray.material)) {
                            ray.material.forEach(mat => {
                                if (mat.dispose) mat.dispose();
                            });
                        } else {
                            if (ray.material.dispose) ray.material.dispose();
                        }
                    }
                } catch (e) {
                    console.warn('Error removing ray:', e);
                }
            });
            painting.userData.rays = [];
        }
        // Clean up other lighting references
        delete painting.userData.bulbPosition;
        delete painting.userData.spotLight;
        delete painting.userData.lightZ;
    });
    
    console.log(`[CLEANUP] Removed ${objectsToRemove.length} lighting elements from scene`);
}

function setupMuseumLighting() {
    // Remove existing ambient and directional lights to prevent accumulation
    const lightsToRemove = [];
    scene.traverse((object) => {
        if (object.type === 'AmbientLight' || object.type === 'DirectionalLight') {
            lightsToRemove.push(object);
        }
    });
    lightsToRemove.forEach(light => {
        scene.remove(light);
        if (light.dispose) light.dispose();
    });
    
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, MUSEUM_HEIGHT, 0);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Spotlights for each painting
    paintings.forEach((painting, index) => {
        const paintingZ = painting.position.z;
        const paintingX = painting.position.x; // Use painting's actual X position for centering
        const isLeftWall = painting.position.x < 0;
        
        // Position light above the painting, slightly forward
        const lightForwardOffset = 0.8;
        const lightZ = paintingZ + lightForwardOffset;
        const lightHeight = MUSEUM_HEIGHT - 1;

        // Spotlight - positioned above the painting, centered on the painting
        const spotLight = new THREE.SpotLight(0xFFF4D1, 2, 20, Math.PI / 6, 0.3, 2);
        spotLight.position.set(paintingX, lightHeight, lightZ);
        spotLight.target.position.set(paintingX, MUSEUM_HEIGHT / 2, paintingZ);
        spotLight.castShadow = true;
        scene.add(spotLight);
        scene.add(spotLight.target);

        // Visible light fixture (bulb)
        const bulbGeometry = new THREE.SphereGeometry(0.25, 12, 12);
        const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0xFFF4D1 });
        const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
        bulb.position.set(paintingX, lightHeight, lightZ);
        scene.add(bulb);
        
        // Store bulb position for ray setup
        const bulbPosition = new THREE.Vector3(paintingX, lightHeight, lightZ);
        painting.userData.bulbPosition = bulbPosition;
        painting.userData.spotLight = spotLight;
        painting.userData.bulb = bulb; // Store bulb reference for later updates

        // Lamp can (cylinder)
        const lampCanGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.5, 8);
        const lampCanMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const lampCan = new THREE.Mesh(lampCanGeometry, lampCanMaterial);
        lampCan.position.set(paintingX, lightHeight + 0.5, lightZ);
        scene.add(lampCan);
        painting.userData.lampCan = lampCan; // Store lamp can reference for later updates

        // Three light rays from bulb that fan outwards to the edge of the painting
        // Wait for frame to be fully loaded
        const setupRays = () => {
            // Get bulb position
            const bulbPos = painting.userData.bulbPosition;
            if (!bulbPos) {
                console.warn('Bulb position not found');
                return;
            }
            
            // Get frame mesh from painting group
            let frameMesh = null;
            painting.children.forEach(child => {
                if (child.geometry && child.material && child.material.color && 
                    child.material.color.getHex() === 0x8B4513) { // Frame is brown
                    frameMesh = child;
                }
            });
            
            if (!frameMesh) {
                console.warn('Frame mesh not found, retrying...');
                setTimeout(setupRays, 100);
                return;
            }
            
            // Calculate frame bounding box in world coordinates
            frameMesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(frameMesh);
            const min = box.min;
            const max = box.max;
            const center = box.getCenter(new THREE.Vector3()); // Get actual center of bounding box
            
            // Get frame edge positions
            const topY = max.y;
            const bottomY = min.y;
            const frameHeight = topY - bottomY;
            
            // Position rays about a third of the way down from the top
            const rayY = topY - frameHeight / 3;
            
            // Determine painting orientation from its position
            const isLeftWall = painting.position.x < 0;
            // Left wall paintings are rotated 90° (PI/2), right wall are -90° (-PI/2)
            // For wall paintings, the frame extends along Z axis
            
            let targets;
            
            // Use actual center X from bounding box for more accurate centering
            const centerX = center.x;
            
            if (isLeftWall) {
                // Left wall: frame extends along Z axis
                // "Left" corner is at min.z, "right" corner is at max.z
                const leftZ = min.z;
                const rightZ = max.z;
                const centerZ = center.z; // Use actual center Z from bounding box
                targets = [
                    new THREE.Vector3(centerX, rayY, leftZ),      // Left edge, 1/3 down
                    new THREE.Vector3(centerX, rayY, centerZ),    // Center, 1/3 down
                    new THREE.Vector3(centerX, rayY, rightZ)        // Right edge, 1/3 down
                ];
            } else {
                // Right wall: frame extends along Z axis
                // "Left" corner is at max.z, "right" corner is at min.z (reversed)
                const leftZ = max.z;
                const rightZ = min.z;
                const centerZ = center.z; // Use actual center Z from bounding box
                targets = [
                    new THREE.Vector3(centerX, rayY, leftZ),      // Left edge, 1/3 down
                    new THREE.Vector3(centerX, rayY, centerZ),    // Center, 1/3 down
                    new THREE.Vector3(centerX, rayY, rightZ)       // Right edge, 1/3 down
                ];
            }
            
            // Update spotlight and bulb position to be above the center target
            const centerTarget = targets[1]; // Middle ray target (now using actual center)
            const lightHeight = MUSEUM_HEIGHT - 1;
            const lightForwardOffset = 0.3; // Small offset forward from the frame
            
            // Calculate new position above center target
            const newBulbPos = new THREE.Vector3(centerTarget.x, lightHeight, centerTarget.z + lightForwardOffset);
            
            // Update spotlight position to be above center target
            if (painting.userData.spotLight) {
                painting.userData.spotLight.position.set(newBulbPos.x, newBulbPos.y, newBulbPos.z);
                painting.userData.spotLight.target.position.set(centerTarget.x, MUSEUM_HEIGHT / 2, centerTarget.z);
            }
            
            // Update bulb position directly using stored reference
            if (painting.userData.bulb) {
                painting.userData.bulb.position.copy(newBulbPos);
            }
            
            // Update bulb position in userData
            painting.userData.bulbPosition = newBulbPos;
            
            // Update lamp can position directly using stored reference
            if (painting.userData.lampCan) {
                painting.userData.lampCan.position.set(newBulbPos.x, newBulbPos.y + 0.5, newBulbPos.z);
            }
            
            console.log(`[RAYS] Painting on ${isLeftWall ? 'left' : 'right'} wall`);
            console.log(`[RAYS] Frame Z range: ${min.z.toFixed(2)} to ${max.z.toFixed(2)}`);
            console.log(`[RAYS] Center target: (${centerTarget.x.toFixed(2)}, ${centerTarget.y.toFixed(2)}, ${centerTarget.z.toFixed(2)})`);
            console.log(`[RAYS] Updated bulb to: (${newBulbPos.x.toFixed(2)}, ${newBulbPos.y.toFixed(2)}, ${newBulbPos.z.toFixed(2)})`);
            console.log(`[RAYS] Targets: left=(${targets[0].x.toFixed(2)}, ${targets[0].y.toFixed(2)}, ${targets[0].z.toFixed(2)}), center=(${targets[1].x.toFixed(2)}, ${targets[1].y.toFixed(2)}, ${targets[1].z.toFixed(2)}), right=(${targets[2].x.toFixed(2)}, ${targets[2].y.toFixed(2)}, ${targets[2].z.toFixed(2)})`);
            
            // Create rays from bulb to each target
            // Use the updated bulb position (newBulbPos) so rays originate from the spotlight
            const rayRadius = 0.15;
            const rayMaterial = new THREE.MeshBasicMaterial({
                color: 0xFFF4D1,
                transparent: true,
                opacity: 0.2, // Reduced opacity to make rays fainter
                side: THREE.DoubleSide,
                depthWrite: false
            });
            
            targets.forEach((target, index) => {
                // Direction from updated bulb position to target
                const dir = target.clone().sub(newBulbPos);
                const length = dir.length();
                
                if (length > 0.001) {
                    dir.normalize();
                    
                    // Create ray cylinder from bulb to target
                    const rayGeometry = new THREE.CylinderGeometry(rayRadius, rayRadius, length, 16);
                    const ray = new THREE.Mesh(rayGeometry, rayMaterial);
                    
                    // Position ray at midpoint (extends from updated bulb position to target)
                    ray.position.copy(newBulbPos.clone().add(dir.clone().multiplyScalar(length / 2)));
                    
                    // Orient ray
                    const up = new THREE.Vector3(0, 1, 0);
                    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
                    ray.quaternion.copy(quat);
                    
                    scene.add(ray);
                    
                    // Store ray
                    if (!painting.userData.rays) {
                        painting.userData.rays = [];
                    }
                    painting.userData.rays.push(ray);
                    
                    const names = ['top left corner', 'top center', 'top right corner'];
                    console.log(`[RAY] ${names[index]}: to (${target.x.toFixed(2)}, ${target.y.toFixed(2)}, ${target.z.toFixed(2)})`);
                }
            });
        };
        
        // Wait for frame to be created and dimensions set
        setTimeout(setupRays, 300);
    });
}

// Initialize
function init() {
    // Remove any existing lighting elements if scene already exists
    if (scene) {
        removeAllLightingElements();
    }
    
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
    // Front doors will be created by createMuseumExterior based on currentRoom
    createMuseumExterior();

    // Remove any lighting elements that might have been created
    removeAllLightingElements();

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
    // Remove existing front doors if any
    if (frontDoorGroup) {
        scene.remove(frontDoorGroup);
        frontDoorGroup.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
    
    // Only create front doors if not in room 1 (to allow going back)
    if (currentRoom === 1) {
        frontDoorGroup = null;
        return;
    }
    
    // Create two doors on the exterior of the front wall
    const museumStartZ = ENTRANCE_Z - 5 - 8; // Match front wall position
    const doorWidth = 3.5; // Match back wall doors
    const doorHeight = 8; // Match back wall doors
    const doorDepth = 0.2;
    const doorGap = 0.1; // Gap between the two doors

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

    frontDoorGroup = new THREE.Group();
    
    // Create left door (isFrontDoor = true since these are rotated 180°)
    const leftDoor = createInteriorDoor(doorWidth, doorHeight, doorDepth, doorFrameMaterial, doorPanelMaterial, doorknobMaterial, true, true);
    leftDoor.position.set(-doorWidth / 2 - doorGap / 2, doorHeight / 2, museumStartZ + 0.25 + doorDepth / 2);
    leftDoor.rotation.y = Math.PI;
    frontDoorGroup.add(leftDoor);
    
    // Create right door (isFrontDoor = true since these are rotated 180°)
    const rightDoor = createInteriorDoor(doorWidth, doorHeight, doorDepth, doorFrameMaterial, doorPanelMaterial, doorknobMaterial, false, true);
    rightDoor.position.set(doorWidth / 2 + doorGap / 2, doorHeight / 2, museumStartZ + 0.25 + doorDepth / 2);
    rightDoor.rotation.y = Math.PI;
    frontDoorGroup.add(rightDoor);
    
    // Make doors hoverable by adding a large invisible plane in front
    const hoverPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(doorWidth * 2 + doorGap, doorHeight),
        new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    hoverPlane.position.set(0, doorHeight / 2, museumStartZ + 0.5);
    hoverPlane.userData.isFrontDoor = true;
    frontDoorGroup.add(hoverPlane);
    frontDoorGroup.userData.hoverPlane = hoverPlane;
    
    scene.add(frontDoorGroup);
    console.log(`[DOORS] Created front doors for room navigation at Z=${(museumStartZ + 0.25 + doorDepth / 2).toFixed(2)}`);
    console.log(`[DOORS] Front door group has ${frontDoorGroup.children.length} children`);
    frontDoorGroup.traverse((child) => {
        if (child.type === 'Group') {
            console.log(`[DOORS] Door group has ${child.children.length} children`);
        }
    });
}

function createBackWallDoors(backWallZ) {
    // Remove existing doors if any
    if (doorGroup) {
        scene.remove(doorGroup);
        doorGroup.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
    
    doorGroup = new THREE.Group();
    
    const doorWidth = 3.5;
    const doorHeight = 8;
    const doorDepth = 0.2;
    const doorGap = 0.1; // Gap between the two doors
    
    // Materials
    const doorFrameMaterial = new THREE.MeshStandardMaterial({
        color: 0x654321,
        roughness: 0.8,
        metalness: 0.0
    });
    const doorPanelMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513,
        roughness: 0.7,
        metalness: 0.1
    });
    const doorknobMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFD700, // Yellow/gold doorknobs to match front doors
        roughness: 0.3,
        metalness: 0.8
    });
    
    // Create left door
    const leftDoor = createInteriorDoor(doorWidth, doorHeight, doorDepth, doorFrameMaterial, doorPanelMaterial, doorknobMaterial, true);
    leftDoor.position.set(-doorWidth / 2 - doorGap / 2, doorHeight / 2, backWallZ - 0.25);
    doorGroup.add(leftDoor);
    
    // Create right door
    const rightDoor = createInteriorDoor(doorWidth, doorHeight, doorDepth, doorFrameMaterial, doorPanelMaterial, doorknobMaterial, false);
    rightDoor.position.set(doorWidth / 2 + doorGap / 2, doorHeight / 2, backWallZ - 0.25);
    doorGroup.add(rightDoor);
    
    // Make doors hoverable by adding a large invisible plane in front
    const hoverPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(doorWidth * 2 + doorGap, doorHeight),
        new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    hoverPlane.position.set(0, doorHeight / 2, backWallZ - 0.5);
    hoverPlane.userData.isDoor = true;
    doorGroup.add(hoverPlane);
    doorGroup.userData.hoverPlane = hoverPlane;
    
    scene.add(doorGroup);
    console.log(`[DOORS] Created double doors at Z=${backWallZ.toFixed(2)}`);
}

function createInteriorDoor(doorWidth, doorHeight, doorDepth, frameMaterial, panelMaterial, doorknobMaterial, doorknobOnRight, isFrontDoor = false) {
    const singleDoor = new THREE.Group();

    // Door frame
    const frameDepth = 0.1;
    const frameWidth = doorWidth + 0.2;
    const frameHeight = doorHeight + 0.2;
    const frameGeometry = new THREE.BoxGeometry(frameWidth, frameHeight, frameDepth);
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.z = -doorDepth / 2 - frameDepth / 2;
    singleDoor.add(frame);
    
    // Door panel
    const panelGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, doorDepth);
    const panel = new THREE.Mesh(panelGeometry, panelMaterial);
    singleDoor.add(panel);
    
    // Recessed panels (decorative)
    const panelWidth = doorWidth * 0.6;
    const panelHeight = doorHeight * 0.3;
    const panelDepth = 0.05;
    const topPanelGeometry = new THREE.BoxGeometry(panelWidth, panelHeight, panelDepth);
    const topPanel = new THREE.Mesh(topPanelGeometry, panelMaterial);
    topPanel.position.set(0, doorHeight * 0.25, doorDepth / 2 - panelDepth / 2);
    singleDoor.add(topPanel);
    
    const bottomPanelGeometry = new THREE.BoxGeometry(panelWidth, panelHeight, panelDepth);
    const bottomPanel = new THREE.Mesh(bottomPanelGeometry, panelMaterial);
    bottomPanel.position.set(0, -doorHeight * 0.25, doorDepth / 2 - panelDepth / 2);
    singleDoor.add(bottomPanel);
    
    // Doorknob - HUGE bright yellow sphere that's impossible to miss
    const doorknobRadius = 0.4; // Very large - 0.4 unit radius sphere
    const doorknobOffset = 0.5; // Distance from edge
    const doorknobX = doorknobOnRight
        ? (doorWidth / 2 - doorknobOffset)
        : (-doorWidth / 2 + doorknobOffset);
    
    // Create doorknob on the interior-facing side
    // For interior-facing: positive Z in local space (will face interior after any rotations)
    const doorknob = new THREE.Mesh(
        new THREE.SphereGeometry(doorknobRadius, 16, 16),
        doorknobMaterial
    );
    // Position at center height, on the interior-facing face, protruding outward
    doorknob.position.set(doorknobX, 0, doorDepth / 2 + 0.3);
    singleDoor.add(doorknob);
    
    console.log(`[DOORKNOB] Created HUGE doorknob (radius=${doorknobRadius}) at local position (${doorknobX.toFixed(2)}, 0, ${(doorDepth / 2 + 0.3).toFixed(2)}), isFrontDoor=${isFrontDoor}`);
    
    return singleDoor;
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
            // High fidelity texture settings
                            texture.minFilter = THREE.LinearMipmapLinearFilter; // Trilinear filtering for best quality
                            texture.magFilter = THREE.LinearFilter; // Linear filtering for magnification
            texture.generateMipmaps = true; // Enable mipmaps for better quality at different distances
            if (renderer && renderer.capabilities) {
                texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); // Maximum anisotropy for sharp textures at angles
            }
            
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
            const frameWidth = actualWidth + frameBorder * 2;
            const frameHeight = actualHeight + frameBorder * 2;
            frame.geometry.dispose();
            frame.geometry = new THREE.BoxGeometry(
                frameWidth,
                frameHeight,
                0.2
            );
            
            // Store canvas reference and frame dimensions
            paintingGroup.userData.canvas = canvas;
            paintingGroup.userData.frameWidth = frameWidth;
            paintingGroup.userData.frameHeight = frameHeight;
            paintingGroup.userData.canvasWidth = actualWidth;
            paintingGroup.userData.canvasHeight = actualHeight;
            paintingGroup.userData.imageLoaded = true; // Mark as loaded
            paintingGroup.userData.texture = texture; // Store texture reference
            
            // Store note path for lazy loading (to avoid exceeding texture unit limit)
            if (notePath) {
                paintingGroup.userData.notePath = notePath;
                paintingGroup.userData.noteLoaded = false; // Track if note is loaded
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

function loadPaintingTexture(paintingGroup) {
    if (paintingGroup.userData.imageLoaded || !paintingGroup.userData.imagePath) {
        return; // Already loaded or no image path
    }
    
    const textureLoader = new THREE.TextureLoader();
    const imagePath = paintingGroup.userData.imagePath;
    const frameBorder = 0.3;
    
    textureLoader.load(
                    imagePath,
                    (texture) => {
                            texture.colorSpace = THREE.SRGBColorSpace;
            texture.flipY = false;
                            // High fidelity texture settings
                            texture.minFilter = THREE.LinearMipmapLinearFilter; // Trilinear filtering for best quality
                            texture.magFilter = THREE.LinearFilter; // Linear filtering for magnification
            texture.generateMipmaps = true; // Enable mipmaps for better quality at different distances
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); // Maximum anisotropy for sharp textures at angles
            
            console.log(`[IMAGE] Successfully loaded ${imagePath}`);
            
            // Calculate aspect ratio and scale to maintain proportions
            const imageAspect = texture.image.width / texture.image.height;
            const baseHeight = PAINTING_HEIGHT * 1.5;
            const actualWidth = baseHeight * imageAspect;
            const actualHeight = baseHeight;
            
            // Create canvas geometry with correct size
            const canvasGeometry = new THREE.PlaneGeometry(actualWidth, actualHeight);
            
            // Create material with texture
            const paintingMaterial = new THREE.MeshBasicMaterial({
                map: texture,
            side: THREE.DoubleSide
        });
            
            const canvas = new THREE.Mesh(canvasGeometry, paintingMaterial);
            canvas.position.z = 0.11;
            canvas.rotation.z = Math.PI;
            
            // Remove placeholder and add real canvas
            if (paintingGroup.userData.placeholderCanvas) {
                paintingGroup.remove(paintingGroup.userData.placeholderCanvas);
                paintingGroup.userData.placeholderCanvas.geometry.dispose();
                paintingGroup.userData.placeholderCanvas.material.dispose();
                delete paintingGroup.userData.placeholderCanvas;
            }
            
            paintingGroup.add(canvas);
            
            // Update frame to match canvas size
            const frameWidth = actualWidth + frameBorder * 2;
            const frameHeight = actualHeight + frameBorder * 2;
            const frame = paintingGroup.userData.frame;
            if (frame) {
            frame.geometry.dispose();
                frame.geometry = new THREE.BoxGeometry(frameWidth, frameHeight, 0.2);
            }
            
            // Store references
            paintingGroup.userData.canvas = canvas;
            paintingGroup.userData.frameWidth = frameWidth;
            paintingGroup.userData.frameHeight = frameHeight;
            paintingGroup.userData.canvasWidth = actualWidth;
            paintingGroup.userData.canvasHeight = actualHeight;
            paintingGroup.userData.texture = texture;
            paintingGroup.userData.imageLoaded = true;
            
            console.log(`[PAINTING] Loaded texture for ${imagePath}: ${texture.image.width}x${texture.image.height}`);
        },
        undefined,
        (error) => {
            console.error(`[PAINTING] Failed to load image: ${imagePath}`, error);
        }
    );
}

function unloadPaintingTexture(paintingGroup) {
    if (!paintingGroup.userData.imageLoaded || !paintingGroup.userData.canvas) {
                return;
            }
            
    // Dispose texture and material - dispose texture from material first
    if (paintingGroup.userData.canvas.material) {
        if (paintingGroup.userData.canvas.material.map) {
            paintingGroup.userData.canvas.material.map.dispose();
            paintingGroup.userData.canvas.material.map = null;
        }
        paintingGroup.userData.canvas.material.dispose();
    }
    if (paintingGroup.userData.canvas.geometry) {
        paintingGroup.userData.canvas.geometry.dispose();
    }
    if (paintingGroup.userData.texture) {
        paintingGroup.userData.texture.dispose();
    }
    
    // Remove canvas
    paintingGroup.remove(paintingGroup.userData.canvas);
    
    // Create placeholder
    const placeholderGeometry = new THREE.PlaneGeometry(PAINTING_WIDTH, PAINTING_HEIGHT);
    const placeholderMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 });
    const placeholderCanvas = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
    placeholderCanvas.position.z = 0.11;
    placeholderCanvas.rotation.z = Math.PI;
    paintingGroup.add(placeholderCanvas);
    paintingGroup.userData.placeholderCanvas = placeholderCanvas;
    
    paintingGroup.userData.imageLoaded = false;
    delete paintingGroup.userData.canvas;
    delete paintingGroup.userData.texture;
}

function managePaintingTextures() {
    if (!camera || paintings.length === 0) return;
    
    // Be extremely conservative - only 10 painting textures to leave plenty of room for notes
    // WebGL has a limit of 16 texture units, so 10 paintings + up to 6 notes = safe
    const maxPaintingTextures = 10;
    const loadDistance = 50; // Load textures for paintings within this distance
    
    // Calculate distances and sort by distance from camera
    const paintingDistances = paintings.map(painting => {
        const distance = Math.abs(painting.position.z - camera.position.z);
        return { painting, distance };
    }).sort((a, b) => a.distance - b.distance);
    
    // First, unload textures for ALL paintings beyond the max (do this first to free up texture units)
    paintingDistances.slice(maxPaintingTextures).forEach(({ painting }) => {
        if (painting.userData.imageLoaded) {
            unloadPaintingTexture(painting);
        }
        // Also unload notes for distant paintings
        if (painting.userData.noteLoaded && painting.userData.noteMesh) {
            unloadNoteTexture(painting);
        }
    });
    
    // Count how many textures are currently loaded
    let loadedCount = 0;
    paintingDistances.slice(0, maxPaintingTextures).forEach(({ painting }) => {
        if (painting.userData.imageLoaded) {
            loadedCount++;
        }
    });
    
    // Only load new textures if we're under the limit
    paintingDistances.slice(0, maxPaintingTextures).forEach(({ painting, distance }) => {
        if (distance <= loadDistance && !painting.userData.imageLoaded && loadedCount < maxPaintingTextures) {
            loadPaintingTexture(painting);
            loadedCount++;
        }
    });
}

function loadNoteTexture(paintingGroup) {
    if (!paintingGroup.userData.notePath || paintingGroup.userData.noteLoaded) {
        return; // Already loaded or no note
    }
    
    // Make sure painting texture is loaded first (needed for canvas dimensions)
    if (!paintingGroup.userData.imageLoaded) {
        loadPaintingTexture(paintingGroup);
        // Wait a bit for texture to load, then retry
        setTimeout(() => loadNoteTexture(paintingGroup), 200);
        return;
    }
    
    const textureLoader = new THREE.TextureLoader();
    const notePath = paintingGroup.userData.notePath;
    const canvasWidth = paintingGroup.userData.canvasWidth;
    const canvasHeight = paintingGroup.userData.canvasHeight;
    
                textureLoader.load(
                    notePath,
                    (noteTexture) => {
                        noteTexture.colorSpace = THREE.SRGBColorSpace;
            noteTexture.flipY = false;
                        // High fidelity texture settings
                        noteTexture.minFilter = THREE.LinearMipmapLinearFilter; // Trilinear filtering for best quality
                        noteTexture.magFilter = THREE.LinearFilter; // Linear filtering for magnification
                        noteTexture.generateMipmaps = true; // Enable mipmaps for better quality at different distances
                        if (renderer && renderer.capabilities) {
                            noteTexture.anisotropy = renderer.capabilities.getMaxAnisotropy(); // Maximum anisotropy for sharp textures at angles
                        }
                        
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
            noteMesh.visible = true; // Show immediately since we're hovering
                        paintingGroup.add(noteMesh);
                        paintingGroup.userData.noteMesh = noteMesh;
            paintingGroup.userData.noteLoaded = true;
                    },
                    undefined,
                    (error) => {
            console.warn('Failed to load note texture:', notePath, error);
            paintingGroup.userData.noteLoaded = true; // Mark as attempted to avoid retrying
        }
    );
}

function unloadNoteTexture(paintingGroup) {
    if (!paintingGroup.userData.noteLoaded || !paintingGroup.userData.noteMesh) {
        return;
    }
    
    // Dispose note texture and material
    if (paintingGroup.userData.noteMesh.material) {
        if (paintingGroup.userData.noteMesh.material.map) {
            paintingGroup.userData.noteMesh.material.map.dispose();
        }
        paintingGroup.userData.noteMesh.material.dispose();
    }
    if (paintingGroup.userData.noteMesh.geometry) {
        paintingGroup.userData.noteMesh.geometry.dispose();
    }
    
    // Remove note mesh
    paintingGroup.remove(paintingGroup.userData.noteMesh);
    
    paintingGroup.userData.noteLoaded = false;
    delete paintingGroup.userData.noteMesh;
}

function enterNextRoom() {
    // Clear current paintings
    paintings.forEach(painting => {
        // Dispose textures
        if (painting.userData.canvas) {
            if (painting.userData.canvas.material) {
                if (painting.userData.canvas.material.map) {
                    painting.userData.canvas.material.map.dispose();
                }
                painting.userData.canvas.material.dispose();
            }
            if (painting.userData.canvas.geometry) {
                painting.userData.canvas.geometry.dispose();
            }
        }
        scene.remove(painting);
    });
    paintings = [];
    paintingGroups = [];
    
    // Advance to next room
    currentRoom++;
    
    // Reset camera position to entrance
    characterZ = ENTRANCE_Z - 5;
    camera.position.z = characterZ;
    
    // Reload paintings for new room
    loadPaintings();
    
    // Update front doors
    createMuseumExterior();
    
    console.log(`[ROOM] Entered room ${currentRoom}`);
}

function enterPreviousRoom() {
    // Clear current paintings
    paintings.forEach(painting => {
        // Dispose textures
        if (painting.userData.canvas) {
            if (painting.userData.canvas.material) {
                if (painting.userData.canvas.material.map) {
                    painting.userData.canvas.material.map.dispose();
                }
                painting.userData.canvas.material.dispose();
            }
            if (painting.userData.canvas.geometry) {
                painting.userData.canvas.geometry.dispose();
            }
        }
        scene.remove(painting);
    });
    paintings = [];
    paintingGroups = [];
    
    // Go back to previous room
    currentRoom--;
    
    // Reset camera position to entrance
    characterZ = ENTRANCE_Z - 5;
    camera.position.z = characterZ;
    
    // Reload paintings for previous room
    loadPaintings();
    
    // Update front doors (remove them if back to room 1)
    createMuseumExterior();
    
    console.log(`[ROOM] Entered room ${currentRoom}`);
}

function loadPaintings() {
    // All available paintings (up to 19)
    const allImageNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    // Map of image numbers to their actual file extensions
    const imageExtensions = {
        1: 'jpeg', 2: 'jpeg', 3: 'jpeg', 4: 'jpg', 5: 'png',
        6: 'jpg', 7: 'jpeg', 8: 'jpeg', 9: 'png', 10: 'jpeg',
        11: 'jpeg', 12: 'jpeg', 13: 'jpeg', 14: 'png', 15: 'jpg', 16: 'jpeg', 17: 'jpg', 18: 'jpeg', 19: 'jpg'
    };
    // Map of note numbers to their actual file extensions (only for notes that exist)
    const noteExtensions = {
        1: 'jpg', 2: 'jpg', 3: 'jpeg', 4: 'jpg', 5: 'png',
        6: 'jpg', 7: 'jpg', 8: 'jpg', 9: 'jpg',
        10: 'png', 11: 'jpeg', 12: 'jpg', 13: 'jpg',
        14: 'jpeg', 15: 'png', 16: 'jpg', 17: 'jpg', 18: 'jpeg', 19: 'jpg'
    };
    
    // Calculate which paintings to show for current room (10 per room)
    const paintingsPerRoom = 10;
    const startIndex = (currentRoom - 1) * paintingsPerRoom;
    const endIndex = Math.min(startIndex + paintingsPerRoom, allImageNumbers.length);
    const imageNumbers = allImageNumbers.slice(startIndex, endIndex);
    
    console.log(`[ROOM] Loading room ${currentRoom}: paintings ${imageNumbers.join(', ')} (indices ${startIndex} to ${endIndex-1})`);
    
    // Check if there are more rooms available
    const hasMoreRooms = endIndex < allImageNumbers.length;

    setTimeout(() => {
        // Remove any existing lighting elements first
        removeAllLightingElements();
        
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
        // Wait a bit for frames to load, then calculate based on actual frame bounds
        setTimeout(() => {
        if (scene.userData.backWall) {
                // Find the last painting and get its actual back edge
                // Try multiple methods to find the last painting reliably
                let lastPainting = paintings[paintings.length - 1];
                
                // Fallback: find painting with highest Z position
                if (!lastPainting || paintings.length === 0) {
                    lastPainting = paintings.reduce((max, p) => {
                        return (!max || p.position.z > max.position.z) ? p : max;
                    }, null);
                }
                
                let lastPaintingBackZ = lastPaintingZ;
                
                // Get the frame mesh to calculate its actual back edge
                if (lastPainting) {
                    let frameMesh = null;
                    lastPainting.children.forEach(child => {
                        if (child.geometry && child.material && child.material.color && 
                            child.material.color.getHex() === 0x8B4513) { // Frame is brown
                            frameMesh = child;
                        }
                    });
                    
                    if (frameMesh) {
                        frameMesh.updateMatrixWorld(true);
                        const box = new THREE.Box3().setFromObject(frameMesh);
                        // Get the maximum Z (back edge) of the frame
                        lastPaintingBackZ = box.max.z;
                        console.log(`[BACKWALL] Found last painting frame, back edge at Z=${lastPaintingBackZ.toFixed(2)}`);
                    } else {
                        // Fallback: use painting position + estimated frame depth
                        lastPaintingBackZ = lastPainting.position.z + 0.1; // Frame extends 0.1 units forward
                        console.log(`[BACKWALL] Using fallback calculation, estimated back edge at Z=${lastPaintingBackZ.toFixed(2)}`);
                    }
                } else {
                    console.warn(`[BACKWALL] No last painting found, using lastPaintingZ=${lastPaintingZ.toFixed(2)}`);
                }
                
            const backWallOffset = 8; // Increased space past last painting to ensure visibility
                const newBackWallZ = lastPaintingBackZ + backWallOffset;
            scene.userData.backWall.position.z = newBackWallZ;
            
            // Create double doors at back wall if there are more rooms
            if (hasMoreRooms) {
                createBackWallDoors(newBackWallZ);
            } else {
                // Remove doors if they exist
                if (doorGroup) {
                    scene.remove(doorGroup);
                    doorGroup = null;
                }
            }
                console.log(`[SETUP] Back wall repositioned to Z=${newBackWallZ.toFixed(2)} (last painting center at Z=${lastPaintingZ.toFixed(2)}, back edge at Z=${lastPaintingBackZ.toFixed(2)})`);
            
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
            // Back wall is a BoxGeometry with depth 0.5, centered at newBackWallZ
            // Front face of wall is at newBackWallZ - 0.25
            // Set MAX_Z to stop player just before the front face with a small buffer
            const wallDepth = 0.5;
            const wallFrontFaceZ = newBackWallZ - wallDepth / 2; // Front face of the wall
            const stopBuffer = 0.5; // Buffer to stop before hitting the wall
            MAX_Z = wallFrontFaceZ - stopBuffer;
            console.log(`[SETUP] Movement bound updated to MAX_Z=${MAX_Z.toFixed(2)} (back wall front face at ${wallFrontFaceZ.toFixed(2)})`);
        }
        }, 1000); // Increased timeout to 1000ms to ensure all paintings (including 19) are fully loaded

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
        
        // Check for front door hover first (if in room 2+)
        let frontDoorIntersects = [];
        if (frontDoorGroup && frontDoorGroup.userData.hoverPlane) {
            frontDoorIntersects = raycaster.intersectObject(frontDoorGroup.userData.hoverPlane, true);
        }
        
        if (frontDoorIntersects.length > 0) {
            // Hovering over front door
            hoveredFrontDoor = true;
            hoveredDoor = false;
            const enterButton = document.getElementById('enter-room-button');
            if (enterButton) {
                enterButton.textContent = 'Enter Previous Room';
                enterButton.style.display = 'block';
            }
            
            // Reset painting hover
            if (hoveredPainting) {
                if (hoveredPainting.userData.canvas) hoveredPainting.userData.canvas.visible = true;
                if (hoveredPainting.userData.noteMesh) hoveredPainting.userData.noteMesh.visible = false;
            }
            hoveredPainting = null;
            return;
        }
        
        // Check for back door hover
        let doorIntersects = [];
        if (doorGroup && doorGroup.userData.hoverPlane) {
            doorIntersects = raycaster.intersectObject(doorGroup.userData.hoverPlane, true);
        }
        
        if (doorIntersects.length > 0) {
            // Hovering over back door
            hoveredDoor = true;
            hoveredFrontDoor = false;
            const enterButton = document.getElementById('enter-room-button');
            if (enterButton) {
                enterButton.textContent = 'Enter Next Room';
                enterButton.style.display = 'block';
            }
            
            // Reset painting hover
            if (hoveredPainting) {
                if (hoveredPainting.userData.canvas) hoveredPainting.userData.canvas.visible = true;
                if (hoveredPainting.userData.noteMesh) hoveredPainting.userData.noteMesh.visible = false;
            }
            hoveredPainting = null;
            return;
        } else {
            hoveredDoor = false;
            hoveredFrontDoor = false;
            const enterButton = document.getElementById('enter-room-button');
            if (enterButton) enterButton.style.display = 'none';
        }
        
        // Check for painting hover
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
            // Hide image
            if (paintingGroup.userData.canvas) paintingGroup.userData.canvas.visible = false;
            
            // Load note texture on demand if not already loaded
            if (paintingGroup.userData.notePath && !paintingGroup.userData.noteLoaded) {
                loadNoteTexture(paintingGroup);
            } else if (paintingGroup.userData.noteMesh) {
                paintingGroup.userData.noteMesh.visible = true;
            }
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
    
    // Click handler for note expansion and door interaction
    function handleNoteClick() {
        if (expandedNote) return; // Already expanded
        
        // Check if hovering over front door (go back)
        if (hoveredFrontDoor && frontDoorGroup && frontDoorGroup.userData.hoverPlane) {
            enterPreviousRoom();
            return;
        }
        
        // Check if hovering over back door (go forward)
        if (hoveredDoor && doorGroup && doorGroup.userData.hoverPlane) {
            enterNextRoom();
            return;
        }
        
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
                
                // Load note texture on demand if not already loaded
                if (paintingGroup.userData.notePath && !paintingGroup.userData.noteLoaded) {
                    loadNoteTexture(paintingGroup);
                } else if (paintingGroup.userData.noteMesh) {
                    paintingGroup.userData.noteMesh.visible = true;
                }
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
    document.addEventListener('DOMContentLoaded', () => {
        setupNoteExpansion();
        setupRoomButton();
    });
} else {
    setupNoteExpansion();
    setupRoomButton();
}

function setupRoomButton() {
    const enterRoomButton = document.getElementById('enter-room-button');
    if (enterRoomButton) {
        enterRoomButton.addEventListener('click', () => {
            if (hoveredFrontDoor) {
                enterPreviousRoom();
            } else if (hoveredDoor) {
                enterNextRoom();
            }
        });
    }
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
