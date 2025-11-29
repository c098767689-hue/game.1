import * as THREE from 'three';

export interface Weapon {
    id: string; // Added for translation
    name: string; // Fallback/English
    desc: string; // Fallback/English
    fireRate: number;
    damage: number;
    speed: number;
    color: number;
    count: number;
    spread: number;
    life: number;
    size: number;
    pitch: number;
    areaDmg?: number;
    areaRadius?: number;
    isFlame?: boolean;
    explosive?: boolean;
    penetrate?: boolean;
    homing?: boolean;
    knockback?: number;
    parallel?: boolean;
    dual?: boolean;
}

export interface PlayerClass {
    id: string;
    name: string;
    skillName: string;
    color: number;
    cd: number;
    icon: string;
    duration?: number; // Duration for buff skills
    missileCount?: number;
    missileMode?: 'normal' | 'carpet';
    blastRadius?: number;
    blastMode?: 'normal' | 'nova';
    healAmount?: number;
    healMode?: 'normal' | 'shield';
    speedBonus?: number;
    shotCount?: number;
    shotMode?: 'normal' | 'explosive';
}

export interface Enemy {
    mesh: THREE.Mesh;
    hp: number;
    isElite: boolean;
    type: 'melee' | 'ranged' | 'charger' | 'tank' | 'sniper';
    lastShot: number;
    // AI Properties
    flankAngle?: number; // For melee flanking
    aiState?: 'seeking' | 'taking_cover' | 'attacking'; // For ranged logic
    coverTarget?: THREE.Vector3;
}

export interface Bullet {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    damage: number;
    explosive?: boolean;
    areaDmg?: number;
    areaRadius?: number;
    penetrate?: boolean;
    homing?: boolean;
    knockback?: number;
}

export interface Particle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    isSpark?: boolean;
}

export interface Debris {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotation: THREE.Vector3;
    life: number;
    isStatic?: boolean;
}

export interface Obstacle {
    mesh: THREE.Mesh;
    box: THREE.Box3;
    position: THREE.Vector3; // Helper for AI
    radius: number; // Helper for AI
}

export interface Airstrike {
    target: THREE.Vector3;
    timer: number;
    indicator: THREE.Mesh;
}

export interface Drop {
    mesh: THREE.Group;
    type: string;
    value: number;
}

export interface UpgradeOption {
    title: string;
    desc: string;
    type: string;
    action: () => void;
}

export const CONFIG = {
    playerSpeed: 0.15,
    playerDashSpeed: 0.4,
    dashDuration: 15,
    enemySpeed: 0.06,
    mapSize: 100,
    boundaryLimit: 48,
    scorePerWeaponUpgrade: 12000,
    scorePerSkillUpgrade: 10000,
    dropChance: 0.1,
    eliteChance: 0.15,
    colors: {
        enemy: 0xef4444,
        enemyRanged: 0xff8800,
        enemyElite: 0x9333ea,
        ground: 0x262626,
        obstacle: 0x525252,
        boundary: 0xff0000,
        healthPack: 0x00ff00
    }
};

