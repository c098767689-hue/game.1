import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { CONFIG, CLASSES, WEAPONS, Weapon, PlayerClass, Enemy, Bullet, Particle, Debris, Obstacle, Airstrike, Drop, UpgradeOption, TEXT } from '../types';
import { sfx } from '../utils/soundManager';

export const Game: React.FC = () => {
    // --- React State for UI ---
    const [gameStateStr, setGameStateStr] = useState<'menu' | 'weaponSelect' | 'playing' | 'paused' | 'gameover' | 'upgrade'>('menu');
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [score, setScore] = useState(0);
    const [wave, setWave] = useState(1);
    const [hp, setHp] = useState(100);
    const [shield, setShield] = useState(0);
    const [weaponIdx, setWeaponIdx] = useState(0);
    const [upgradeOptions, setUpgradeOptions] = useState<[UpgradeOption, UpgradeOption] | null>(null);
    const [floatTexts, setFloatTexts] = useState<{ id: number; text: string; x: number; y: number; color: string }[]>([]);
    const [notifications, setNotifications] = useState<{ id: number; title: string; subtitle: string; color: string }[]>([]);
    const [skillCooldownPct, setSkillCooldownPct] = useState(0);
    const [dashCooldownPct, setDashCooldownPct] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [lang, setLang] = useState<'en' | 'zh'>('en');

    // --- Refs for Game Loop Data (Mutable, High Performance) ---
    const mountRef = useRef<HTMLDivElement>(null);
    const damageOverlayRef = useRef<HTMLDivElement>(null);
    const fogRef = useRef<HTMLDivElement>(null); // Fog of War
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const playerRef = useRef<THREE.Mesh | null>(null);
    const frameIdRef = useRef<number>(0);
    
    // CRITICAL: Use Ref for selectedClassId to avoid stale closures in game loop
    const selectedClassIdRef = useRef<string | null>(null);

    // Game Entities
    const enemiesRef = useRef<Enemy[]>([]);
    const bulletsRef = useRef<Bullet[]>([]);
    const enemyBulletsRef = useRef<Bullet[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const debrisRef = useRef<Debris[]>([]);
    const obstaclesRef = useRef<Obstacle[]>([]);
    const airstrikesRef = useRef<Airstrike[]>([]);
    const dropsRef = useRef<Drop[]>([]);
    
    // Game State stored in Ref to avoid closures in loop
    const stateRef = useRef({
        frameCount: 0,
        lastShot: 0,
        dashCooldown: 0,
        skillCooldown: 0,
        dashFrames: 0,
        weaponDamageMult: 1.0,
        weaponIdx: 0, 
        sniperBuff: false,
        sniperBuffTimer: 0,
        sniperShotCount: 0,
        invulnerable: 0,
        lastWeaponUpgradeScore: 0,
        lastSkillUpgradeScore: 0,
        shakeIntensity: 0,
        damageIntensity: 0,
        isPlaying: false,
        isPaused: false,
        hp: 100,
        shield: 0,
        score: 0,
        wave: 1,
        lang: 'en' as 'en' | 'zh',
        nextSkillUpgradeScore: CONFIG.scorePerSkillUpgrade,
        nextWeaponUpgradeScore: CONFIG.scorePerWeaponUpgrade,
        skillUpgradeCount: 0,
        weaponUpgradeCount: 0,
        bonusMissileDmg: 0,
        bonusBlastRadius: 0,
        bonusHeal: 0,
        bonusSpeed: 0,
        bonusMaxHp: 0,
        lifesteal: 0,
        critChance: 0,
        pierceChance: 0,
        executeThreshold: 0,
        regen: 0,
        autoTurret: false,
        staticField: false,
        clusterMunitions: false,
        ammoScavenger: false
    });

    const keys = useRef<{ [key: string]: boolean }>({ w: false, a: false, s: false, d: false, shift: false, q: false });
    const mouse = useRef(new THREE.Vector2());
    const raycaster = useRef(new THREE.Raycaster());
    const isMouseDown = useRef(false);

    // Sync lang state to ref for loop access
    useEffect(() => {
        stateRef.current.lang = lang;
    }, [lang]);

    // --- Helper to update React State from loop ---
    const lastUpdateRef = useRef(0);
    const updateUI = () => {
        const now = Date.now();
        if (now - lastUpdateRef.current > 100) { 
            lastUpdateRef.current = now;
            // Use Ref to access class
            const cls = selectedClassIdRef.current ? CLASSES[selectedClassIdRef.current] : null;
            if (cls) {
                setSkillCooldownPct((stateRef.current.skillCooldown / cls.cd) * 100);
            }
            setDashCooldownPct((stateRef.current.dashCooldown / 120) * 100);
        }
    };

    // --- Initialization ---
    useEffect(() => {
        if (!mountRef.current) return;

        // Scene Setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111111);
        scene.fog = new THREE.FogExp2(0x111111, 0.02);
        sceneRef.current = scene;

        const aspect = window.innerWidth / window.innerHeight;
        const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        camera.position.set(0, 25, 15);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Lights
        const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.camera.top = 30;
        dirLight.shadow.camera.bottom = -30;
        dirLight.shadow.camera.left = -30;
        dirLight.shadow.camera.right = 30;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        scene.add(dirLight);

        // Ground & Grid
        const gridHelper = new THREE.GridHelper(CONFIG.mapSize, 40, 0x444444, 0x222222);
        scene.add(gridHelper);
        const planeGeo = new THREE.PlaneGeometry(CONFIG.mapSize, CONFIG.mapSize);
        const planeMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.ground, roughness: 0.8 });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.rotation.x = -Math.PI / 2;
        plane.receiveShadow = true;
        plane.name = "ground";
        scene.add(plane);

        // Boundaries
        const limit = CONFIG.mapSize / 2;
        const points = [
            new THREE.Vector3(-limit, 0.5, -limit), new THREE.Vector3(limit, 0.5, -limit),
            new THREE.Vector3(limit, 0.5, limit), new THREE.Vector3(-limit, 0.5, limit),
            new THREE.Vector3(-limit, 0.5, -limit)
        ];
        const bGeo = new THREE.BufferGeometry().setFromPoints(points);
        const bMat = new THREE.LineBasicMaterial({ color: CONFIG.colors.boundary, linewidth: 2 });
        const border = new THREE.Line(bGeo, bMat);
        border.position.y = 0.1;
        scene.add(border);

        // Event Listeners
        const onResize = () => {
            if (cameraRef.current && rendererRef.current) {
                cameraRef.current.aspect = window.innerWidth / window.innerHeight;
                cameraRef.current.updateProjectionMatrix();
                rendererRef.current.setSize(window.innerWidth, window.innerHeight);
            }
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (stateRef.current.isPlaying) {
                    toggleSettings();
                }
            }
            keys.current[e.key.toLowerCase()] = true;
        };
        const onKeyUp = (e: KeyboardEvent) => keys.current[e.key.toLowerCase()] = false;
        const onMouseMove = (e: MouseEvent) => {
            mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
        };
        const onMouseDown = () => isMouseDown.current = true;
        const onMouseUp = () => isMouseDown.current = false;

        window.addEventListener('resize', onResize);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);

        // Start Loop
        animate();

        return () => {
            cancelAnimationFrame(frameIdRef.current);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mouseup', onMouseUp);
            if (rendererRef.current && mountRef.current) {
                mountRef.current.removeChild(rendererRef.current.domElement);
            }
            // Simple dispose
            scene.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    object.geometry.dispose();
                    if (object.material instanceof THREE.Material) object.material.dispose();
                }
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleSettings = () => {
        const isNowPaused = !showSettings;
        setShowSettings(isNowPaused);
        stateRef.current.isPaused = isNowPaused;
    };

    const confirmQuit = () => {
        setShowSettings(false);
        setGameStateStr('menu');
        stateRef.current.isPlaying = false;
        stateRef.current.isPaused = false;
    };

    // --- Game Logic Functions ---

    const flashEnemy = (e: Enemy) => {
        if (e.mesh.material instanceof THREE.MeshStandardMaterial) {
            e.mesh.material.emissive.setHex(0xffffff);
            e.mesh.material.emissiveIntensity = 0.8;
            setTimeout(() => {
                if (e.mesh && e.mesh.material instanceof THREE.MeshStandardMaterial) {
                    if (e.isElite) {
                        e.mesh.material.emissive.setHex(0x4a0072);
                        e.mesh.material.emissiveIntensity = 0.5;
                    } else {
                        e.mesh.material.emissive.setHex(0x000000);
                        e.mesh.material.emissiveIntensity = 0;
                    }
                }
            }, 50);
        }
    };

    const createObstacles = () => {
        if (!sceneRef.current) return;
        obstaclesRef.current.forEach(o => sceneRef.current?.remove(o.mesh));
        obstaclesRef.current = [];

        const count = 12 + Math.floor(Math.random() * 5);
        for (let i = 0; i < count; i++) {
            let x = 0, z = 0, valid = false;
            while (!valid) {
                x = (Math.random() - 0.5) * 80;
                z = (Math.random() - 0.5) * 80;
                if (Math.sqrt(x * x + z * z) > 10) valid = true;
            }
            const w = 2 + Math.random() * 3;
            const h = 2 + Math.random() * 2;
            const d = 2 + Math.random() * 3;
            const geo = new THREE.BoxGeometry(w, h, d);
            const mat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.obstacle });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, h / 2, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            sceneRef.current.add(mesh);
            mesh.updateMatrixWorld();
            const radius = Math.sqrt(w*w + d*d) / 2;
            obstaclesRef.current.push({ 
                mesh, 
                box: new THREE.Box3().setFromObject(mesh),
                position: mesh.position.clone(),
                radius
            });
        }
    };

    const startGame = (classId: string) => {
        if (!sceneRef.current) return;
        sfx.init();
        setSelectedClassId(classId);
        selectedClassIdRef.current = classId; // Sync Ref immediately
        
        // Reset Player
        if (playerRef.current) sceneRef.current.remove(playerRef.current);
        const cls = CLASSES[classId];
        const pGeo = new THREE.BoxGeometry(1, 1, 1);
        const pMat = new THREE.MeshStandardMaterial({ color: cls.color });
        const player = new THREE.Mesh(pGeo, pMat);
        player.position.set(0, 0.5, 0);
        player.castShadow = true;
        sceneRef.current.add(player);
        const gunGeo = new THREE.BoxGeometry(0.2, 0.2, 0.8);
        const gunMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
        const gun = new THREE.Mesh(gunGeo, gunMat);
        gun.position.set(0, 0.2, 0.5);
        player.add(gun);
        playerRef.current = player;

        // Reset State
        stateRef.current = {
            ...stateRef.current,
            isPlaying: false, // Wait for weapon select
            isPaused: false,
            frameCount: 0,
            weaponDamageMult: 1.0,
            weaponIdx: 0,
            dashCooldown: 0,
            skillCooldown: 0,
            hp: 100,
            shield: 0,
            score: 0,
            wave: 1,
            lastWeaponUpgradeScore: 0,
            lastSkillUpgradeScore: 0,
            invulnerable: 0,
            sniperBuff: false,
            sniperBuffTimer: 0,
            damageIntensity: 0,
            nextSkillUpgradeScore: CONFIG.scorePerSkillUpgrade,
            nextWeaponUpgradeScore: CONFIG.scorePerWeaponUpgrade,
            skillUpgradeCount: 0,
            weaponUpgradeCount: 0,
            bonusMissileDmg: 0,
            bonusBlastRadius: 0,
            bonusHeal: 0,
            bonusSpeed: 0,
            bonusMaxHp: 0,
            lifesteal: 0,
            critChance: 0,
            pierceChance: 0,
            executeThreshold: 0,
            regen: 0,
            autoTurret: false,
            staticField: false,
            clusterMunitions: false,
            ammoScavenger: false
        };
        setHp(100);
        setShield(0);
        setScore(0);
        setWave(1);
        setWeaponIdx(0);
        setGameStateStr('weaponSelect'); // Go to weapon selection

        // Clear Entities
        enemiesRef.current.forEach(e => sceneRef.current?.remove(e.mesh)); enemiesRef.current = [];
        bulletsRef.current.forEach(b => sceneRef.current?.remove(b.mesh)); bulletsRef.current = [];
        enemyBulletsRef.current.forEach(b => sceneRef.current?.remove(b.mesh)); enemyBulletsRef.current = [];
        particlesRef.current.forEach(p => sceneRef.current?.remove(p.mesh)); particlesRef.current = [];
        debrisRef.current.forEach(d => sceneRef.current?.remove(d.mesh)); debrisRef.current = [];
        airstrikesRef.current.forEach(a => sceneRef.current?.remove(a.indicator)); airstrikesRef.current = [];
        dropsRef.current.forEach(d => sceneRef.current?.remove(d.mesh)); dropsRef.current = [];

        // Reset Modifiers for ALL classes to prevent cross-game persistence
        CLASSES.infantry.missileCount = 1; CLASSES.infantry.missileMode = 'normal'; CLASSES.infantry.cd = 300;
        CLASSES.engineer.blastRadius = 8; CLASSES.engineer.blastMode = 'normal'; CLASSES.engineer.cd = 480;
        CLASSES.medic.healAmount = 25; CLASSES.medic.healMode = 'normal'; CLASSES.medic.cd = 1800;
        CLASSES.sniper.shotMode = 'normal'; CLASSES.sniper.cd = 1800; CLASSES.sniper.duration = 300;

        createObstacles();
    };

    const selectStartingWeapon = (wIndex: number) => {
        stateRef.current.weaponIdx = wIndex;
        setWeaponIdx(wIndex);
        setGameStateStr('playing');
        stateRef.current.isPlaying = true;
    };

    const spawnEnemy = () => {
        if (!sceneRef.current) return;
        const timeInSeconds = stateRef.current.frameCount / 60;
        const maxEnemies = 25 + Math.floor(timeInSeconds / 5);
        if (enemiesRef.current.length >= maxEnemies) return;

        let x = 0, z = 0;
        const side = Math.floor(Math.random() * 4);
        const limit = 45;
        const offset = (Math.random() - 0.5) * 2 * limit;
        switch (side) {
            case 0: x = offset; z = -limit; break;
            case 1: x = limit; z = offset; break;
            case 2: x = offset; z = limit; break;
            case 3: x = -limit; z = offset; break;
        }

        const isElite = Math.random() < CONFIG.eliteChance;
        const isRanged = !isElite && (Math.random() < 0.12);
        
        if (isElite) {
            sfx.playEliteSpawn();
        }

        const baseHp = 100 + stateRef.current.wave * 30;
        const enemyHp = isElite ? baseHp * (3 + Math.random() * 3) : (isRanged ? baseHp * 0.6 : baseHp);
        
        let col, geo, size = isElite ? 1.5 : 0.8;
        if (isElite) col = CONFIG.colors.enemyElite;
        else if (isRanged) col = CONFIG.colors.enemyRanged;
        else col = CONFIG.colors.enemy;

        if (isRanged) geo = new THREE.ConeGeometry(size / 2, size, 8);
        else geo = new THREE.BoxGeometry(size, size, size);
        
        const mat = new THREE.MeshStandardMaterial({ color: col, emissive: isElite ? 0x4a0072 : 0, emissiveIntensity: isElite ? 0.5 : 0 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, size / 2, z);
        mesh.castShadow = true;
        sceneRef.current.add(mesh);

        const flankAngle = Math.random() * Math.PI * 2;

        enemiesRef.current.push({ 
            mesh, 
            hp: enemyHp, 
            isElite, 
            type: isRanged ? 'ranged' : 'melee', 
            lastShot: 0,
            flankAngle,
            aiState: 'seeking'
        });
    };

    const addFloatText = (text: string, x: number, y: number, color: string = '#00ff00') => {
        if (!cameraRef.current) return;
        const vector = new THREE.Vector3(x, 1, y);
        vector.project(cameraRef.current);
        const sx = (vector.x * .5 + .5) * window.innerWidth;
        const sy = (-(vector.y * .5) + .5) * window.innerHeight;

        const id = Date.now() + Math.random();
        setFloatTexts(prev => [...prev, { id, text, x: sx, y: sy, color }]);
        setTimeout(() => {
            setFloatTexts(prev => prev.filter(ft => ft.id !== id));
        }, 800);
    };

    const addNotification = (title: string, subtitle: string, color: string) => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, title, subtitle, color }]);
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 3000);
    };

    const createExplosion = (pos: THREE.Vector3, color: number, scale: number) => {
        if (!sceneRef.current) return;
        const geo = new THREE.SphereGeometry(scale / 3, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        sceneRef.current.add(mesh);
        createParticle(pos, color, scale * 3);
        setTimeout(() => { if (sceneRef.current) sceneRef.current.remove(mesh); }, 50);
    };

    const createParticle = (pos: THREE.Vector3, color: number, count: number, spd = 0.2) => {
        if (!sceneRef.current) return;
        for (let i = 0; i < count; i++) {
            const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
            const mat = new THREE.MeshBasicMaterial({ color: color });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(pos);
            mesh.position.x += (Math.random() - 0.5);
            mesh.position.z += (Math.random() - 0.5);
            const vel = new THREE.Vector3((Math.random() - 0.5) * spd, Math.random() * spd, (Math.random() - 0.5) * spd);
            sceneRef.current.add(mesh);
            particlesRef.current.push({ mesh, velocity: vel, life: 30 + Math.random() * 20 });
        }
    };

    const shoot = () => {
        if (!playerRef.current || !sceneRef.current) return;
        const weapon = WEAPONS[stateRef.current.weaponIdx];
        
        // Use Ref for selected class
        const currentClassId = selectedClassIdRef.current;
        const cls = currentClassId ? CLASSES[currentClassId] : null;
        
        let isLethal = (currentClassId === 'sniper' && stateRef.current.sniperBuff);
        let dmgMult = stateRef.current.weaponDamageMult;
        
        if (isLethal) { 
            sfx.playShoot(0.5); 
            stateRef.current.shakeIntensity = 1.0;
        } else { 
            sfx.playShoot(weapon.pitch); 
            if(weapon.explosive || weapon.damage > 50) stateRef.current.shakeIntensity = 0.2; 
        }

        const count = isLethal ? 1 : weapon.count;
        for(let i=0; i<count; i++) {
            let bulletGeo: THREE.BufferGeometry, size = weapon.size || 0.15, color = weapon.color;
            if (isLethal) { size = 0.4; color = 0xff0000; bulletGeo = new THREE.BoxGeometry(0.2, 0.2, 2.0); }
            else if (weapon.isFlame) bulletGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
            else bulletGeo = new THREE.SphereGeometry(size, 8, 8);
            
            const bulletMat = new THREE.MeshBasicMaterial({ color: color });
            const bullet = new THREE.Mesh(bulletGeo, bulletMat);
            bullet.position.copy(playerRef.current.position); 
            bullet.position.y = 0.7;
            
            const direction = new THREE.Vector3(0, 0, 1); 
            direction.applyQuaternion(playerRef.current.quaternion);
            
            if (weapon.dual) {
                const sideOffset = (i % 2 === 0) ? -0.4 : 0.4;
                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerRef.current.quaternion);
                bullet.position.add(right.multiplyScalar(sideOffset));
            } else if (weapon.parallel) {
                const offset = (i === 0) ? -0.3 : 0.3;
                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerRef.current.quaternion);
                bullet.position.add(right.multiplyScalar(offset));
            } else if (weapon.spread > 0 && !isLethal) {
                let spr = weapon.spread;
                direction.x += (Math.random() - 0.5) * spr; 
                direction.z += (Math.random() - 0.5) * spr; 
                direction.normalize();
            }
            
            bullet.position.add(direction.clone().multiplyScalar(0.6));
            sceneRef.current.add(bullet);
            
            let finalDmg = weapon.damage * dmgMult;
            if (isLethal) finalDmg = 9999;

            let explosive = weapon.explosive;
            let areaDmg = weapon.areaDmg ? weapon.areaDmg * dmgMult : 0;
            let areaRadius = weapon.areaRadius;
            if (isLethal && cls?.shotMode === 'explosive') { explosive = true; areaDmg = 2000; areaRadius = 10; }

            let penetrate = isLethal || weapon.penetrate;
            if (stateRef.current.pierceChance > 0) penetrate = true;

            bulletsRef.current.push({
                mesh: bullet, 
                velocity: direction.multiplyScalar(isLethal ? 5.0 : weapon.speed),
                life: weapon.life, 
                damage: finalDmg,
                explosive: explosive, 
                areaDmg: areaDmg, 
                areaRadius: areaRadius,
                penetrate: penetrate, 
                homing: weapon.homing, 
                knockback: weapon.knockback || 0.3
            });
        }
    };

    const activateSkill = () => {
        // Use Ref for selected class
        const currentClassId = selectedClassIdRef.current;
        if (!playerRef.current || !currentClassId || !sceneRef.current) return;
        
        const cls = CLASSES[currentClassId];
        const txt = TEXT[stateRef.current.lang];
        
        if (stateRef.current.bonusSpeed > 0) {
            // Speed boost handled in movement update
        }

        if (currentClassId === 'infantry') {
            if (!cameraRef.current) return;
            raycaster.current.setFromCamera(mouse.current, cameraRef.current);
            const intersects = raycaster.current.intersectObjects(sceneRef.current.children);
            const groundHit = intersects.find(i => i.object.name === 'ground');
            if (groundHit) {
                const t = groundHit.point;
                const missileCount = (cls.missileCount || 1);
                
                if (cls.missileMode === 'carpet') {
                    for(let i=-1; i<=1; i++){
                        const offsetT = t.clone(); offsetT.x += i*6;
                        createStrikeIndicator(offsetT, i*10);
                    }
                } else {
                    for(let i=0; i<missileCount; i++){
                        const offsetT = t.clone(); 
                        if(i>0){offsetT.x+=(Math.random()-0.5)*10; offsetT.z+=(Math.random()-0.5)*10;}
                        createStrikeIndicator(offsetT, i*10);
                    }
                }
            }
        } else if (currentClassId === 'engineer') {
            const r = (cls.blastRadius || 8) + stateRef.current.bonusBlastRadius;
            createExplosion(playerRef.current.position, 0xf97316, r + 4);
            applyAreaDamage(playerRef.current.position, r, 1000);
            
            // Visuals
            const ringGeo = new THREE.RingGeometry(0.5, r, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: cls.blastMode === 'nova' ? 0x00ffff : 0xf97316, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.copy(playerRef.current.position);
            ring.position.y = 0.1;
            sceneRef.current.add(ring);
            
            const expand = () => {
                ring.scale.multiplyScalar(1.1);
                ring.material.opacity -= 0.05;
                if (ring.material.opacity > 0) requestAnimationFrame(expand);
                else sceneRef.current?.remove(ring);
            };
            expand();
        } else if (currentClassId === 'medic') {
            const bonus = stateRef.current.bonusHeal;
            const newHp = Math.min(100 + stateRef.current.bonusMaxHp, stateRef.current.hp + (cls.healAmount || 25) + bonus);
            stateRef.current.hp = newHp;
            setHp(newHp);
            addFloatText(`+${(cls.healAmount || 25) + bonus} HP`, playerRef.current.position.x, playerRef.current.position.z, '#00ff00');
            sfx.playHeal();
            createParticle(playerRef.current.position, 0x00ff00, 20);
            
            if(cls.healMode === 'shield') {
                stateRef.current.invulnerable = 180;
                addFloatText(txt.shielded, playerRef.current.position.x, playerRef.current.position.z, '#ffffff');
            }
        } else if (currentClassId === 'sniper') {
            stateRef.current.sniperBuff = true;
            stateRef.current.sniperBuffTimer = cls.duration || 300;
            addFloatText(`${txt.lethalReady}`, playerRef.current.position.x, playerRef.current.position.z, "#ffffff");
            sfx.playSniperCharge();
        }
    };

    const createStrikeIndicator = (pos: THREE.Vector3, delay = 0) => {
        if (!sceneRef.current) return;
        const geo = new THREE.RingGeometry(0.5, 5, 32);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
        const m = new THREE.Mesh(geo, mat);
        m.rotation.x = -Math.PI / 2;
        m.position.copy(pos);
        m.position.y = 0.1;
        sceneRef.current.add(m);
        // PASSIVE: Cluster Munitions check could go here or in strike resolution
        airstrikesRef.current.push({ target: pos, timer: 60 + delay, indicator: m });
    };

    const applyAreaDamage = (center: THREE.Vector3, radius: number, damage: number) => {
        stateRef.current.shakeIntensity = 0.5;
        sfx.playExplosion(1.5);
        for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
            const e = enemiesRef.current[j];
            const dist = e.mesh.position.distanceTo(center);
            if (dist < radius) {
                e.hp -= damage + stateRef.current.bonusMissileDmg;
                flashEnemy(e);
                const pushDir = new THREE.Vector3().subVectors(e.mesh.position, center).normalize().multiplyScalar(2.0);
                if (!e.isElite) e.mesh.position.add(pushDir);
                if (e.hp <= 0) killEnemy(j);
            }
        }
    };

    const killEnemy = (index: number) => {
        const e = enemiesRef.current[index];
        const pos = e.mesh.position.clone();
        
        const col = e.isElite ? CONFIG.colors.enemyElite : (e.type === 'ranged' ? CONFIG.colors.enemyRanged : CONFIG.colors.enemy);
        for(let i=0; i<4; i++){
            const size = 0.2 + Math.random()*0.3;
            const geo = new THREE.BoxGeometry(size,size,size);
            const mat = new THREE.MeshStandardMaterial({ color: col });
            const mesh = new THREE.Mesh(geo,mat);
            mesh.position.copy(pos);
            const vel = new THREE.Vector3((Math.random()-0.5)*0.3, 0.2+Math.random()*0.3, (Math.random()-0.5)*0.3);
            sceneRef.current?.add(mesh);
            debrisRef.current.push({ mesh, velocity: vel, rotation: new THREE.Vector3(Math.random(),Math.random(),0), life: 60 });
        }

        createExplosion(pos, col, 2);
        sfx.playCrit();
        sceneRef.current?.remove(e.mesh);
        enemiesRef.current.splice(index, 1);
        
        const points = e.isElite ? 500 : 100;
        stateRef.current.score += points;
        setScore(stateRef.current.score);
        addFloatText(`+${points}`, pos.x, pos.z, '#ffff00');

        if (Math.random() < 0.1) {
            const g = new THREE.Group();
            const m = new THREE.MeshBasicMaterial({ color: 0x00bfff });
            g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.1), m));
            g.position.copy(pos); g.position.y = 0.5;
            sceneRef.current?.add(g);
            dropsRef.current.push({ mesh: g, type: 'shield', value: 10 });
        } else {
             let dropRate = e.isElite ? 0.5 : CONFIG.dropChance;
             if (stateRef.current.ammoScavenger) dropRate += 0.1;
             
             if (Math.random() < dropRate) {
                 const g = new THREE.Group();
                 const m = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                 g.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.2), m));
                 g.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.6), m));
                 g.position.copy(pos); g.position.y = 0.5;
                 sceneRef.current?.add(g);
                 dropsRef.current.push({ mesh: g, type: 'hp', value: 20 });
             }
        }
    };

    const animate = () => {
        frameIdRef.current = requestAnimationFrame(animate);
        
        if (!stateRef.current.isPlaying || stateRef.current.isPaused) return;
        
        stateRef.current.frameCount++;
        updateUI();

        if (stateRef.current.damageIntensity > 0) {
            stateRef.current.damageIntensity -= 0.05;
            if (stateRef.current.damageIntensity < 0) stateRef.current.damageIntensity = 0;
        }
        
        if (damageOverlayRef.current) {
            damageOverlayRef.current.style.opacity = stateRef.current.damageIntensity.toFixed(2);
        }
        if (mountRef.current) {
            const val = stateRef.current.damageIntensity;
            if (val > 0.01) {
                mountRef.current.style.filter = `blur(${val * 4}px) saturate(${Math.max(0, 1 - val)}) contrast(${1 + val * 0.5})`;
            } else {
                mountRef.current.style.filter = 'none';
            }
        }

        // Upgrades
        if (stateRef.current.score >= stateRef.current.nextSkillUpgradeScore) {
            stateRef.current.nextSkillUpgradeScore += (CONFIG.scorePerSkillUpgrade + (stateRef.current.skillUpgradeCount * 2000));
            stateRef.current.skillUpgradeCount++;
            pauseForUpgrade('skill');
            return;
        }
        if (stateRef.current.score >= stateRef.current.nextWeaponUpgradeScore) {
             stateRef.current.nextWeaponUpgradeScore += (CONFIG.scorePerWeaponUpgrade + (stateRef.current.weaponUpgradeCount * 3000));
             stateRef.current.weaponUpgradeCount++;
             pauseForUpgrade('weapon');
             return;
        }

        if (stateRef.current.regen > 0 && stateRef.current.frameCount % 300 === 0) { 
             const max = 100 + stateRef.current.bonusMaxHp;
             if (stateRef.current.hp < max) {
                 stateRef.current.hp = Math.min(max, stateRef.current.hp + stateRef.current.regen);
                 setHp(stateRef.current.hp);
                 addFloatText("+Regen", playerRef.current!.position.x, playerRef.current!.position.z, '#00ff00');
             }
        }

        // Sniper Buff Timer
        if (stateRef.current.sniperBuffTimer > 0) {
            stateRef.current.sniperBuffTimer--;
            if (stateRef.current.sniperBuffTimer <= 0) {
                stateRef.current.sniperBuff = false;
            }
        }

        // Player Logic
        if (playerRef.current) {
            // Use Ref for selected class
            const currentClassId = selectedClassIdRef.current;
            const cls = currentClassId ? CLASSES[currentClassId] : null;
            
            let currentSpeed = CONFIG.playerSpeed * (cls?.speedBonus || 1) * (1 + stateRef.current.bonusSpeed);
            
            if (stateRef.current.dashFrames > 0) {
                currentSpeed = CONFIG.playerDashSpeed;
                stateRef.current.dashFrames--;
                if (stateRef.current.frameCount % 3 === 0) createParticle(playerRef.current.position, cls?.color || 0xffffff, 1, 0.5);
            } else if (keys.current.shift && stateRef.current.dashCooldown <= 0) {
                stateRef.current.dashFrames = CONFIG.dashDuration;
                stateRef.current.dashCooldown = 120;
                stateRef.current.shakeIntensity = 0.2;
            }

            if (keys.current.q && stateRef.current.skillCooldown <= 0) {
                activateSkill();
                // Simple reset based on cls
                stateRef.current.skillCooldown = cls?.cd || 600;
            }

            let dx = 0, dz = 0;
            if (keys.current.w) dz -= 1; if (keys.current.s) dz += 1;
            if (keys.current.a) dx -= 1; if (keys.current.d) dx += 1;

            if (dx !== 0 || dz !== 0) {
                const len = Math.sqrt(dx * dx + dz * dz);
                dx = (dx / len) * currentSpeed;
                dz = (dz / len) * currentSpeed;

                const nextX = playerRef.current.position.x + dx;
                const nextZ = playerRef.current.position.z + dz;
                const playerBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(nextX, 0.5, nextZ), new THREE.Vector3(0.8, 1, 0.8));
                
                let collision = false;
                for (const obs of obstaclesRef.current) {
                    if (playerBox.intersectsBox(obs.box)) { collision = true; break; }
                }

                if (!collision) {
                    playerRef.current.position.x = Math.max(-CONFIG.boundaryLimit, Math.min(CONFIG.boundaryLimit, nextX));
                    playerRef.current.position.z = Math.max(-CONFIG.boundaryLimit, Math.min(CONFIG.boundaryLimit, nextZ));
                }
            }

            let nearestEnemy: Enemy | null = null;
            let minDist = 20;

            for (const e of enemiesRef.current) {
                const d = playerRef.current.position.distanceTo(e.mesh.position);
                if (d < minDist) {
                    minDist = d;
                    nearestEnemy = e;
                }
            }

            if (cameraRef.current) {
                if (nearestEnemy) {
                    const target = nearestEnemy.mesh.position.clone();
                    target.y = playerRef.current.position.y;
                    playerRef.current.lookAt(target);
                } else {
                    raycaster.current.setFromCamera(mouse.current, cameraRef.current);
                    const intersects = raycaster.current.intersectObjects(sceneRef.current?.children || []);
                    const ground = intersects.find(i => i.object.name === 'ground');
                    if (ground) {
                        const target = ground.point;
                        target.y = playerRef.current.position.y;
                        playerRef.current.lookAt(target);
                    }
                }
            }

            const weapon = WEAPONS[stateRef.current.weaponIdx];
            if (nearestEnemy && stateRef.current.frameCount - stateRef.current.lastShot > weapon.fireRate) {
                shoot();
                stateRef.current.lastShot = stateRef.current.frameCount;
            }
        }

        // Bullets Update
        for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
            const b = bulletsRef.current[i];
            b.mesh.position.add(b.velocity);
            b.life--;

            if (b.homing && enemiesRef.current.length > 0) {
                let closest: Enemy | null = null, minDst = 1000;
                for (const e of enemiesRef.current) {
                    const dst = b.mesh.position.distanceTo(e.mesh.position);
                    if (dst < minDst && dst < 15) { minDst = dst; closest = e; }
                }
                if (closest) {
                    const targetDir = new THREE.Vector3().subVectors(closest.mesh.position, b.mesh.position).normalize();
                    b.velocity.lerp(targetDir.multiplyScalar(b.velocity.length()), 0.1);
                    b.mesh.lookAt(b.mesh.position.clone().add(b.velocity));
                }
            }

            let hit = false;
            for (const obs of obstaclesRef.current) {
                if (b.mesh.position.distanceTo(obs.mesh.position) < 4) {
                    const box = new THREE.Box3().setFromObject(b.mesh);
                    if (box.intersectsBox(obs.box)) { hit = true; break; }
                }
            }
            if (!hit && (Math.abs(b.mesh.position.x) > CONFIG.boundaryLimit || Math.abs(b.mesh.position.z) > CONFIG.boundaryLimit)) hit = true;

            if (!hit) {
                for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
                    const e = enemiesRef.current[j];
                    const hitDist = (e.isElite ? 1.5 : 0.8) + (e.type === 'ranged' ? 0.2 : 0);
                    if (b.mesh.position.distanceTo(e.mesh.position) < (hitDist + 0.2)) {
                        if (!b.penetrate) hit = true;
                        createParticle(b.mesh.position, 0xffffff, 5); 
                        sfx.playHit();
                        
                        if (stateRef.current.lifesteal > 0 && Math.random() < stateRef.current.lifesteal) {
                            if (stateRef.current.hp < 100 + stateRef.current.bonusMaxHp) {
                                stateRef.current.hp = Math.min(100 + stateRef.current.bonusMaxHp, stateRef.current.hp + 2);
                                setHp(stateRef.current.hp);
                            }
                        }

                        if (b.explosive) {
                            createExplosion(b.mesh.position, 0xffaa00, (b.areaRadius || 4) * 2);
                            applyAreaDamage(b.mesh.position, b.areaRadius || 4, b.areaDmg || 50);
                            hit = true; 
                        } else {
                            let executed = false;
                            if (stateRef.current.executeThreshold > 0) {
                                if (e.hp < (100 + stateRef.current.wave * 30) * stateRef.current.executeThreshold) {
                                    e.hp = 0;
                                    executed = true;
                                    addFloatText("EXECUTE!", e.mesh.position.x, e.mesh.position.z, '#ff0000');
                                }
                            }
                            
                            if (!executed) {
                                let dmg = b.damage;
                                if (stateRef.current.critChance > 0 && Math.random() < stateRef.current.critChance) {
                                    dmg *= 2;
                                    addFloatText("CRIT!", e.mesh.position.x, e.mesh.position.z, '#ffff00');
                                }
                                e.hp -= dmg;
                            }
                            
                            flashEnemy(e);
                            if (!e.isElite && !b.penetrate) {
                                const pushback = b.velocity.clone().normalize().multiplyScalar(b.knockback || 0.3);
                                e.mesh.position.add(pushback);
                            }
                            if (e.hp <= 0) killEnemy(j);
                        }
                        if (hit) break;
                    }
                }
            }

            if (hit || b.life <= 0) {
                if (hit && b.explosive) {
                    createExplosion(b.mesh.position, 0xffaa00, (b.areaRadius || 4) * 2);
                    applyAreaDamage(b.mesh.position, b.areaRadius || 4, b.areaDmg || 50);
                }
                sceneRef.current?.remove(b.mesh);
                bulletsRef.current.splice(i, 1);
            }
        }

        // Enemies Spawn/Update
        if (stateRef.current.frameCount % 1800 === 0) {
            stateRef.current.wave++;
            setWave(stateRef.current.wave);
        }
        const spawnInterval = Math.max(10, 80 - Math.floor(stateRef.current.frameCount / 60 / 2));
        if (stateRef.current.frameCount % spawnInterval === 0) spawnEnemy();

        for (let i = 0; i < enemiesRef.current.length; i++) {
            const e = enemiesRef.current[i];
            if (!playerRef.current) break;
            const distToPlayer = e.mesh.position.distanceTo(playerRef.current.position);
            
            let targetPos = playerRef.current.position.clone();

            if (e.type === 'melee') {
                const flankRadius = 2.0;
                const angle = (e.flankAngle || 0) + stateRef.current.frameCount * 0.005;
                const offsetX = Math.cos(angle) * flankRadius;
                const offsetZ = Math.sin(angle) * flankRadius;
                targetPos.x += offsetX;
                targetPos.z += offsetZ;
            } 
            else if (e.type === 'ranged') {
                const idealDist = 12;
                
                if (distToPlayer < 20 && distToPlayer > 2) { 
                     if (stateRef.current.frameCount - e.lastShot > 120) {
                        const bGeo = new THREE.SphereGeometry(0.2, 8, 8);
                        const bMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                        const bullet = new THREE.Mesh(bGeo, bMat);
                        bullet.position.copy(e.mesh.position); bullet.position.y = 0.6;
                        const bDir = new THREE.Vector3().subVectors(playerRef.current.position, e.mesh.position).normalize();
                        bullet.position.add(bDir.clone().multiplyScalar(0.8));
                        sceneRef.current?.add(bullet);
                        enemyBulletsRef.current.push({ mesh: bullet, velocity: bDir.multiplyScalar(0.35), life: 100, damage: 10 });
                        sfx.playEnemyShoot();
                        e.lastShot = stateRef.current.frameCount;
                    }
                }

                let nearestObstacle: Obstacle | null = null;
                let minDistObs = 100;
                for (const o of obstaclesRef.current) {
                    const d = e.mesh.position.distanceTo(o.position);
                    if (d < minDistObs) {
                        minDistObs = d;
                        nearestObstacle = o;
                    }
                }

                if (nearestObstacle && minDistObs < 8) {
                    const coverDir = new THREE.Vector3().subVectors(nearestObstacle.position, playerRef.current.position).normalize();
                    const idealCoverPos = nearestObstacle.position.clone().add(coverDir.multiplyScalar(nearestObstacle.radius + 2));
                    targetPos = idealCoverPos;
                } else {
                    if (distToPlayer < idealDist - 2) {
                        const retreatDir = new THREE.Vector3().subVectors(e.mesh.position, playerRef.current.position).normalize();
                        targetPos = e.mesh.position.clone().add(retreatDir.multiplyScalar(5));
                    } else if (distToPlayer > idealDist + 2) {
                        targetPos = playerRef.current.position.clone();
                    } else {
                        const dirToP = new THREE.Vector3().subVectors(playerRef.current.position, e.mesh.position).normalize();
                        const strafeDir = new THREE.Vector3(-dirToP.z, 0, dirToP.x);
                        if (Math.sin(stateRef.current.frameCount * 0.02) > 0) strafeDir.negate();
                        targetPos = e.mesh.position.clone().add(strafeDir.multiplyScalar(3));
                    }
                }
            }

            const moveVec = new THREE.Vector3().subVectors(targetPos, e.mesh.position);
            const distToTarget = moveVec.length();
            
            let shouldMove = true;
            if (distToTarget < 0.5) shouldMove = false;

            if (shouldMove) {
                const dir = moveVec.normalize();
                let spd = CONFIG.enemySpeed + (stateRef.current.wave * 0.004);
                if (e.isElite) spd *= 0.8; if (e.type === 'ranged') spd *= 0.9;
                
                const separation = new THREE.Vector3();
                let count = 0;
                for (let j = 0; j < enemiesRef.current.length; j++) {
                    if (i === j) continue;
                    const dist = e.mesh.position.distanceTo(enemiesRef.current[j].mesh.position);
                    const safeDist = (e.isElite ? 2.0 : 1.2);
                    if (dist < safeDist) {
                        const push = new THREE.Vector3().subVectors(e.mesh.position, enemiesRef.current[j].mesh.position).normalize();
                        push.divideScalar(dist);
                        separation.add(push);
                        count++;
                    }
                }
                
                const finalMove = dir.clone().multiplyScalar(spd);
                if (count > 0) {
                    separation.divideScalar(count).normalize().multiplyScalar(spd * 1.5); 
                    finalMove.add(separation);
                }

                const checkCollision = (newPos: THREE.Vector3) => {
                    const size = e.isElite ? 1.5 : 0.8;
                    const eBox = new THREE.Box3().setFromCenterAndSize(newPos, new THREE.Vector3(size, size, size));
                    for (const obs of obstaclesRef.current) {
                        if (eBox.intersectsBox(obs.box)) return true;
                    }
                    return false;
                };

                const currentPos = e.mesh.position.clone();
                if (!checkCollision(currentPos.clone().add(finalMove))) {
                    e.mesh.position.add(finalMove);
                } else {
                    const moveX = new THREE.Vector3(finalMove.x, 0, 0);
                    if (Math.abs(moveX.x) > 0.001 && !checkCollision(currentPos.clone().add(moveX))) {
                        e.mesh.position.add(moveX);
                    } else {
                        const moveZ = new THREE.Vector3(0, 0, finalMove.z);
                        if (Math.abs(moveZ.z) > 0.001 && !checkCollision(currentPos.clone().add(moveZ))) {
                            e.mesh.position.add(moveZ);
                        }
                    }
                }
            }
            
            e.mesh.lookAt(playerRef.current.position);

            if (e.type !== 'ranged' && distToPlayer < (e.isElite ? 1.8 : 1.2)) {
                if (stateRef.current.invulnerable <= 0) {
                    const dmg = e.isElite ? 1.5 : 0.5;
                    
                    if (stateRef.current.shield > 0) {
                         stateRef.current.shield = Math.max(0, stateRef.current.shield - dmg);
                         setShield(stateRef.current.shield);
                    } else {
                         stateRef.current.hp -= dmg;
                         setHp(stateRef.current.hp);
                         stateRef.current.damageIntensity = Math.min(1.0, stateRef.current.damageIntensity + 0.1);
                         stateRef.current.shakeIntensity = 0.1;
                    }
                    
                    if (stateRef.current.hp <= 0) handleGameOver();
                }
            }
        }

        for (let i = enemyBulletsRef.current.length - 1; i >= 0; i--) {
            const b = enemyBulletsRef.current[i];
            b.mesh.position.add(b.velocity);
            b.life--;
            let hit = false;
            for (const obs of obstaclesRef.current) {
                if (b.mesh.position.distanceTo(obs.mesh.position) < 3) {
                    const box = new THREE.Box3().setFromObject(b.mesh);
                    if (box.intersectsBox(obs.box)) { hit = true; break; }
                }
            }
            if (!hit && playerRef.current && b.mesh.position.distanceTo(playerRef.current.position) < 0.8) {
                hit = true;
                if (stateRef.current.invulnerable <= 0) {
                     if (stateRef.current.shield > 0) {
                         stateRef.current.shield = Math.max(0, stateRef.current.shield - b.damage);
                         setShield(stateRef.current.shield);
                         createParticle(playerRef.current.position, 0x00bfff, 5); 
                    } else {
                        stateRef.current.hp -= b.damage;
                        setHp(stateRef.current.hp);
                        stateRef.current.damageIntensity = 1.0;
                        stateRef.current.shakeIntensity = 0.4;
                        createParticle(playerRef.current.position, 0xff0000, 5);
                    }
                    if (stateRef.current.hp <= 0) handleGameOver();
                }
            }
            if (hit || b.life <= 0) {
                sceneRef.current?.remove(b.mesh);
                enemyBulletsRef.current.splice(i, 1);
            }
        }

        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const p = particlesRef.current[i];
            p.mesh.position.add(p.velocity);
            p.life--;
            if (p.life <= 0) { sceneRef.current?.remove(p.mesh); particlesRef.current.splice(i, 1); }
        }
        for (let i = debrisRef.current.length - 1; i >= 0; i--) {
            const d = debrisRef.current[i];
            d.life--;
            d.mesh.position.add(d.velocity);
            d.mesh.rotation.x += d.rotation.x * 0.1;
            d.velocity.y -= 0.02;
            if(d.mesh.position.y < 0) { d.mesh.position.y=0; d.velocity.y *= -0.5; }
            if (d.life <= 0) { sceneRef.current?.remove(d.mesh); debrisRef.current.splice(i, 1); }
        }

        for(let i=airstrikesRef.current.length-1; i>=0; i--){
            const s = airstrikesRef.current[i];
            s.timer--;
            if (s.indicator.material instanceof THREE.MeshBasicMaterial) {
                s.indicator.material.opacity = (Math.floor(s.timer/5)%2===0) ? 0.8 : 0.2;
            }
            if(s.timer <= 0) {
                createExplosion(s.target, 0xffaa00, 50);
                applyAreaDamage(s.target, 5, 500);
                sceneRef.current?.remove(s.indicator);
                airstrikesRef.current.splice(i,1);
                stateRef.current.shakeIntensity = 1.0;
            }
        }
        
        for(let i=dropsRef.current.length-1; i>=0; i--){
            const d = dropsRef.current[i];
            d.mesh.rotation.y += 0.05;
            if(playerRef.current && playerRef.current.position.distanceTo(d.mesh.position) < 1.5) {
                const val = d.value || 20;
                if(d.type === 'shield') {
                    stateRef.current.shield += val;
                    setShield(stateRef.current.shield);
                    addFloatText(`+${val} Shield`, playerRef.current.position.x, playerRef.current.position.z, '#00bfff');
                    sfx.playPickup();
                    sceneRef.current?.remove(d.mesh);
                    dropsRef.current.splice(i,1);
                } else {
                    const max = 100 + stateRef.current.bonusMaxHp;
                    if(stateRef.current.hp < max) {
                        stateRef.current.hp = Math.min(max, stateRef.current.hp + val);
                        setHp(stateRef.current.hp);
                        addFloatText(`+${val} HP`, playerRef.current.position.x, playerRef.current.position.z);
                        sfx.playPickup();
                        sceneRef.current?.remove(d.mesh);
                        dropsRef.current.splice(i,1);
                    }
                }
            }
        }

        if (stateRef.current.dashCooldown > 0) stateRef.current.dashCooldown--;
        if (stateRef.current.skillCooldown > 0) stateRef.current.skillCooldown--;
        if (stateRef.current.invulnerable > 0) {
            stateRef.current.invulnerable--;
            if (playerRef.current) playerRef.current.visible = Math.floor(stateRef.current.frameCount / 4) % 2 === 0;
        } else if (playerRef.current) {
            playerRef.current.visible = true;
        }

        if (playerRef.current && cameraRef.current) {
            let targetX = playerRef.current.position.x;
            let targetZ = playerRef.current.position.z + 15;
            if (stateRef.current.shakeIntensity > 0) {
                targetX += (Math.random() - 0.5) * stateRef.current.shakeIntensity;
                targetZ += (Math.random() - 0.5) * stateRef.current.shakeIntensity;
                stateRef.current.shakeIntensity *= 0.9;
                if (stateRef.current.shakeIntensity < 0.05) stateRef.current.shakeIntensity = 0;
            }
            cameraRef.current.position.x += (targetX - cameraRef.current.position.x) * 0.1;
            cameraRef.current.position.z += (targetZ - cameraRef.current.position.z) * 0.1;

            // Fog of War update: Map player position to screen coordinates
            if (fogRef.current) {
                const pPos = playerRef.current.position.clone();
                pPos.project(cameraRef.current);
                const x = (pPos.x * 0.5 + 0.5) * 100;
                const y = (-(pPos.y * 0.5) + 0.5) * 100;
                fogRef.current.style.setProperty('--player-x', `${x}%`);
                fogRef.current.style.setProperty('--player-y', `${y}%`);
            }
        }

        if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
    };

    const handleGameOver = () => {
        stateRef.current.isPlaying = false;
        setGameStateStr('gameover');
    };

    const pauseForUpgrade = (type: 'skill' | 'weapon') => {
        stateRef.current.isPaused = true;
        sfx.playUpgrade();
        const txt = TEXT[stateRef.current.lang];
        
        // Use Ref for selected class
        const currentClassId = selectedClassIdRef.current;
        if (type === 'skill' && currentClassId) {
            const cls = CLASSES[currentClassId];
            
            const skillKeys = [1,2,3,4,5,6,7,8];
            for (let i = skillKeys.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [skillKeys[i], skillKeys[j]] = [skillKeys[j], skillKeys[i]];
            }
            const picked = skillKeys.slice(0, 2);
            
            const createSkillOption = (idx: number): UpgradeOption => {
                const actionMap: Record<string, () => void> = {
                    'infantry_1': () => { cls.cd = Math.floor(cls.cd * 0.85); },
                    'infantry_2': () => { stateRef.current.bonusMissileDmg += 30; },
                    'infantry_3': () => { /* Penetration logic implied */ },
                    'infantry_4': () => { stateRef.current.clusterMunitions = true; },
                    'infantry_5': () => { stateRef.current.bonusSpeed += 0.1; },
                    'infantry_6': () => { /* Rocket Jump */ },
                    'infantry_7': () => { stateRef.current.bonusMaxHp += 20; },
                    'infantry_8': () => { stateRef.current.ammoScavenger = true; },

                    'engineer_1': () => { stateRef.current.bonusBlastRadius += 2; },
                    'engineer_2': () => { stateRef.current.staticField = true; },
                    'engineer_3': () => { stateRef.current.autoTurret = true; },
                    'engineer_4': () => { /* Shield Gen */ },
                    'engineer_5': () => { /* Mine Layer */ },
                    'engineer_6': () => { /* Energy Recycle */ },
                    'engineer_7': () => { /* Napalm */ },
                    'engineer_8': () => { stateRef.current.bonusMaxHp += 10; stateRef.current.regen += 5; },

                    'medic_1': () => { /* Combat Stims */ },
                    'medic_2': () => { cls.cd = Math.floor(cls.cd * 0.8); },
                    'medic_3': () => { stateRef.current.bonusMaxHp += 30; },
                    'medic_4': () => { stateRef.current.lifesteal += 0.05; },
                    'medic_5': () => { /* Purification */ },
                    'medic_6': () => { stateRef.current.regen += 1; },
                    'medic_7': () => { stateRef.current.bonusSpeed += 0.15; },
                    'medic_8': () => { /* Overheal */ },

                    'sniper_1': () => { /* Kill Streak */ },
                    'sniper_2': () => { stateRef.current.critChance += 0.1; },
                    'sniper_3': () => { stateRef.current.pierceChance = 1; },
                    'sniper_4': () => { /* Ambush */ },
                    'sniper_5': () => { /* Steady Hands */ },
                    'sniper_6': () => { /* Ghillie Suit */ },
                    'sniper_7': () => { /* Focus */ },
                    'sniper_8': () => { stateRef.current.executeThreshold += 0.15; }
                };

                const kTitle = `${currentClassId}_skill${idx}` as keyof typeof TEXT.en;
                const kDesc = `${currentClassId}_skill${idx}_desc` as keyof typeof TEXT.en;

                return {
                    // @ts-ignore
                    title: txt[kTitle] || "Skill",
                    // @ts-ignore
                    desc: txt[kDesc] || "Upgrade",
                    type: "SKILL",
                    action: actionMap[`${currentClassId}_${idx}`] || (() => {})
                };
            };

            const optA = createSkillOption(picked[0]);
            const optB = createSkillOption(picked[1]);
            setUpgradeOptions([optA, optB]);
        } else {
            const currentDmg = Math.round(stateRef.current.weaponDamageMult * 100);
            const optA: UpgradeOption = {
                title: txt.limitBreak,
                desc: `${txt.limitBreakDesc} (${txt.dmg}: ${currentDmg}%)`,
                type: "ENHANCE",
                action: () => { stateRef.current.weaponDamageMult += 0.5; }
            };
            const optB: UpgradeOption = {
                title: txt.requisition,
                desc: txt.requisitionDesc,
                type: "REROLL",
                action: () => {
                    let newIndex;
                    do { newIndex = Math.floor(Math.random() * WEAPONS.length); } while (newIndex === weaponIdx && WEAPONS.length > 1);
                    setWeaponIdx(newIndex);
                    stateRef.current.weaponIdx = newIndex;
                    stateRef.current.weaponDamageMult = 1.1;
                }
            };
            setUpgradeOptions([optA, optB]);
        }
        setGameStateStr('upgrade');
    };

    const handleUpgradeSelect = (opt: UpgradeOption) => {
        opt.action();
        stateRef.current.isPaused = false;
        setGameStateStr('playing');
        setUpgradeOptions(null);
    };

    const getWeaponName = (idx: number) => {
        const id = WEAPONS[idx].id;
        // @ts-ignore
        return TEXT[lang][id] || WEAPONS[idx].name;
    };

    const getClassName = (id: string) => {
        // @ts-ignore
        return TEXT[lang][id] || CLASSES[id].name;
    };
    
    const getClassSkill = (id: string) => {
        // @ts-ignore
        return TEXT[lang][`skill_${id}`] || CLASSES[id].skillName;
    };

    // --- JSX Renders ---

    return (
        <div className="relative w-full h-full">
            {/* 3D Canvas Container */}
            <div ref={mountRef} className="w-full h-full cursor-crosshair transition-all duration-75" />
            
            {/* Fog of War Overlay (Only visible when playing) */}
            {gameStateStr === 'playing' && (
                <div 
                    ref={fogRef}
                    className="absolute inset-0 pointer-events-none z-30 transition-none"
                    style={{
                        background: 'radial-gradient(circle 55vmax at var(--player-x, 50%) var(--player-y, 50%), transparent 0%, transparent 60%, black 100%)'
                    }}
                />
            )}

            {/* Visual Feedback Overlays */}
            <div 
                ref={damageOverlayRef} 
                className="absolute inset-0 pointer-events-none z-40 transition-none mix-blend-multiply"
                style={{
                    boxShadow: 'inset 0 0 150px rgba(255,0,0,0.8)',
                    opacity: 0,
                    background: 'radial-gradient(circle, transparent 40%, rgba(180,0,0,0.4) 100%)'
                }}
            />

            {/* Custom Crosshair */}
            <div 
                className="pointer-events-none fixed z-50 mix-blend-difference"
                style={{ 
                    left: 0, top: 0, 
                    transform: `translate(${mouse.current.x * window.innerWidth/2 + window.innerWidth/2}px, ${-mouse.current.y * window.innerHeight/2 + window.innerHeight/2}px) translate(-50%, -50%)`,
                    position: 'fixed'
                }}
            >
                <div className="w-6 h-6 border-2 border-white rounded-full flex items-center justify-center">
                    <div className="w-1 h-1 bg-white rounded-full"></div>
                </div>
            </div>

            {/* Top Bar Controls */}
            <div className="absolute top-8 left-8 flex gap-4 z-50">
                <button 
                    onClick={() => { sfx.toggleMute(); setIsMuted(!isMuted); }}
                    className="p-3 bg-black/50 border border-gray-600 rounded-full hover:bg-white/10 text-xl transition-colors"
                >
                    {isMuted ? '🔇' : '🔊'}
                </button>
                {gameStateStr === 'playing' && (
                    <button 
                        onClick={toggleSettings}
                        className="p-3 bg-black/50 border border-gray-600 rounded-full hover:bg-white/10 text-xl transition-colors"
                    >
                        ⚙️
                    </button>
                )}
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-neutral-900 border border-neutral-700 p-8 rounded-xl text-center shadow-2xl max-w-sm w-full">
                        <h2 className="text-3xl font-bold mb-8 text-white tracking-widest">{TEXT[lang].settings}</h2>
                        <div className="space-y-4">
                            <button 
                                onClick={toggleSettings}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded uppercase tracking-wider transition-all"
                            >
                                {TEXT[lang].resume}
                            </button>
                            <button 
                                onClick={confirmQuit}
                                className="w-full py-3 bg-red-900/50 hover:bg-red-800 text-red-200 font-bold rounded uppercase tracking-wider border border-red-900 transition-all"
                            >
                                {TEXT[lang].quit}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* HUD (Playing) */}
            {gameStateStr === 'playing' && (
                <div className="absolute inset-0 pointer-events-none p-8 z-40">
                    {/* Health */}
                    <div className="absolute bottom-8 left-8 w-64 bg-black/60 backdrop-blur border border-white/10 p-4 rounded-lg">
                        
                        {/* Shield Bar (Only if shield > 0) */}
                        {shield > 0 && (
                            <div className="mb-2">
                                <div className="flex justify-between text-xs font-bold mb-1 tracking-wider text-cyan-400">
                                    <span>SHIELD</span>
                                    <span>{Math.ceil(shield)}</span>
                                </div>
                                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-all duration-200"
                                        style={{ width: `${Math.min(100, shield)}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between text-xs font-bold mb-1 tracking-wider text-gray-400">
                            <span>{TEXT[lang].hp}</span>
                            <span className={hp < 30 ? "text-red-500" : "text-emerald-400"}>{Math.ceil(hp)}%</span>
                        </div>
                        <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-200 ${hp < 30 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                style={{ width: `${Math.max(0, (hp / (100 + stateRef.current.bonusMaxHp)) * 100)}%` }}
                            />
                        </div>
                    </div>

                    {/* Score */}
                    <div className="absolute top-8 right-8 text-right bg-black/60 backdrop-blur border border-white/10 p-4 rounded-lg">
                        <div className="text-xs text-gray-400 tracking-wider">{TEXT[lang].score}</div>
                        <div className="text-3xl font-bold font-mono">{score.toLocaleString()}</div>
                        <div className="text-xs text-emerald-400 mt-1">{TEXT[lang].wave} {wave}</div>
                    </div>

                    {/* Weapon */}
                    <div className="absolute bottom-28 right-8 text-right border-r-4 border-emerald-500 pr-4">
                        <div className="text-2xl font-bold text-emerald-400 uppercase tracking-wide drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">
                            {getWeaponName(weaponIdx)}
                        </div>
                        <div className="text-sm text-gray-400 italic">{WEAPONS[weaponIdx].desc}</div>
                        <div className="text-xs text-gray-500 mt-1">{TEXT[lang].dmg}: {Math.round(stateRef.current.weaponDamageMult * 100)}%</div>
                    </div>

                    {/* Skills */}
                    <div className="absolute bottom-8 right-8 flex gap-3">
                        {/* Dash */}
                        <div className={`w-16 h-16 rounded-lg border-2 flex flex-col items-center justify-center relative overflow-hidden bg-black/80 transition-colors ${dashCooldownPct > 0 ? 'border-red-500 text-gray-500' : 'border-emerald-500 text-emerald-500'}`}>
                            <span className="text-[10px] absolute top-1 left-1.5 text-gray-400">SHIFT</span>
                            <span className="text-2xl">⚡</span>
                            <div className="absolute bottom-0 left-0 w-full bg-white/20 transition-all duration-100" style={{ height: `${dashCooldownPct}%` }}></div>
                        </div>
                        {/* Class Skill */}
                        <div className={`w-16 h-16 rounded-lg border-2 flex flex-col items-center justify-center relative overflow-hidden bg-black/80 transition-colors ${skillCooldownPct > 0 ? 'border-red-500 text-gray-500' : 'border-emerald-500 text-emerald-500'} ${stateRef.current.sniperBuff ? 'border-yellow-400 shadow-[0_0_10px_#ffff00] text-yellow-400' : ''}`}>
                            <span className="text-[10px] absolute top-1 left-1.5 text-gray-400">Q</span>
                            <span className="text-2xl">{selectedClassId ? CLASSES[selectedClassId].icon : '?'}</span>
                            <div className="absolute bottom-0 left-0 w-full bg-white/20 transition-all duration-100" style={{ height: `${skillCooldownPct}%` }}></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Notifications & Floating Text */}
            {notifications.map(n => (
                <div key={n.id} className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-40 animate-pulse-custom">
                    <h2 className={`text-4xl font-bold uppercase tracking-widest drop-shadow-lg ${n.color === 'text-purple-500' ? 'text-purple-500 shadow-purple-500/50' : 'text-yellow-400'}`}>{n.title}</h2>
                    <p className="text-white text-lg mt-2">{n.subtitle}</p>
                </div>
            ))}
            
            {floatTexts.map(ft => (
                <div 
                    key={ft.id} 
                    className="absolute font-bold text-xl pointer-events-none animate-float-up z-30 drop-shadow-md"
                    style={{ left: ft.x, top: ft.y, color: ft.color }}
                >
                    {ft.text}
                </div>
            ))}

            {/* Menus */}
            {/* 1. Class Select */}
            {gameStateStr === 'menu' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
                    <div className="max-w-4xl w-full p-8 text-center border border-white/10 rounded-2xl bg-white/5 shadow-2xl relative">
                        {/* Language Selection */}
                        <div className="absolute top-8 right-8 flex gap-2">
                            <button 
                                onClick={() => setLang('en')}
                                className={`px-4 py-1 rounded-full border text-sm font-bold transition-colors ${lang === 'en' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-transparent border-gray-600 text-gray-500 hover:border-gray-400 hover:text-white'}`}
                            >
                                ENGLISH
                            </button>
                            <button 
                                onClick={() => setLang('zh')}
                                className={`px-4 py-1 rounded-full border text-sm font-bold transition-colors ${lang === 'zh' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-transparent border-gray-600 text-gray-500 hover:border-gray-400 hover:text-white'}`}
                            >
                                中文
                            </button>
                        </div>

                        <h1 className="text-4xl font-bold text-white mb-2 tracking-widest mt-4">{TEXT[lang].chooseClass}</h1>
                        <p className="text-gray-400 mb-8">{TEXT[lang].chooseClassDesc}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {Object.values(CLASSES).map(c => (
                                <button 
                                    key={c.id}
                                    onClick={() => startGame(c.id)}
                                    className="group p-6 border-2 border-white/10 rounded-xl bg-white/5 hover:bg-white/10 hover:-translate-y-1 transition-all duration-200 hover:border-gray-400 hover:shadow-lg flex flex-col items-center"
                                >
                                    <div className="text-5xl mb-4 grayscale group-hover:grayscale-0 transition-all duration-300 transform group-hover:scale-110">{c.icon}</div>
                                    <div className="text-xl font-bold text-white mb-1 group-hover:text-emerald-400">{getClassName(c.id)}</div>
                                    <div className="text-xs text-gray-400">{TEXT[lang].skill}: <span className="text-yellow-400 font-bold">{getClassSkill(c.id)}</span></div>
                                    {c.id === 'medic' && <div className="text-[10px] text-emerald-400 mt-2">({TEXT[lang].passive}: +5% Spd)</div>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            {/* 1.5 Weapon Selection */}
            {gameStateStr === 'weaponSelect' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
                    <div className="max-w-4xl w-full p-8 text-center">
                        <h1 className="text-4xl font-bold text-white mb-2 tracking-widest">{TEXT[lang].selectWeapon}</h1>
                        <p className="text-gray-400 mb-10">{TEXT[lang].selectWeaponDesc}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[1, 18, 13].map((wIndex) => (
                                <button 
                                    key={wIndex}
                                    onClick={() => selectStartingWeapon(wIndex)}
                                    className="group p-8 border-2 border-white/10 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 hover:scale-105 hover:border-amber-500 hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] transition-all flex flex-col items-center justify-between h-64"
                                >
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-amber-500 mb-2 group-hover:text-amber-400">{getWeaponName(wIndex)}</div>
                                        <div className="text-sm text-gray-400 italic mb-4">{WEAPONS[wIndex].desc}</div>
                                    </div>
                                    <div className="w-full">
                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                            <span>DMG</span>
                                            <span>SPD</span>
                                        </div>
                                        <div className="flex gap-1 h-1">
                                            <div className="bg-red-500 h-full rounded" style={{width: `${Math.min(100, WEAPONS[wIndex].damage * 2)}%`}}></div>
                                            <div className="bg-blue-500 h-full rounded" style={{width: `${Math.min(100, WEAPONS[wIndex].fireRate * 3)}%`}}></div>
                                        </div>
                                    </div>
                                    <div className="mt-4 px-6 py-2 border border-white/20 rounded text-xs font-bold uppercase tracking-widest group-hover:bg-amber-500 group-hover:text-black group-hover:border-amber-500 transition-colors">
                                        SELECT
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Upgrade Modal */}
            {gameStateStr === 'upgrade' && upgradeOptions && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-lg">
                    <div className="max-w-3xl w-full p-8 text-center">
                        <h1 className="text-4xl font-bold text-yellow-400 mb-2 drop-shadow-[0_0_10px_rgba(255,0,0,0.8)] animate-pulse">{TEXT[lang].upgradeAvailable}</h1>
                        <p className="text-gray-400 mb-10">{TEXT[lang].upgradeDesc}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <button 
                                onClick={() => handleUpgradeSelect(upgradeOptions[0])}
                                className="relative overflow-hidden p-8 border-2 border-white/20 rounded-xl bg-gradient-to-b from-gray-800 to-gray-900 hover:scale-105 hover:border-emerald-400 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all group text-left"
                            >
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">{upgradeOptions[0].type}</span>
                                <span className="text-2xl font-bold text-emerald-400 mb-4 block group-hover:text-emerald-300">{upgradeOptions[0].title}</span>
                                <p className="text-gray-300 leading-relaxed">{upgradeOptions[0].desc}</p>
                            </button>

                            <button 
                                onClick={() => handleUpgradeSelect(upgradeOptions[1])}
                                className="relative overflow-hidden p-8 border-2 border-white/20 rounded-xl bg-gradient-to-b from-gray-800 to-gray-900 hover:scale-105 hover:border-amber-400 hover:shadow-[0_0_30px_rgba(251,191,36,0.2)] transition-all group text-left"
                            >
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">{upgradeOptions[1].type}</span>
                                <span className="text-2xl font-bold text-amber-400 mb-4 block group-hover:text-amber-300">{upgradeOptions[1].title}</span>
                                <p className="text-gray-300 leading-relaxed">{upgradeOptions[1].desc}</p>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Game Over */}
            {gameStateStr === 'gameover' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90">
                    <div className="max-w-md w-full p-8 text-center border border-red-900/50 rounded-2xl bg-red-950/20 backdrop-blur">
                        <h1 className="text-5xl font-bold text-red-500 mb-6 tracking-widest">{TEXT[lang].missionFailed}</h1>
                        <div className="text-xl text-gray-300 mb-8 space-y-2">
                            <p>{TEXT[lang].finalScore}: <span className="text-white font-bold text-2xl ml-2">{score.toLocaleString()}</span></p>
                            <p className="text-sm text-gray-500">CLASS: {selectedClassId ? getClassName(selectedClassId) : 'Unknown'}</p>
                        </div>
                        <button 
                            onClick={() => setGameStateStr('menu')}
                            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow-lg hover:shadow-emerald-500/30 transition-all uppercase tracking-wider"
                        >
                            {TEXT[lang].returnBase}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};