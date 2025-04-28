let scene, camera, renderer, model, mixer, controls;
let isWireframe = false;
let light;
let animations = [];
let currentAnimationIndex = 0;
let rotate = true;
let materialMap = new Map();

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth * 1.0, window.innerHeight * 1.0);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);  // Set the intensity to 0.6
    scene.add(ambientLight);

    // Enhance the original point light source
    light = new THREE.PointLight(0xffffff, 1.0, 20);  // Strength increased to 2.0, adding attenuation distance
    light.position.set(5, 5, 5);
    scene.add(light);

    // Auxiliary light source
    // const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    // fillLight.position.set(-5, 5, -5);
    // scene.add(fillLight);

    camera.position.z = 5;
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.addEventListener('start', function() {
        rotate = false;
    });
    
    // Enable renderer shadows
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

/**********************************************************
 * Load GLTF model
 **********************************************************/
function loadGLTF(modelName) {
    const loader = new THREE.GLTFLoader();
    loader.load(
        `/static/models/${modelName}.glb`,
        (gltf) => {
            model = gltf.scene;
            scene.add(model);

            animations = [];
            currentAnimationIndex = 0;

            if (gltf.animations && gltf.animations.length > 0) {
                animations = gltf.animations;
                mixer = new THREE.AnimationMixer(model);

                // Generate action list
                const animationList = document.getElementById('animation-list');
                animationList.innerHTML = '<strong>Select Animation:</strong>';
                const select = document.createElement('select');
                animations.forEach((clip, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = clip.name || `Animation ${index + 1}`;
                    select.appendChild(option);
                });
                select.onchange = (e) => playAnimation(parseInt(e.target.value));
                animationList.appendChild(select);
                animationList.style.display = 'block';

                playAnimation(currentAnimationIndex); // Automatically play the first animation
            }

            else
            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({
                        map: child.material.map,
                        metalness: 0.2, // child.material.metalness,
                        roughness: child.material.roughness
                    });
                }
            });
        },
        undefined,
        (error) => console.error('Error loading model:', error)
    );
}

/**********************************************************
 * Load 3DS model
 **********************************************************/
function load3DS(modelName) {
    // Using 3DS Loader
    const loader = new THREE.TDSLoader();
    loader.setPath('/static/models/'); // Set the basic path for the model and texture
    loader.load(`${modelName}.3ds`,
        (object) => {
            model = object;
            scene.add(model);

            // Collect material information
            model.traverse((child) => {
                if (child.isMesh) {
                    const material = child.material;
                    if (material && material.map) {
                        // Store raw texture information
                        materialMap.set(material, {
                            originalMap: material.map,
                            currentMap: null
                        });
                    }
                }
            });

            // Adjust the position and scale of the model
            model.position.set(0, 0, 0);
            model.scale.set(0.5, 0.5, 0.5); // Adjust according to the actual model
        },
        undefined,
        (error) => console.error('Error loading 3DS model:', error)
    );
}

function changeTexture(texturePath) {
    const loader = new THREE.TextureLoader();
    loader.load(texturePath, (texture) => {
        // texture.flipY = false;

        // Traverse all materials and apply new textures
        materialMap.forEach((info, material) => {
            // Release old texture memory
            if (info.currentMap) {
                info.currentMap.dispose();
            }
            
            material.map = texture;
            material.needsUpdate = true;
            info.currentMap = texture;
        });
    });
}

let toggleCount = 0;
const toggleTextures = [
    '/static/models/can1/Original_UV.png',
    '/static/models/can1/Soda_Texture_0.png',
    '/static/models/can1/Soda_Texture_1.png'
];
function toggleTexture() {
    if (toggleCount >= toggleTextures.length) {
        toggleCount = 0;
    }

    changeTexture(toggleTextures[toggleCount++]);    
}

document.getElementById('textureInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            changeTexture(e.target.result);
            document.getElementById('textureInput').value = '';
        };
        reader.readAsDataURL(file);
    }
});

/**********************************************************
 *
 **********************************************************/
function loadModel(modelName, format = 'glb') {
    isWireframe = false;

    if (model) {
        scene.remove(model);

        materialMap.clear(); // Cleaning material records

        if (mixer) {
            mixer.stopAllAction();
            mixer = null;
        }
        // Clear the previous action list
        const animationList = document.getElementById('animation-list');
        animationList.innerHTML = '';
        animationList.style.display = 'none';
    }

    document.getElementById('textureControlButtons').style.display = 'none';

    switch (format.toLowerCase()) {
        case 'glb':
        case 'gltf':
            loadGLTF(modelName);
            break;
        case '3ds':
            load3DS(modelName);
            document.getElementById('textureControlButtons').style.display = 'flex';
            break;
        default:
            console.error('Unsupported format:', format);
            return;
    }
}

function playAnimation(index) {
    if (!mixer || animations.length === 0 || index >= animations.length) return;
    mixer.stopAllAction();
    const clip = animations[index];
    const action = mixer.clipAction(clip);
    action.play();
    currentAnimationIndex = index;

    // The dropdown list for setting actions is currently selected
    const animationSelect = document.querySelector('#animation-list select');
    if (animationSelect) {
        animationSelect.value = index.toString();
    }
}

function nextAnimation() {
    if (animations.length === 0) return;
    currentAnimationIndex = (currentAnimationIndex + 1) % animations.length;
    playAnimation(currentAnimationIndex);
}

function animate() {
    requestAnimationFrame(animate);
    if (mixer) {
        mixer.update(0.0167);
    } else if (model) { // Continuous rotation without animation
        if (rotate) {
            model.rotation.x += 0.01;
            model.rotation.y += 0.01;
        }
    }
    renderer.render(scene, camera);
    controls.update();
}

// Switch wireframe mode
let originalMaterials = new Map(); // Save original material
const wireframeMaterial = new THREE.MeshBasicMaterial({ // Global wireframe material
    color: 0xffffff,
    wireframe: true
});

function toggleWireframe() {
    isWireframe = !isWireframe;
    model.traverse((child) => {
        if (child.isMesh) {
            if (isWireframe) {
                // Save the original material and apply wireframe material
                originalMaterials.set(child, child.material);
                child.material = wireframeMaterial;
            } else {
                // Restore the original material
                const originalMaterial = originalMaterials.get(child);
                if (originalMaterial) {
                    child.material = originalMaterial;
                }
            }
        }
    });
}

// Rotating a Model
function rotateModel() {
    rotate = !rotate;
}

// Toggle Light
function toggleLight() {
    light.visible = !light.visible;
}

init();
animate();