export const TEXT = {
    en: {
        hp: "STRUCTURAL INTEGRITY",
        score: "MISSION SCORE",
        wave: "WAVE",
        dmg: "DMG",
        chooseClass: "CHOOSE YOUR CLASS",
        chooseClassDesc: "Select a specialized unit for this mission.",
        selectWeapon: "SELECT LOADOUT",
        selectWeaponDesc: "Choose your starting equipment.",
        skill: "Skill",
        passive: "Passive",
        upgradeAvailable: "UPGRADE AVAILABLE",
        upgradeDesc: "Combat data analysis complete. Choose an upgrade module.",
        missionFailed: "MISSION FAILED",
        finalScore: "FINAL SCORE",
        returnBase: "RETURN TO BASE",
        eliteDetected: "⚠️ ELITE DETECTED ⚠️",
        eliteSub: "HIGH ENERGY SIGNATURE",
        shielded: "SHIELDED",
        lethalReady: "LETHAL READY",
        
        // Settings
        settings: "SETTINGS",
        resume: "RESUME",
        quit: "QUIT TO MENU",

        // Upgrades
        reinforcedStrike: "Reinforced Strike",
        reinforcedStrikeDesc: "Missile Count +1",
        carpetBomb: "Carpet Bomb",
        carpetBombDesc: "Line Bombing Mode",
        overclock: "Overclock",
        overclockDesc: "Cooldown -25%",
        plasmaNova: "Plasma Nova",
        plasmaNovaDesc: "Double Blast Radius",
        potentMeds: "Potent Meds",
        potentMedsDesc: "Heal +100%",
        nanoShield: "Nano Shield",
        nanoShieldDesc: "Invuln on Heal",
        serialKiller: "Serial Killer",
        serialKillerDesc: "Skill Charges +1",
        explosiveRounds: "Explosive Rounds",
        explosiveRoundsDesc: "Skill causes Explosions",
        limitBreak: "Limit Break",
        limitBreakDesc: "Current Weapon DMG +50%",
        requisition: "Requisition",
        requisitionDesc: "Get New Weapon (DMG resets to 110%)",

        // Classes
        infantry: "Infantry",
        engineer: "Engineer",
        medic: "Medic",
        sniper: "Sniper",
        skill_infantry: "Precision Missile",
        skill_engineer: "Blast Wave",
        skill_medic: "Field Aid",
        skill_sniper: "One Shot",

        // Weapons
        ar: "Assault Rifle",
        smg: "SMG",
        magnums: "Dual Magnums",
        shotgun: "Tactical Shotgun",
        hmg: "Heavy MG",
        marksman: "Marksman Rifle",
        flamer: "Flamethrower",
        gl: "Grenade Launcher",
        pulse: "Pulse Rifle",
        minigun: "Minigun",
        rpg: "Rocket Launcher",
        laser: "Laser Cannon",
        void: "Void Destroyer",
        bio: "Bio-Acid Gun",
        smart: "Smart Missiles",
        shock: "Shockwave",
        twin: "Twin Lasers",
        singularity: "Singularity",
        uzi: "Dual Uzi",
        sawed: "Sawed-Offs",
        thermal: "Thermal Pistols",
        needler: "Needlers",
        cannons: "Dual Cannons",
    },
    zh: {
        hp: "機體完整度",
        score: "任務積分",
        wave: "波次",
        dmg: "傷害",
        chooseClass: "選擇你的兵種",
        chooseClassDesc: "為本次任務選擇特化單位。",
        selectWeapon: "選擇初始武裝",
        selectWeaponDesc: "請選擇你的配發武器。",
        skill: "技能",
        passive: "被動",
        upgradeAvailable: "系統升級",
        upgradeDesc: "戰鬥數據分析完成。請選擇升級模組。",
        missionFailed: "任務失敗",
        finalScore: "最終積分",
        returnBase: "返回基地",
        eliteDetected: "⚠️ 偵測到菁英單位 ⚠️",
        eliteSub: "高能量反應",
        shielded: "護盾啟動",
        lethalReady: "處決準備",
        
        // Settings
        settings: "設定",
        resume: "繼續遊戲",
        quit: "返回主選單",

        // Upgrades
        reinforcedStrike: "增援打擊",
        reinforcedStrikeDesc: "導彈數量 +1",
        carpetBomb: "地毯式轟炸",
        carpetBombDesc: "改為直線轟炸模式",
        overclock: "系統超頻",
        overclockDesc: "冷卻時間 -25%",
        plasmaNova: "電漿新星",
        plasmaNovaDesc: "爆破半徑加倍",
        potentMeds: "高效治療",
        potentMedsDesc: "補血量 +100%",
        nanoShield: "奈米護盾",
        nanoShieldDesc: "治療時獲得無敵",
        serialKiller: "連環殺手",
        serialKillerDesc: "技能次數 +1",
        explosiveRounds: "高爆彈頭",
        explosiveRoundsDesc: "技能附加爆炸效果",
        limitBreak: "極限突破",
        limitBreakDesc: "當前武器傷害 +50%",
        requisition: "軍火重配",
        requisitionDesc: "隨機更換新武器 (傷害重置為 110%)",

        // Classes
        infantry: "步兵",
        engineer: "工程兵",
        medic: "醫療兵",
        sniper: "狙擊手",
        skill_infantry: "精準導彈",
        skill_engineer: "周圍爆破",
        skill_medic: "戰場急救",
        skill_sniper: "一擊斃殺",

        // Weapons
        ar: "制式步槍",
        smg: "輕型衝鋒槍",
        magnums: "雙持麥格農",
        shotgun: "戰術散彈槍",
        hmg: "重型機槍",
        marksman: "精準射手步槍",
        flamer: "火焰噴射器",
        gl: "榴彈發射器",
        pulse: "脈衝步槍",
        minigun: "加特林機槍",
        rpg: "火箭發射器",
        laser: "雷射加農砲",
        void: "虛空毀滅者",
        bio: "生化腐蝕砲",
        smart: "智能追蹤導彈",
        shock: "震盪衝擊波",
        twin: "雙子星雷射",
        singularity: "終焉奇點",
        uzi: "雙持烏茲",
        sawed: "雙持削短型散彈",
        thermal: "雙持熱熔手槍",
        needler: "雙持針刺者",
        cannons: "雙持重砲",
    }
};

