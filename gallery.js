import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.127.0/examples/jsm/loaders/DRACOLoader.js';

class SceneGallery {
    constructor() {
        console.log('SceneGallery constructor called');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.sceneData = null;
        this.loadedModel = null;
        this.objectMeshes = new Map(); // Map instance names to mesh objects
        this.selectedObject = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Thumbnail navigation
        this.currentThumbnailIndex = 0;
        this.thumbnailsPerPage = 4;
        this.totalThumbnails = 0;
        
        try {
            this.init();
            this.setupEventListeners();
            this.generateThumbnails();
            
            // Load default scene after a short delay to ensure everything is initialized
            setTimeout(() => {
                console.log('Loading default scene...');
                this.loadScene('001');
            }, 100);
        } catch (error) {
            console.error('Error in SceneGallery constructor:', error);
        }
    }

    init() {
        console.log('Initializing 3D scene...');
        const container = document.getElementById('sceneViewer');
        if (!container) {
            console.error('sceneViewer container not found');
            return;
        }
        
        console.log('Container found:', container);

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf5f5f5);
        console.log('Scene created');

        // Create camera
        const aspect = container.offsetWidth / container.offsetHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(100, 150, 200);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(container.offsetWidth, container.offsetHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        // Clear loading indicator and add renderer
        container.innerHTML = '';
        container.appendChild(this.renderer.domElement);

        // Create controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(100, 0, 40);
        this.controls.update();

        // Add lights
        this.setupLighting();

        // Add ground plane
        this.addGroundPlane();

        // Start render loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(200, 300, 200);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 1000;
        directionalLight.shadow.camera.left = -300;
        directionalLight.shadow.camera.right = 300;
        directionalLight.shadow.camera.top = 300;
        directionalLight.shadow.camera.bottom = -300;
        this.scene.add(directionalLight);

        // Fill light
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-200, 200, -200);
        this.scene.add(fillLight);
    }

    addGroundPlane() {
        // Remove ground plane and grid to focus only on objects
        // This creates a cleaner view without distracting elements
    }

    setupEventListeners() {
        // Scene controls
        const resetBtn = document.getElementById('resetSceneViewBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetView());
        }

        const wireframeBtn = document.getElementById('toggleWireframeBtn');
        if (wireframeBtn) {
            wireframeBtn.addEventListener('click', () => this.toggleWireframe());
        }

        const showAllBtn = document.getElementById('showAllObjectsBtn');
        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => this.showAllObjects());
        }

        const loadSceneBtn = document.getElementById('loadSceneBtn');
        if (loadSceneBtn) {
            loadSceneBtn.addEventListener('click', () => {
                const selector = document.getElementById('sceneSelector');
                if (selector) {
                    this.loadScene(selector.value);
                }
            });
        }

        // Mouse click for object selection
        const container = document.getElementById('sceneViewer');
        if (container) {
            container.addEventListener('click', (event) => this.onMouseClick(event));
            container.addEventListener('mousemove', (event) => this.onMouseMove(event));
        }
    }

    async loadScene(sceneId) {
        try {
            console.log('Loading scene:', sceneId);
            // Show loading indicator
            this.showLoadingIndicator(true);

            // Load scene data
            console.log('Fetching JSON data...');
            const jsonPath = `./assets/gallery/${sceneId}.json`;
            console.log('JSON path:', jsonPath);
            const response = await fetch(jsonPath);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.sceneData = await response.json();
            console.log('Scene data loaded:', this.sceneData);

            // Update task description
            this.updateTaskDescription();

            // Load GLB model
            console.log('Loading GLB model...');
            const glbPath = `./assets/gallery/${sceneId}.glb`;
            console.log('GLB path:', glbPath);
            await this.loadGLBModel(glbPath);

            // Update object info panel
            this.updateObjectInfoPanel();

            this.showLoadingIndicator(false);
            console.log('Scene loading completed successfully');
        } catch (error) {
            console.error('Error loading scene:', error);
            this.showLoadingIndicator(false);
            
            // Show error message to user
            const taskElement = document.getElementById('taskDescription');
            if (taskElement) {
                taskElement.textContent = `Error loading scene: ${error.message}`;
                taskElement.style.color = '#ff3860';
            }
        }
    }

    async loadGLBModel(modelPath) {
        return new Promise((resolve, reject) => {
            console.log('Starting GLB model load from:', modelPath);
            const loader = new GLTFLoader();
            
            // Setup DRACO loader
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderConfig({ type: 'js' });
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
            loader.setDRACOLoader(dracoLoader);

            loader.load(
                modelPath,
                (gltf) => {
                    console.log('GLB model loaded successfully:', gltf);
                    
                    // Remove previous model if exists
                    if (this.loadedModel) {
                        this.scene.remove(this.loadedModel);
                        this.objectMeshes.clear();
                    }

                    this.loadedModel = gltf.scene;
                    console.log('Model scene:', gltf.scene);
                    
                    // Process the model and map objects
                    this.processLoadedModel(gltf.scene);
                    
                    this.scene.add(gltf.scene);
                    console.log('Model added to scene');
                    
                    // Reset camera position
                    this.resetView();
                    
                    resolve(gltf);
                },
                (progress) => {
                    if (progress.lengthComputable) {
                        const percentComplete = (progress.loaded / progress.total * 100).toFixed(1);
                        console.log(`Loading progress: ${percentComplete}% (${progress.loaded}/${progress.total} bytes)`);
                        this.updateLoadingProgress(percentComplete);
                    } else {
                        console.log('Loading progress:', progress.loaded, 'bytes loaded');
                        this.updateLoadingProgress(null, progress.loaded);
                    }
                },
                (error) => {
                    console.error('Error loading GLB model:', error);
                    reject(error);
                }
            );
        });
    }

    processLoadedModel(model) {
        console.log('Processing loaded model...');
        const meshNames = [];
        
        // Traverse the model and map objects by their names
        model.traverse((child) => {
            if (child.isMesh) {
                meshNames.push(child.name);
                console.log('Found mesh:', child.name);
                
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Find matching instance from scene data
                const matchingInstance = this.findMatchingInstance(child.name);
                console.log(`Matching instance for ${child.name}:`, matchingInstance);
                
                if (matchingInstance) {
                    // Store the mesh with its instance name
                    this.objectMeshes.set(matchingInstance.instance, child);
                    console.log(`Mapped ${child.name} to instance ${matchingInstance.instance}`);
                    
                    // Add user data for easy access
                    child.userData.instanceData = matchingInstance;
                    child.userData.originalMaterial = child.material.clone();
                    
                    // Make the object interactive
                    child.userData.interactive = true;
                } else {
                    console.warn(`No matching instance found for mesh: ${child.name}`);
                }
            }
        });
        
        console.log('All mesh names found:', meshNames);
        console.log('Object meshes mapped:', Array.from(this.objectMeshes.keys()));
    }

    findMatchingInstance(meshName) {
        if (!this.sceneData || !this.sceneData.scene_layout_json) {
            console.log('No scene data available for matching');
            return null;
        }
        
        console.log(`Looking for match for mesh: "${meshName}"`);
        const objects = this.sceneData.scene_layout_json.objects;
        console.log('Available instances:', objects.map(obj => obj.instance));
        
        // Find instance where the instance name is a complete prefix of the mesh name
        // This means the mesh name must start with the complete instance name
        const match = objects.find(obj => {
            const instanceName = obj.instance;
            const isCompletePrefix = meshName.startsWith(instanceName);
            console.log(`Checking if mesh "${meshName}" starts with complete instance "${instanceName}": ${isCompletePrefix}`);
            return isCompletePrefix;
        });
        
        if (match) {
            console.log(`✓ Complete prefix match found: "${meshName}" starts with complete instance "${match.instance}"`);
            return match;
        }
        
        console.log(`✗ No complete prefix match found for mesh: "${meshName}"`);
        console.log('Available instances for reference:', objects.map(obj => obj.instance));
        return null;
    }

    updateTaskDescription() {
        console.log('Updating task description...');
        const taskElement = document.getElementById('taskDescription');
        console.log('Task element:', taskElement);
        console.log('Scene data:', this.sceneData);
        
        if (taskElement && this.sceneData) {
            const task = this.sceneData.input_task_description?.Task || 'No task description available';
            console.log('Task text:', task);
            taskElement.textContent = task;
            taskElement.style.color = '#333'; // Reset color in case it was red from error
        } else {
            console.warn('Task element or scene data not available');
        }
    }

    updateObjectInfoPanel() {
        console.log('Updating object info panel...');
        const panel = document.getElementById('objectInfoPanel');
        console.log('Panel element:', panel);
        console.log('Scene data for panel:', this.sceneData);
        
        if (!panel || !this.sceneData) {
            console.warn('Panel element or scene data not available');
            return;
        }

        const objects = this.sceneData.scene_layout_json?.objects;
        if (!objects) {
            console.warn('No objects found in scene data');
            return;
        }
        
        console.log('Objects to display:', objects.length);
        
        // Create tabbed interface for different information sections
        let html = `
            <div class="info-tabs" style="border-bottom: 1px solid #ddd; margin-bottom: 1rem;">
                <button class="tab-button active" data-tab="objects" style="padding: 0.5rem 1rem; border: none; background: #3273dc; color: white; cursor: pointer; margin-right: 2px; border-radius: 4px 4px 0 0;">Objects</button>
                <button class="tab-button" data-tab="environment" style="padding: 0.5rem 1rem; border: none; background: #f5f5f5; color: #333; cursor: pointer; margin-right: 2px; border-radius: 4px 4px 0 0;">Task Info</button>
                <button class="tab-button" data-tab="reasoning" style="padding: 0.5rem 1rem; border: none; background: #f5f5f5; color: #333; cursor: pointer; margin-right: 2px; border-radius: 4px 4px 0 0;">Reasoning</button>
                <button class="tab-button" data-tab="relations" style="padding: 0.5rem 1rem; border: none; background: #f5f5f5; color: #333; cursor: pointer; border-radius: 4px 4px 0 0;">Relations</button>
            </div>
            
            <div class="tab-content">
                <!-- Objects Tab -->
                <div id="objects-tab" class="tab-panel active">
                    <h6 style="margin-bottom: 1rem; color: #3273dc; font-weight: bold;">
                        📦 Scene Objects (${objects.length})
                    </h6>
        `;

        // Objects list
        objects.forEach((obj, index) => {
            const [width, depth, height] = obj.size;
            const [x, y, z] = obj.position;
            
            html += `
                <div class="object-item" data-instance="${obj.instance}" style="
                    border: 1px solid #e0e0e0; 
                    border-radius: 8px; 
                    padding: 1rem; 
                    margin-bottom: 1rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    background: #fafafa;
                " onmouseover="this.style.background='#f0f8ff'; this.style.borderColor='#3273dc';" 
                   onmouseout="this.style.background='#fafafa'; this.style.borderColor='#e0e0e0';">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <h6 style="margin: 0; color: #333; font-weight: bold; font-size: 1rem;">
                            ${obj.instance}
                        </h6>
                        <span style="background: ${this.getObjectTypeColor(this.getObjectType(obj.instance))}; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">
                            ${this.getObjectType(obj.instance)}
                        </span>
                    </div>
                    
                    <p style="margin: 0 0 0.8rem 0; color: #666; font-size: 0.9rem; line-height: 1.4;">
                        ${obj.description}
                    </p>
                    
                    <div class="object-details" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem;">
                        <div>
                            <strong style="color: #555;">Size (W×D×H):</strong><br>
                            <span style="color: #777;">${width.toFixed(1)} × ${depth.toFixed(1)} × ${height.toFixed(1)} cm</span>
                        </div>
                        <div>
                            <strong style="color: #555;">Position (X,Y,Z):</strong><br>
                            <span style="color: #777;">(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})</span>
                        </div>
                        <div style="grid-column: span 2;">
                            <strong style="color: #555;">Z-Rotation:</strong>
                            <span style="color: #777;">${obj.z_rotation.toFixed(1)}°</span>
                        </div>
                    </div>
                </div>
            `;
        });

        // Environment Tab
        html += `
                </div>
                
                <!-- Environment Tab -->
                <div id="environment-tab" class="tab-panel" style="display: none;">
                    <h6 style="margin-bottom: 1rem; color: #28a745; font-weight: bold;">
                        🌍 Task Information
                    </h6>
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <h6 style="color: #495057; margin-bottom: 0.5rem; font-weight: bold;">Environment:</h6>
                        <p style="margin: 0; color: #666; line-height: 1.5;">
                            ${this.sceneData.input_task_description?.Environment || 'No environment description available'}
                        </p>
                    </div>
                    
                    <div style="background: #e8f4fd; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <h6 style="color: #0066cc; margin-bottom: 0.5rem; font-weight: bold;">Task:</h6>
                        <p style="margin: 0; color: #333; line-height: 1.5; font-weight: 500;">
                            ${this.sceneData.input_task_description?.Task || 'No task description available'}
                        </p>
                    </div>
                    
                    <div style="background: #fff3cd; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <h6 style="color: #856404; margin-bottom: 0.5rem; font-weight: bold;">Goals:</h6>
                        <ul style="margin: 0; padding-left: 1.2rem; color: #666;">
        `;

        // Add goals
        if (this.sceneData.input_task_description?.Goal && Array.isArray(this.sceneData.input_task_description.Goal)) {
            this.sceneData.input_task_description.Goal.forEach(goal => {
                html += `<li style="margin-bottom: 0.3rem;">${goal}</li>`;
            });
        } else {
            html += `<li>No goals specified</li>`;
        }

        // Reasoning Tab
        html += `
                        </ul>
                    </div>
                    
                    <div style="background: #d1ecf1; padding: 1rem; border-radius: 8px;">
                        <h6 style="color: #0c5460; margin-bottom: 0.5rem; font-weight: bold;">Object Types:</h6>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        `;

        // Add object cluster tags
        if (this.sceneData.input_task_description?.["Objects cluster"] && Array.isArray(this.sceneData.input_task_description["Objects cluster"])) {
            this.sceneData.input_task_description["Objects cluster"].forEach(objType => {
                html += `<span style="background: #17a2b8; color: white; padding: 0.3rem 0.6rem; border-radius: 15px; font-size: 0.8rem;">${objType}</span>`;
            });
        }

        html += `
                        </div>
                    </div>
                </div>
                
                <!-- Reasoning Tab -->
                <div id="reasoning-tab" class="tab-panel" style="display: none;">
                    <h6 style="margin-bottom: 1rem; color: #6f42c1; font-weight: bold;">
                        🧠 Scene Reasoning
                    </h6>
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; border-left: 4px solid #6f42c1;">
                        <p style="margin: 0; color: #333; line-height: 1.6; text-align: justify;">
                            ${this.sceneData.reasoning_paragraph || 'No reasoning information available'}
                        </p>
                    </div>
                </div>
                
                <!-- Relations Tab -->
                <div id="relations-tab" class="tab-panel" style="display: none;">
                    <h6 style="margin-bottom: 1rem; color: #dc3545; font-weight: bold;">
                        🔗 Spatial Relations
                    </h6>
                    <div style="max-height: 300px; overflow-y: auto;">
        `;

        // Add scene graph relations
        if (this.sceneData.scene_graph && Array.isArray(this.sceneData.scene_graph)) {
            this.sceneData.scene_graph.forEach((relation, index) => {
                // Parse relation format: "(object1, relation, object2)"
                const match = relation.match(/\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
                if (match) {
                    const [, subject, predicate, object] = match;
                    const relationColor = this.getRelationColor(predicate.trim());
                    html += `
                        <div style="background: #f8f9fa; padding: 0.8rem; margin-bottom: 0.5rem; border-radius: 6px; border-left: 3px solid ${relationColor};">
                            <span style="font-weight: bold; color: #333;">${subject.trim()}</span>
                            <span style="color: ${relationColor}; font-weight: 500; margin: 0 0.5rem;">${predicate.trim()}</span>
                            <span style="font-weight: bold; color: #333;">${object.trim()}</span>
                        </div>
                    `;
                } else {
                    // Fallback for non-standard format
                    html += `
                        <div style="background: #f8f9fa; padding: 0.8rem; margin-bottom: 0.5rem; border-radius: 6px;">
                            <span style="color: #666; font-family: monospace; font-size: 0.9rem;">${relation}</span>
                        </div>
                    `;
                }
            });
        } else {
            html += `<p style="color: #666; font-style: italic;">No spatial relations available</p>`;
        }

        html += `
                    </div>
                </div>
            </div>
        `;

        panel.innerHTML = html;

        // Add tab switching functionality
        this.setupTabSwitching(panel);

        // Add click listeners to object items
        panel.querySelectorAll('.object-item').forEach(item => {
            item.addEventListener('click', () => {
                const instanceName = item.dataset.instance;
                this.selectObjectByInstance(instanceName);
            });
        });
    }

    setupTabSwitching(panel) {
        const tabButtons = panel.querySelectorAll('.tab-button');
        const tabPanels = panel.querySelectorAll('.tab-panel');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;

                // Update button styles
                tabButtons.forEach(btn => {
                    if (btn === button) {
                        btn.style.background = '#3273dc';
                        btn.style.color = 'white';
                        btn.classList.add('active');
                    } else {
                        btn.style.background = '#f5f5f5';
                        btn.style.color = '#333';
                        btn.classList.remove('active');
                    }
                });

                // Show/hide panels
                tabPanels.forEach(panel => {
                    if (panel.id === `${targetTab}-tab`) {
                        panel.style.display = 'block';
                        panel.classList.add('active');
                    } else {
                        panel.style.display = 'none';
                        panel.classList.remove('active');
                    }
                });
            });
        });
    }

    getRelationColor(relation) {
        const relationColors = {
            'is at': '#007bff',
            'face to': '#28a745',
            'left of': '#ffc107',
            'right of': '#fd7e14',
            'behind': '#6610f2',
            'in front of': '#20c997',
            'above': '#e83e8c',
            'below': '#6f42c1',
            'in': '#dc3545',
            'on': '#17a2b8'
        };
        
        return relationColors[relation] || '#6c757d';
    }

    selectObjectByInstance(instanceName) {
        const mesh = this.objectMeshes.get(instanceName);
        if (mesh) {
            this.selectObject(mesh);
            
            // Focus camera on the object
            const box = new THREE.Box3().setFromObject(mesh);
            const center = box.getCenter(new THREE.Vector3());
            
            // Smoothly move camera to focus on object
            const distance = 50;
            const newPosition = center.clone().add(new THREE.Vector3(distance, distance, distance));
            
            // Animate camera movement
            this.animateCameraTo(newPosition, center);
        }
    }

    animateCameraTo(position, target) {
        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        const duration = 1000; // 1 second
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Smooth easing function
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            this.camera.position.lerpVectors(startPos, position, easeProgress);
            this.controls.target.lerpVectors(startTarget, target, easeProgress);
            this.controls.update();

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    onMouseClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        for (let intersect of intersects) {
            if (intersect.object.userData.interactive) {
                this.selectObject(intersect.object);
                return;
            }
        }

        // If no interactive object was clicked, deselect
        this.deselectObject();
    }

    onMouseMove(event) {
        // Optional: Add hover effects here
    }

    selectObject(mesh) {
        // Deselect previous object
        this.deselectObject();

        this.selectedObject = mesh;
        
        // Highlight the selected object
        if (mesh.material.emissive) {
            mesh.material.emissive.setHex(0x444444);
        }

        // Update object info panel to highlight the selected object
        this.highlightObjectInPanel(mesh.userData.instanceData?.instance);
    }

    deselectObject() {
        if (this.selectedObject) {
            // Remove highlight
            if (this.selectedObject.material.emissive) {
                this.selectedObject.material.emissive.setHex(0x000000);
            }
            this.selectedObject = null;
        }

        // Remove highlight from panel
        this.removeHighlightFromPanel();
    }

    highlightObjectInPanel(instanceName) {
        const panel = document.getElementById('objectInfoPanel');
        if (!panel) return;

        // Remove previous highlights
        panel.querySelectorAll('.object-item').forEach(item => {
            item.style.background = '#fafafa';
            item.style.borderColor = '#e0e0e0';
            item.style.transform = 'none';
        });

        // Highlight the selected object
        const selectedItem = panel.querySelector(`[data-instance="${instanceName}"]`);
        if (selectedItem) {
            selectedItem.style.background = '#e8f4fd';
            selectedItem.style.borderColor = '#3273dc';
            selectedItem.style.transform = 'scale(1.02)';
            selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    removeHighlightFromPanel() {
        const panel = document.getElementById('objectInfoPanel');
        if (!panel) return;

        panel.querySelectorAll('.object-item').forEach(item => {
            item.style.background = '#fafafa';
            item.style.borderColor = '#e0e0e0';
            item.style.transform = 'none';
        });
    }

    resetView() {
        if (this.loadedModel) {
            // Calculate the bounding box of the loaded model
            const box = new THREE.Box3().setFromObject(this.loadedModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // Calculate optimal camera distance - closer to make bbox larger and fill viewport
            // Consider the dimensions that will be most visible from +Z view (X and Y)
            const visibleDim = Math.max(size.x, size.y);
            const fov = this.camera.fov * (Math.PI / 180);
            const cameraDistance = visibleDim / (2 * Math.tan(fov / 2)) * 1.05;
            
            // Position camera to see the whole scene from +Z axis looking towards -Z axis
            this.camera.position.set(
                center.x,
                center.y + cameraDistance * 0.3,
                center.z + cameraDistance
            );
            
            this.camera.lookAt(center);
            this.controls.target.copy(center);
            this.controls.update();
        } else {
            // Fallback to default position if no model loaded
            this.camera.position.set(100, 150, 200);
            this.controls.target.set(100, 0, 40);
            this.controls.update();
        }
        this.deselectObject();
    }

    toggleWireframe() {
        if (!this.loadedModel) return;

        this.loadedModel.traverse((child) => {
            if (child.isMesh) {
                child.material.wireframe = !child.material.wireframe;
            }
        });
    }

    showAllObjects() {
        if (!this.loadedModel) return;

        // Calculate bounding box of all objects
        const box = new THREE.Box3().setFromObject(this.loadedModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Position camera to see all objects
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2;
        
        const newPosition = center.clone().add(new THREE.Vector3(distance, distance, distance));
        this.animateCameraTo(newPosition, center);
    }

    showLoadingIndicator(show) {
        const container = document.getElementById('sceneViewer');
        if (!container) return;

        let indicator = container.querySelector('.loading-indicator');
        
        if (show && !indicator) {
            indicator = document.createElement('div');
            indicator.className = 'loading-indicator';
            indicator.style.cssText = `
                position: absolute; 
                top: 50%; 
                left: 50%; 
                transform: translate(-50%, -50%); 
                text-align: center; 
                color: #666;
                background: rgba(255,255,255,0.95);
                padding: 2rem;
                border-radius: 8px;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            indicator.innerHTML = `
                <i class="fas fa-spinner fa-spin fa-3x" style="margin-bottom: 1rem;"></i>
                <p id="loadingText">Loading 3D Scene...</p>
                <div id="loadingProgress" style="margin-top: 1rem; font-size: 0.9rem; color: #999;"></div>
            `;
            container.appendChild(indicator);
        } else if (!show && indicator) {
            indicator.remove();
        }
    }

    updateLoadingProgress(percentage, bytesLoaded) {
        const progressEl = document.getElementById('loadingProgress');
        if (!progressEl) return;

        if (percentage !== null) {
            progressEl.textContent = `${percentage}% loaded`;
        } else if (bytesLoaded) {
            const mb = (bytesLoaded / (1024 * 1024)).toFixed(1);
            progressEl.textContent = `${mb} MB loaded`;
        }
    }

    onWindowResize() {
        const container = document.getElementById('sceneViewer');
        if (!container) return;

        const width = container.offsetWidth;
        const height = container.offsetHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.controls) {
            this.controls.update();
        }
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    async generateThumbnails() {
        console.log('Generating scene thumbnails...');
        const thumbnailsContainer = document.getElementById('sceneThumbnails');
        if (!thumbnailsContainer) {
            console.warn('Thumbnails container not found');
            return;
        }

        // Detect available scenes dynamically by trying to load JSON files
        const scenes = await this.detectAvailableScenes();

        thumbnailsContainer.innerHTML = '';

        scenes.forEach(scene => {
            const thumbnailDiv = document.createElement('div');
            thumbnailDiv.className = 'scene-thumbnail';
            thumbnailDiv.dataset.sceneId = scene.id;

            const previewDiv = document.createElement('div');
            previewDiv.className = 'scene-thumbnail-preview';
            
            // Create a mini canvas for the thumbnail preview
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 100;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            previewDiv.appendChild(canvas);

            const infoDiv = document.createElement('div');
            infoDiv.className = 'scene-thumbnail-info';
            
            const descDiv = document.createElement('div');
            descDiv.className = 'scene-thumbnail-desc';
            descDiv.textContent = scene.description;
            descDiv.style.fontSize = '0.8rem';
            descDiv.style.lineHeight = '1.3';

            infoDiv.appendChild(descDiv);
            
            thumbnailDiv.appendChild(previewDiv);
            thumbnailDiv.appendChild(infoDiv);

            // Add click handler
            thumbnailDiv.addEventListener('click', () => {
                this.selectSceneThumbnail(scene.id);
                this.loadScene(scene.id);
            });

            thumbnailsContainer.appendChild(thumbnailDiv);

            // Generate thumbnail preview
            this.generateThumbnailPreview(canvas, scene.id);
        });

        // Store total thumbnails and setup navigation
        this.totalThumbnails = scenes.length;
        this.setupThumbnailNavigation();
        this.updateThumbnailDisplay();

        // Select first thumbnail by default
        if (scenes.length > 0) {
            this.selectSceneThumbnail(scenes[0].id);
        }
    }

    async detectAvailableScenes() {
        console.log('Detecting available scenes...');
        const scenes = [];
        
        // Try to detect scenes by attempting to load JSON files
        // Start with a reasonable range (001-020) and expand as needed
        const sceneIds = ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010'];
        
        for (const sceneId of sceneIds) {
            try {
                const response = await fetch(`./assets/gallery/${sceneId}.json`);
                if (response.ok) {
                    const sceneData = await response.json();
                    
                    // Extract scene info from the JSON data
                    const environment = sceneData.input_task_description?.Environment || `Scene ${sceneId}`;
                    const task = sceneData.input_task_description?.Task || 'Tabletop Organization';
                    
                    scenes.push({
                        id: sceneId,
                        title: `Scene ${sceneId}`,
                        description: task.length > 50 ? task.substring(0, 50) + '...' : task
                    });
                    
                    console.log(`✓ Found scene ${sceneId}: ${task}`);
                } else {
                    console.log(`✗ Scene ${sceneId} not found (${response.status})`);
                }
            } catch (error) {
                console.log(`✗ Scene ${sceneId} failed to load:`, error.message);
            }
        }
        
        console.log(`Total scenes detected: ${scenes.length}`);
        return scenes;
    }

    selectSceneThumbnail(sceneId) {
        // Remove active class from all thumbnails
        const thumbnails = document.querySelectorAll('.scene-thumbnail');
        thumbnails.forEach(thumb => thumb.classList.remove('active'));

        // Add active class to selected thumbnail
        const selectedThumbnail = document.querySelector(`[data-scene-id="${sceneId}"]`);
        if (selectedThumbnail) {
            selectedThumbnail.classList.add('active');
        }
    }

    async generateThumbnailPreview(canvas, sceneId) {
        try {
            // Load PNG image instead of rendering GLB
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            const ctx = canvas.getContext('2d');
            
            img.onload = () => {
                // Clear canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw image to fit canvas while maintaining aspect ratio
                const aspectRatio = img.width / img.height;
                const canvasAspectRatio = canvas.width / canvas.height;
                
                let drawWidth, drawHeight, drawX, drawY;
                
                if (aspectRatio > canvasAspectRatio) {
                    // Image is wider than canvas
                    drawWidth = canvas.width;
                    drawHeight = canvas.width / aspectRatio;
                    drawX = 0;
                    drawY = (canvas.height - drawHeight) / 2;
                } else {
                    // Image is taller than canvas
                    drawHeight = canvas.height;
                    drawWidth = canvas.height * aspectRatio;
                    drawX = (canvas.width - drawWidth) / 2;
                    drawY = 0;
                }
                
                ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
            };
            
            img.onerror = () => {
                console.warn(`Failed to load preview image for scene ${sceneId}`);
                // Show a placeholder
                ctx.fillStyle = '#f0f0f0';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#999';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Scene Preview', canvas.width/2, canvas.height/2);
            };
            
            // Try to load PNG image
            img.src = `./assets/gallery/${sceneId}.png`;

        } catch (error) {
            console.warn(`Failed to generate thumbnail for scene ${sceneId}:`, error);
            // Show a placeholder
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#999';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Scene Preview', canvas.width/2, canvas.height/2);
        }
    }

    // Extract object type from instance name (e.g., "desk_lamp_0" -> "desk_lamp")
    getObjectType(instanceName) {
        // Match everything before the first underscore followed by a digit
        const match = instanceName.match(/^(.+?)_\d+$/);
        return match ? match[1] : instanceName.split('_')[0];
    }

    // Get a consistent color for each object type with maximum contrast
    getObjectTypeColor(objectType) {
        // Completely unique color palette with maximum visual contrast
        // No duplicate colors, arranged for optimal distribution
        const colors = [
            '#e74c3c', // Bright Red
            '#3498db', // Sky Blue
            '#2ecc71', // Emerald Green  
            '#f39c12', // Orange
            '#9b59b6', // Amethyst Purple
            '#1abc9c', // Turquoise
            '#e67e22', // Carrot Orange
            '#34495e', // Wet Asphalt
            '#f1c40f', // Sun Flower Yellow
            '#95a5a6', // Concrete Gray
            '#c0392b', // Pomegranate Red
            '#2980b9', // Belize Blue
            '#27ae60', // Nephritis Green
            '#d35400', // Pumpkin Orange
            '#8e44ad', // Wisteria Purple
            '#16a085', // Green Sea
            '#e91e63', // Pink
            '#00bcd4', // Dark Turquoise
            '#ff9800', // Material Orange
            '#673ab7', // Deep Purple
            '#607d8b', // Blue Grey
            '#795548', // Brown
            '#009688', // Teal
            '#ff5722', // Deep Orange Red
            '#9c27b0', // Material Purple
            '#2196f3', // Material Blue
            '#689f38', // Light Green
            '#ff6f00'  // Amber Orange
        ];

        // Create a robust hash that ensures unique distribution
        let hash = 0;
        for (let i = 0; i < objectType.length; i++) {
            hash = objectType.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // Add string length as additional entropy
        hash = hash + objectType.length * 31;
        
        // Convert to positive number
        hash = Math.abs(hash);
        
        // Use the Golden Ratio method for optimal distribution
        // Adding a prime offset to avoid clustering at index 0
        const goldenRatio = 0.618033988749;
        const primeOffset = 7; // Prime number offset
        const scaledHash = (hash + primeOffset) * goldenRatio;
        const fractionalPart = scaledHash - Math.floor(scaledHash);
        const colorIndex = Math.floor(fractionalPart * colors.length);
        
        // Debug logging (remove in production)
        console.log(`ObjectType: "${objectType}" -> Hash: ${hash} -> ColorIndex: ${colorIndex} -> Color: ${colors[colorIndex]}`);
        
        return colors[colorIndex];
    }

    setupThumbnailNavigation() {
        console.log('Setting up thumbnail navigation...');
        const prevBtn = document.getElementById('thumbnailPrev');
        const nextBtn = document.getElementById('thumbnailNext');
        
        console.log('Navigation buttons found:', { prevBtn: !!prevBtn, nextBtn: !!nextBtn });
        console.log('Total thumbnails:', this.totalThumbnails);
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                console.log('Previous button clicked');
                this.previousThumbnails();
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                console.log('Next button clicked, current index:', this.currentThumbnailIndex);
                this.nextThumbnails();
            });
        }
    }

    updateThumbnailDisplay() {
        const thumbnailsContainer = document.getElementById('sceneThumbnails');
        const prevBtn = document.getElementById('thumbnailPrev');
        const nextBtn = document.getElementById('thumbnailNext');
        
        if (!thumbnailsContainer) {
            console.error('Thumbnails container not found!');
            return;
        }

        // Calculate the offset for current page
        const offset = this.currentThumbnailIndex * (220); // 200px width + 20px gap
        console.log('Updating display - Index:', this.currentThumbnailIndex, 'Offset:', offset);
        thumbnailsContainer.style.transform = `translateX(-${offset}px)`;

        // Update navigation button states
        const maxIndex = Math.max(0, this.totalThumbnails - this.thumbnailsPerPage);
        console.log('Max index:', maxIndex, 'Current index:', this.currentThumbnailIndex);
        
        if (prevBtn) {
            const isPrevDisabled = this.currentThumbnailIndex === 0;
            prevBtn.classList.toggle('disabled', isPrevDisabled);
            console.log('Previous button disabled:', isPrevDisabled);
        }
        
        if (nextBtn) {
            const isNextDisabled = this.currentThumbnailIndex >= maxIndex;
            nextBtn.classList.toggle('disabled', isNextDisabled);
            console.log('Next button disabled:', isNextDisabled);
        }
    }

    previousThumbnails() {
        if (this.currentThumbnailIndex > 0) {
            this.currentThumbnailIndex--;
            this.updateThumbnailDisplay();
        }
    }

    nextThumbnails() {
        const maxIndex = Math.max(0, this.totalThumbnails - this.thumbnailsPerPage);
        console.log('Next thumbnails - Current:', this.currentThumbnailIndex, 'Max:', maxIndex, 'Total:', this.totalThumbnails);
        if (this.currentThumbnailIndex < maxIndex) {
            this.currentThumbnailIndex++;
            console.log('Moving to next page, new index:', this.currentThumbnailIndex);
            this.updateThumbnailDisplay();
        } else {
            console.log('Already at last page, cannot go next');
        }
    }
}

export { SceneGallery };