export const CLASSES: Record<string, PlayerClass> = {
    infantry: { id: 'infantry', name: "Infantry", skillName: "Precision Missile", color: 0x3b82f6, cd: 300, icon: '🚀', missileCount: 1, missileMode: 'normal' },
    engineer: { id: 'engineer', name: "Engineer", skillName: "Blast Wave", color: 0xf97316, cd: 480, icon: '💥', blastRadius: 8, blastMode: 'normal' },
    medic: { id: 'medic', name: "Medic", skillName: "Field Aid (25HP)", color: 0x10b981, cd: 1800, icon: '✚', healAmount: 25, healMode: 'normal', speedBonus: 1.05 },
    sniper: { id: 'sniper', name: "Sniper", skillName: "One Shot", color: 0x94a3b8, cd: 1800, icon: '🎯', duration: 300, shotMode: 'normal' }
};

export const WEAPONS: Weapon[] = [
    { id: 'ar', name: "Assault Rifle", desc: "Balanced standard issue.", fireRate: 10, damage: 35, speed: 0.8, color: 0xffff00, count: 1, spread: 0.02, life: 100, size: 0.15, pitch: 1.0 },
    { id: 'smg', name: "SMG", desc: "High rate of fire, low damage.", fireRate: 5, damage: 18, speed: 0.7, color: 0xffcc00, count: 1, spread: 0.15, life: 70, size: 0.12, pitch: 1.5 },
    { id: 'magnums', name: "Dual Magnums", desc: "Double trouble.", fireRate: 20, damage: 45, speed: 0.9, color: 0xffffff, count: 2, spread: 0.1, life: 90, size: 0.18, pitch: 0.8, dual: true },
    { id: 'shotgun', name: "Tactical Shotgun", desc: "Close quarters dominance.", fireRate: 35, damage: 25, speed: 0.6, color: 0xffaa00, count: 5, spread: 0.3, life: 40, size: 0.12, pitch: 0.6 },
    { id: 'hmg', name: "Heavy MG", desc: "Sustained suppression.", fireRate: 8, damage: 45, speed: 0.85, color: 0xff8800, count: 1, spread: 0.05, life: 110, size: 0.2, pitch: 0.7 },
    { id: 'marksman', name: "Marksman Rifle", desc: "High caliber precision.", fireRate: 25, damage: 95, speed: 1.5, color: 0x00ff00, count: 1, spread: 0.0, life: 150, size: 0.2, pitch: 2.0 },
    { id: 'flamer', name: "Flamethrower", desc: "Burn it all down.", fireRate: 2, damage: 10, speed: 0.45, color: 0xff4400, count: 1, spread: 0.15, life: 35, size: 0.3, isFlame: true, pitch: 3.0 },
    { id: 'gl', name: "Grenade Launcher", desc: "Explosive payload.", fireRate: 50, damage: 0, areaDmg: 150, areaRadius: 4, speed: 0.6, color: 0x444444, count: 1, spread: 0.05, life: 60, size: 0.4, explosive: true, pitch: 0.5 },
    { id: 'pulse', name: "Pulse Rifle", desc: "Energy based warfare.", fireRate: 6, damage: 35, speed: 1.2, color: 0x00ffff, count: 1, spread: 0.01, life: 120, size: 0.15, pitch: 1.8 },
    { id: 'minigun', name: "Minigun", desc: "Maximum fire rate.", fireRate: 3, damage: 22, speed: 0.9, color: 0xffffaa, count: 1, spread: 0.12, life: 90, size: 0.12, pitch: 1.2 },
    { id: 'rpg', name: "Rocket Launcher", desc: "Heavy devastation.", fireRate: 70, damage: 0, areaDmg: 350, areaRadius: 6, speed: 0.5, color: 0x888888, count: 1, spread: 0, life: 80, size: 0.5, explosive: true, pitch: 0.4 },
    { id: 'laser', name: "Laser Cannon", desc: "Light speed piercing.", fireRate: 40, damage: 250, speed: 3.0, color: 0xff00ff, count: 1, spread: 0, life: 60, size: 0.1, pitch: 2.5, penetrate: true },
    { id: 'void', name: "Void Destroyer", desc: "Ultimate weapon.", fireRate: 15, damage: 60, areaDmg: 100, areaRadius: 3, speed: 0.7, color: 0xaa00ff, count: 5, spread: 0.4, life: 100, size: 0.3, explosive: true, pitch: 0.3 },
    { id: 'bio', name: "Bio-Acid Gun", desc: "Corrosive spray.", fireRate: 4, damage: 15, speed: 1.1, color: 0x00ff00, count: 1, spread: 0.1, life: 60, size: 0.25, pitch: 1.5 },
    { id: 'smart', name: "Smart Missiles", desc: "Auto-locking projectiles.", fireRate: 25, damage: 45, speed: 0.9, color: 0x00aaff, count: 3, spread: 0.5, life: 150, size: 0.2, homing: true, pitch: 1.0 },
    { id: 'shock', name: "Shockwave", desc: "Wide knockback blast.", fireRate: 45, damage: 80, speed: 0.5, color: 0xffffff, count: 1, spread: 0, life: 80, size: 1.5, penetrate: true, knockback: 2.0, pitch: 0.2 },
    { id: 'twin', name: "Twin Lasers", desc: "Parallel destruction.", fireRate: 8, damage: 40, speed: 1.8, color: 0xff0055, count: 2, spread: 0.05, life: 100, size: 0.15, pitch: 2.2, parallel: true },
    { id: 'singularity', name: "Singularity", desc: "Black hole generator.", fireRate: 120, damage: 10, areaDmg: 800, areaRadius: 12, speed: 0.3, color: 0x000000, count: 1, spread: 0, life: 150, size: 0.8, explosive: true, pitch: 0.1 },
    { id: 'uzi', name: "Dual Uzi", desc: "Double spray.", fireRate: 3, damage: 10, speed: 0.7, color: 0xffcc00, count: 2, spread: 0.25, life: 60, size: 0.12, pitch: 1.5, dual: true },
    { id: 'sawed', name: "Sawed-Offs", desc: "Double barrel chaos.", fireRate: 50, damage: 18, speed: 0.6, color: 0xdd8800, count: 8, spread: 0.35, life: 30, size: 0.12, pitch: 0.6, dual: true },
    { id: 'thermal', name: "Thermal Pistols", desc: "Piercing heat.", fireRate: 15, damage: 45, speed: 0.6, color: 0xff4400, count: 2, spread: 0.05, life: 80, size: 0.2, pitch: 1.2, dual: true, penetrate: true },
    { id: 'needler', name: "Needlers", desc: "Tracking spikes.", fireRate: 5, damage: 12, speed: 0.8, color: 0xff00ff, count: 2, spread: 0.2, life: 100, size: 0.15, pitch: 1.8, dual: true, homing: true },
    { id: 'cannons', name: "Dual Cannons", desc: "Double explosions.", fireRate: 30, damage: 0, areaDmg: 120, areaRadius: 4, speed: 0.5, color: 0x444444, count: 2, spread: 0.1, life: 80, size: 0.3, pitch: 0.5, dual: true, explosive: true }
];